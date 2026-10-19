---
date: 2026-10-18
author: root
---

# Video Encoding-to-Stream Pipeline

## Overview and requirements

Users upload MP4 or MKV files straight to object storage, an asynchronous worker fleet transcodes each file into an HLS ladder capped at 1080p and never above the source resolution, and the API reports progress from a job record the workers update. The API server never touches video bytes, which keeps it small and stateless.

### Functional requirements

- Accept MP4 and MKV uploads (and tolerate other containers such as MOV or WebM) from a web frontend, including multi-GB files and flaky connections.
- Produce an HLS package: one master playlist (`index.m3u8`), one media playlist per rendition, and segments.
- Offer multiple renditions (240p up to a 1080p cap) but only those at or below the source resolution. Never upscale.
- Store metadata in a database and segments, playlists and thumbnails in object storage.
- Report upload, queue and encoding progress to the user in near real time.

### Non-functional targets (assumptions to confirm)

| Concern | Target |
| --- | --- |
| Max upload size | 20 GB per file |
| Time to first playable rendition | Under 1x the video duration for a 1080p source |
| Progress freshness | Updated at least every 2 seconds on the client |
| Durability of source and output | 11 nines via object storage, with replication optional |
| Job reliability | At-least-once processing with idempotent workers |

**Non-goals for v1:** DRM, live streaming, per-title encoding optimization, and user-facing editing.

**Assumed stack:** S3-compatible object storage, PostgreSQL, Redis, RabbitMQ, containerized ffmpeg workers, and a CDN in front of the output bucket. Any equivalent works.

## Architecture

Eight components split the work cleanly: the browser and the workers move video bytes, while the API server only creates records, signs URLs and reports status.

&#91;embedded content: system architecture · 8 components\]

Workers read the source from the raw bucket and write HLS output to the streams bucket. The CDN serves playback from there, and progress flows from workers through Redis to the API and out to the browser.

| Component | Responsibility | Suggested tech |
| --- | --- | --- |
| Frontend app | Chunked parallel upload, progress UI, HLS playback | Web app with hls.js |
| API server | Auth, validation, presigned URLs, job creation, status and SSE endpoints | Stateless HTTP service |
| Job queue | Durable at-least-once delivery, retries, dead letters | RabbitMQ |
| Workers | Probe, encode one rendition per task, upload segments, report progress | Containerized ffmpeg, autoscaled |
| PostgreSQL | Upload and rendition records and state machine, next to the existing video catalog | Managed PostgreSQL |
| Redis | Hot progress values and pub/sub for live updates | Managed Redis |
| Object storage | Raw uploads bucket and streams bucket | S3-compatible |
| CDN | Cached delivery of playlists and segments | Any CDN with the streams bucket as origin |

## End-to-end workflow

Each upload (not each video) moves through one state machine: `CREATED → UPLOADING → UPLOADED → QUEUED → PROBING → ENCODING → PACKAGING → READY`, with `FAILED` reachable from any step after upload. A video is playable as soon as any one of its uploads is READY.

1. **Create.** The user finds the target video by title or code (existing trigram indexes). If it does not exist, the frontend first calls `POST /api/v1/videos` to create the canonical record. It then calls `POST /api/v1/videos/{video_id}/uploads` with file name, size and content type. The API validates extension and size, inserts a `video_upload` row in `CREATED`, and returns the `upload_id` plus presigned URLs for an S3 multipart upload (64 MB parts, uploaded 3 to 6 in parallel, each retried independently).
2. **Upload.** The browser sends parts directly to the `raw-uploads` bucket. Upload progress comes from the browser's own byte counters, and the user can resume after a drop because finished parts are already stored.
3. **Complete.** The frontend calls `POST /api/v1/uploads/{upload_id}/complete` with the part ETags. The API finishes the multipart upload, checks the object size, moves the row to `UPLOADED`, and enqueues one `transcode` message containing only the `upload_id`.
4. **Probe.** A worker takes the message, marks the row `PROBING`, and runs `ffprobe` against a presigned URL of the source. It records duration, resolution, frame rate, codecs, rotation and audio tracks on the `video_upload` row, fills `video.duration` if it is empty, rejects files with no video stream, and builds the rendition plan (see the encoding section).
5. **Encode.** The orchestrator fans the plan out into one task per rendition, each tracked in `video_rendition`. Each task runs ffmpeg into local scratch space; a sidecar uploads every finished segment to the `streams` bucket as it appears and writes the rendition's media playlist.
6. **Package.** When all rendition tasks succeed, a finalizer writes `index.m3u8`, generates a poster and a thumbnail sprite, then in one database transaction sets the upload to `READY` and inserts the `video_m3u8` row (primary if the video has none yet). It then publishes an `upload.ready` event.
7. **Play.** The player asks for the video's primary `video_m3u8` URL, loads `index.m3u8` through the CDN, and lets the HLS client (hls.js or native Safari) switch renditions on bandwidth.

**Why direct upload:** large files never pass through API servers, so the API tier stays small, scales on request rate only, and has no long-lived connections to babysit. If policy requires every byte to pass through the backend, run the same flow against a resumable endpoint such as tus on the API and stream each chunk into the same multipart upload.

## Encoding design

Every rendition is H.264 with AAC audio in 6-second fMP4 segments, with keyframes forced on segment boundaries so the player can switch renditions cleanly. The ladder is generated from the probe result, stops at the source height, and never goes above 1080p even when the source is 1440p or 4K.

### Ladder rules

- Include every standard rung whose height is at most the smaller of the source height and 1080.
- If the source is shorter than 1080 and not a standard rung (for example 900p), add its own height as the top rung.
- A source above 1080p is downscaled to 1080p. The original stays in the raw bucket, so higher rungs can be added later without a re-upload.
- Round widths to even numbers with `scale=-2:H` and keep the source aspect ratio.
- Never upscale. A 480p source produces 240p, 360p and 480p only.
- The 1080 cap is one setting (`MAX_HEIGHT`), not hard-coded.

| Rung | Height | Video bitrate (kbps) | Audio (kbps) |
| --- | --- | --- | --- |
| 240p | 240 | 400 | 64 |
| 360p | 360 | 800 | 96 |
| 480p | 480 | 1400 | 128 |
| 720p | 720 | 2800 | 128 |
| 1080p | 1080 | 5000 | 128 |

These bit-rates are common starting points, not tuned values. Validate them against your content with VMAF before launch, and consider CRF-capped encoding later.

### Per-rendition ffmpeg command

720p shown; `$SRC` is a presigned URL or local path

```bash
ffmpeg -i "$SRC" -map 0:v:0 -map 0:a:0? \
  -vf "scale=-2:720,format=yuv420p" \
  -c:v libx264 -profile:v high -preset medium \
  -b:v 2800k -maxrate 3000k -bufsize 4200k \
  -force_key_frames "expr:gte(t,n_forced*6)" -sc_threshold 0 \
  -c:a aac -b:a 128k -ac 2 \
  -f hls -hls_time 6 -hls_playlist_type vod \
  -hls_segment_type fmp4 -hls_fmp4_init_filename init.mp4 \
  -hls_segment_filename "out/720p/seg_%05d.m4s" \
  -progress pipe:1 -nostats \
  out/720p/index.m3u8
```

### Master playlist

(written last, only listing renditions that finished)

```m3u8
#EXTM3U
#EXT-X-VERSION:7
#EXT-X-STREAM-INF:BANDWIDTH=3000000,RESOLUTION=1280x720,CODECS="avc1.64001f,mp4a.40.2"
720p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=5200000,RESOLUTION=1920x1080,CODECS="avc1.640028,mp4a.40.2"
1080p/index.m3u8
```

### Edge cases the probe step must handle

- **Rotation and odd aspect ratios:** apply rotation metadata before choosing rungs, so portrait phone video is laddered by its displayed height.
- **HDR sources:** tone-map to SDR for the H.264 ladder; add an HEVC HDR ladder later if needed.
- **Interlaced video:** deinterlace with `yadif` before scaling.
- **Variable frame rate:** keep the frame rate, capped at 60 fps, and rely on time-based keyframe forcing.
- **No audio or several audio tracks:** the `0:a:0?` map tolerates a missing track; v1 uses the first track, and multi-audio HLS groups are a later feature.
- **MKV subtitles and chapters:** ignored in v1; text subtitles can later be extracted to WebVTT and referenced from the master playlist.

## Data model, storage and API

The existing `video` table stays the single source of truth for what a title is. A new `video_upload` table records each uploaded file for it, so one video can have many uploads from different users, each with its own encode and its own HLS output. The existing `video_m3u8` table keeps serving playback and gains a link back to the upload that produced each playlist.

### Existing tables (reused)

| Table | Role in the pipeline | Change |
| --- | --- | --- |
| video | Canonical metadata record: title, cid, release\_date, jancode and so on. Integer `id` is the foreign key target; `video_id` is the unique business code | None. The probe step fills `duration` only when it is NULL |
| video\_m3u8 | One row per playable master playlist URL for a video | Add `upload_id` and `is_primary` (see migration) |
| comment, watch history, views, reactions, genre, cast and other link tables | Reference `video.id` | None |

### `video_upload`

New table: one row per uploaded file, many per video

| Column | Type | Notes |
| --- | --- | --- |
| id | integer | Primary key, same style as `video.id` |
| created\_at, updated\_at | timestamp | Same defaults as the existing tables |
| fk\_id | integer | Foreign key to `video.id`, ON DELETE CASCADE, indexed |
| public\_id | uuid | Unique; used in API paths, storage keys and progress keys so ids are not guessable |
| uploader\_id | integer | Points at your user table (its name is not in the pasted schema) |
| original\_filename | text | As uploaded |
| source\_key | text | Key in the raw-uploads bucket |
| source\_bytes | bigint | Verified at completion |
| duration\_s, width, height, fps | numeric / integer | Filled by the probe step |
| video\_codec, audio\_codec | varchar(50) | From ffprobe |
| status | varchar(20) | State machine in the workflow section |
| error\_code, error\_message | varchar / text | Set only when FAILED |
| ready\_at | timestamp | Set when the upload is READY |

**`video_rendition`** (new: one row per ladder rung of an upload)

| Column | Type | Notes |
| --- | --- | --- |
| id | integer | Primary key |
| created\_at, updated\_at | timestamp | |
| upload\_id | integer | Foreign key to `video_upload.id`, ON DELETE CASCADE, indexed |
| label | varchar(10) | For example 720p; unique together with upload\_id |
| width, height, video\_kbps | integer | |
| playlist\_key | text | Key of the media playlist |
| segment\_count | integer | Set when finished |
| status | varchar(20) | PENDING, ENCODING, DONE, FAILED |
| progress\_pct | smallint | Written at most every few seconds |
| attempt | smallint | For retries and idempotency |

### Migration

Create the two new tables, backfill `video_m3u8`, then add the partial unique index. Existing rows keep working because both new columns are optional or defaulted.

```sql
CREATE TABLE video_upload (
  id serial PRIMARY KEY,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  fk_id integer NOT NULL REFERENCES video(id) ON DELETE CASCADE,
  public_id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  uploader_id integer,
  original_filename text NOT NULL,
  source_key text,
  source_bytes bigint,
  status varchar(20) NOT NULL DEFAULT 'CREATED',
  duration_s numeric, width integer, height integer, fps numeric,
  video_codec varchar(50), audio_codec varchar(50),
  error_code varchar(50), error_message text,
  ready_at timestamp
);
CREATE INDEX ix_video_upload_fk_id ON video_upload (fk_id);
CREATE INDEX ix_video_upload_status ON video_upload (status);

CREATE TABLE video_rendition (
  id serial PRIMARY KEY,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  upload_id integer NOT NULL REFERENCES video_upload(id) ON DELETE CASCADE,
  label varchar(10) NOT NULL,
  width integer NOT NULL, height integer NOT NULL, video_kbps integer NOT NULL,
  playlist_key text, segment_count integer,
  status varchar(20) NOT NULL DEFAULT 'PENDING',
  progress_pct smallint NOT NULL DEFAULT 0,
  attempt smallint NOT NULL DEFAULT 0,
  CONSTRAINT uq_video_rendition_upload_label UNIQUE (upload_id, label)
);

ALTER TABLE video_m3u8
  ADD COLUMN upload_id integer REFERENCES video_upload(id) ON DELETE SET NULL,
  ADD COLUMN is_primary boolean NOT NULL DEFAULT false;

UPDATE video_m3u8 m SET is_primary = true
 WHERE m.id = (SELECT min(id) FROM video_m3u8 WHERE fk_id = m.fk_id);

CREATE UNIQUE INDEX uq_video_m3u8_primary ON video_m3u8 (fk_id) WHERE is_primary;
```

When an upload reaches READY, the finalizer inserts a `video_m3u8` row in the same transaction as the status change: `m3u8_url` is the full CDN URL of `index.m3u8`, `upload_id` is set, and `is_primary` is true only if the video has no primary row yet. The existing unique constraint on `(fk_id, m3u8_url)` makes a retried finalizer harmless (`ON CONFLICT DO NOTHING`). Changing which upload is primary is one update of two rows.

### Storage layout
  
```txt
raw-uploads/{upload_public_id}/source.{ext}
streams/{video_hash}/index.m3u8
streams/{video_hash}/review.mp4
streams/{video_hash}/{resolution}/playlist.m3u8
streams/{video_hash}/{resolution}/seg_{segment_number}.ts
streams/{video_hash}/samples/sample_{sample_number}.jpg
```

Segments and VOD playlists are immutable once written, so serve them with `Cache-Control: public, max-age=31536000, immutable` through the CDN. Give `index.m3u8` a short max-age until the video is READY. Apply a lifecycle rule to the raw bucket (for example, delete 30 days after READY) unless you want to keep sources for re-encoding.

### API

| Method and path | Purpose |
| --- | --- |
| POST /api/v1/videos | Create the canonical video record if it does not exist yet (unique `video_id` code prevents duplicates) |
| POST /api/v1/videos/{video\_id}/uploads | Create a `video_upload` row for that video, return `upload_id` and presigned multipart URLs |
| POST /api/v1/uploads/{upload\_id}/complete | Finish the multipart upload with part ETags and enqueue the job |
| GET /api/v1/uploads/{upload\_id} | Status, overall progress, renditions, playback URL when READY |
| GET /api/v1/uploads/{upload\_id}/events | Server-Sent Events stream of progress and state changes |
| GET /api/v1/videos/{video\_id}/uploads | List all uploads of a video with status |
| POST /api/v1/uploads/{upload\_id}/retry | Re-queue a FAILED upload |
| DELETE /api/v1/uploads/{upload\_id} | Delete the upload, its source and its stream objects, and its `video_m3u8` row |

`{video_id}` is the existing business code in `video.video_id`. The existing trigram indexes on title and code already support the lookup a user does before choosing which video to attach an upload to.

## Progress, reliability, scaling and rollout

Progress comes from ffmpeg itself: each worker reads the `out_time` value from `-progress pipe:1`, divides it by the probed duration, and writes the result to Redis, from where the API pushes it to the browser.

### Progress reporting

- **Upload stage:** measured in the browser from bytes sent over total bytes, and shown by the frontend directly.
- **Processing stage:** the server reports one overall percentage. Probing counts 5%, encoding 85%, packaging 10%. Inside encoding, each rendition's progress is weighted by its pixel count (width × height), so a 1080p rung moves the bar more than a 240p rung.
- **Transport:** workers write to the Redis hash `progress:{upload_public_id}` and publish on a channel. API instances subscribe and forward updates over Server-Sent Events at `/api/v1/uploads/{upload_id}/events`, throttled to about one message per second per upload.
- **Fallback:** if SSE is blocked, the client polls `GET /api/v1/uploads/{upload_id}` every 2 seconds, which reads the same Redis hash.
- **Persistence:** PostgreSQL gets a progress write on every state change and every 10 seconds at most, so a Redis restart loses at most a few seconds of detail.
- **Payload:** `{status, overallPct, stage, renditions:[{label, pct, status}], etaSeconds, error}`. ETA is elapsed encoding time divided by the weighted fraction done, shown only after 10% to avoid wild early guesses.

### Failure handling

- Queue delivery is at-least-once with a visibility timeout; workers heartbeat while encoding, so a crashed worker's task reappears for another worker.
- Output keys are deterministic, so a retried task overwrites its own partial segments safely. The `attempt` column guards against a stale worker finishing late.
- Retry transient errors (storage, network, out-of-memory) up to 3 times with exponential backoff; send repeat failures to a dead-letter queue and alert.
- Permanent errors set clear codes such as `NO_VIDEO_STREAM`, `UNSUPPORTED_CODEC` or `CORRUPT_SOURCE`, shown to the user without retry.
- In v1 a video is READY only when every planned rendition is done. `POST /retry` re-runs only the failed renditions.
- A reaper job fails videos stuck in one state longer than a set limit and aborts abandoned multipart uploads (also covered by a bucket lifecycle rule).

### Scaling

- API servers are stateless and scale on request rate.
- Workers autoscale on queue depth and age of the oldest message. Each task is one rendition, so many small workers beat a few large ones, and spot or preemptible instances are safe because tasks are idempotent.
- Size scratch disk for one rendition's output plus working space; stream the source from storage rather than copying it.
- For very long videos, a later version can split the source by time range, encode chunks in parallel and stitch the playlists, trading complexity for latency.
- GPU encoders (NVENC) cut time per rendition at some quality cost; benchmark before choosing.

### Security

- Authenticate every API call; presigned upload URLs expire in minutes and are scoped to one key and size limit.
- Do not trust file extensions: validate with `ffprobe`, and run ffmpeg in a sandboxed container with CPU, memory and time limits and network access only to storage and Redis, since it parses untrusted input.
- Apply per-user quotas and rate limits on uploads and concurrent jobs.
- For private videos, serve through signed CDN URLs or cookies; public videos can use plain CDN paths.

### Rollout

1. **Phase 1, working path:** direct upload, one worker per video producing three rungs, polling for progress, a single bucket pair.
2. **Phase 2, production shape:** full ladder up to 1080p (or the source height if lower), per-rendition fan-out, SSE progress, autoscaling, dead-letter handling, CDN.
3. **Phase 3, quality and features:** VMAF-based bitrate tuning, thumbnails and sprites, subtitles, multi-audio, HEVC or AV1 ladders, DRM if required.

## Migration plan: one video record per upload (Model B)

The sections above describe Model A (one `video` record, many `video_upload` rows). This section is the plan if you choose Model B instead: every upload becomes its own `video` row and the `video_upload` table is never created. Existing rows are not merged or rewritten; they become "legacy" rows and keep their playlists, links and engagement.

### What changes versus Model A

| Concern | Model A (above) | Model B |
| --- | --- | --- |
| Upload state (status, source key, codecs, errors) | `video_upload` table | New columns on `video` |
| Renditions | `video_rendition.upload_id` | `video_rendition.video_id` pointing at `video.id` |
| Playlists | `video_m3u8` plus `upload_id` and `is_primary` | `video_m3u8` unchanged; each video row owns its playlists |
| `video.video_id` business code | Unique, one row per title | Shared by uploads of the same title; unique only among legacy rows |
| API | `/api/v1/videos/{video_id}/uploads` and `/api/v1/uploads/{upload_id}/...` | One resource: `POST /api/v1/videos`, then `/api/v1/videos/{id}/complete`, `/events`, `/retry` |
| Storage keys | `streams/{video.id}/{upload_public_id}/...` | `streams/{video.id}/...` and `raw-uploads/{public_id}/source.{ext}` |
| Progress key | `progress:{upload_public_id}` | `progress:{public_id}` |

### Essential fields preserved

| Existing field | Handling in Model B |
| --- | --- |
| `video.id`, `created_at`, `updated_at` | Untouched |
| `video.video_id` (business code) | Kept as the code; no longer unique across all rows, but still unique among legacy rows through a partial index |
| `title`, `cid`, `release_date`, `jancode`, `maker_product`, `floor_code` | Kept. A new upload whose code matches existing rows is prefilled from the oldest matching row and stays editable |
| `duration` | Kept as integer seconds; the probe step writes the rounded duration for every new upload |
| `video_m3u8` (`fk_id`, `m3u8_url`) | Kept as is; the finalizer inserts one row per finished upload |
| Link tables (genre, actress, director, maker, label, series, aka, image and sample URLs) | Rows are copied from the prefill source when the new video row is created; otherwise the new row starts with none |
| Engagement tables (comment, reaction, view, watch history, playlist, recommendation) | Stay on the legacy row; new rows start at zero |

The prefill happens server-side inside `POST /api/v1/videos` when the request names a code that already exists (an optional `copy_metadata_from` field lets the user pick a different source row).

### Phases

Each phase can be deployed on its own and the app keeps working between phases. Everything is additive until the unique constraint is dropped in phase 3.

#### Phase 0: audit (no changes)

- Find every query or ORM call that assumes one row per `video_id` code: lookups that expect a single result, upserts keyed on the code, import jobs. Each must either tolerate several rows or filter on `origin` or `public_id`.
- Record baseline counts for `video`, `video_m3u8` and every table that references `video.id`.
- Take a backup and rehearse all phases on a restored copy.

#### Phase 1: expand (additive, no downtime)

Add the upload columns to `video` and create the rendition table. Existing rows get `origin = 'legacy'`, and the default for `public_id` is set now so any row inserted from here on gets one.

```sql
ALTER TABLE video
  ADD COLUMN origin varchar(20) NOT NULL DEFAULT 'legacy',
  ADD COLUMN public_id uuid,
  ADD COLUMN uploader_id integer,   -- REFERENCES your user table
  ADD COLUMN original_filename text,
  ADD COLUMN source_key text,
  ADD COLUMN source_bytes bigint,
  ADD COLUMN status varchar(20),
  ADD COLUMN width integer,
  ADD COLUMN height integer,
  ADD COLUMN fps numeric,
  ADD COLUMN video_codec varchar(50),
  ADD COLUMN audio_codec varchar(50),
  ADD COLUMN error_code varchar(50),
  ADD COLUMN error_message text,
  ADD COLUMN ready_at timestamp;

ALTER TABLE video ALTER COLUMN public_id SET DEFAULT gen_random_uuid();

CREATE TABLE video_rendition (
  id serial PRIMARY KEY,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  video_id integer NOT NULL REFERENCES video(id) ON DELETE CASCADE,
  label varchar(10) NOT NULL,
  width integer NOT NULL, height integer NOT NULL, video_kbps integer NOT NULL,
  playlist_key text, segment_count integer,
  status varchar(20) NOT NULL DEFAULT 'PENDING',
  progress_pct smallint NOT NULL DEFAULT 0,
  attempt smallint NOT NULL DEFAULT 0,
  CONSTRAINT uq_video_rendition_video_label UNIQUE (video_id, label)
);
CREATE INDEX ix_video_rendition_video_id ON video_rendition (video_id);
```

The `video_id` column in `video_rendition` follows the same convention as `comment.video_id`: it is the foreign key to `video.id`, not the business code.

#### Phase 2: backfill (batched)

```sql
-- run per id range, for example 10,000 rows at a time
UPDATE video SET public_id = gen_random_uuid()
 WHERE public_id IS NULL AND id BETWEEN :lo AND :hi;

UPDATE video v SET status = 'READY', ready_at = v.updated_at
 WHERE v.status IS NULL AND v.id BETWEEN :lo AND :hi
   AND EXISTS (SELECT 1 FROM video_m3u8 m WHERE m.fk_id = v.id);
```

Legacy rows with a playlist become `READY`. Legacy rows without one keep a NULL status, meaning catalog-only. Repeat until no row has a NULL `public_id`.

#### Phase 3: switch

1. Deploy the new upload code behind a feature flag. It inserts a `video` row with `origin = 'upload'`, runs prefill, writes status and progress on that row, and writes renditions to `video_rendition`.
2. Run the index and constraint changes below. Create the legacy partial unique index before dropping the old constraint, so legacy codes are never without a uniqueness guarantee.
3. Turn the flag on.

```sql
-- the CONCURRENTLY statements cannot run inside a transaction
CREATE UNIQUE INDEX CONCURRENTLY uq_video_public_id ON video (public_id);
CREATE UNIQUE INDEX CONCURRENTLY uq_video_legacy_video_id
  ON video (video_id) WHERE origin = 'legacy';
CREATE INDEX CONCURRENTLY ix_video_status ON video (status);
CREATE INDEX CONCURRENTLY ix_video_uploader_id ON video (uploader_id);

ALTER TABLE video ALTER COLUMN public_id SET NOT NULL;
ALTER TABLE video DROP CONSTRAINT uq_video_video_id;
```

Lookups by code keep working through the existing `ix_video_public_video_video_id` index and the trigram indexes; they can now return several rows.

#### Phase 4: clean up (after a stable period, for example two weeks)

- Add a check constraint limiting `status` to the allowed values.
- Optionally add an admin tool to group or merge rows that share a code, which is how Model B can later move toward Model A without losing data.

### Risks, verification and rollback

| Risk | Mitigation |
| --- | --- |
| Search and browse show the same title several times | Group listings by code (a window function or `DISTINCT ON (video_id)`) and show "N versions"; prefer the legacy row, then the newest READY upload |
| Code that expects one row per code breaks | Phase 0 audit and tests with duplicate codes; the legacy partial unique index keeps existing import paths safe |
| Engagement is split across copies | Accepted trade-off of Model B: new rows start at zero. A later merge tool can re-point the foreign keys |
| Metadata drifts between copies | Prefill at creation; optionally add an admin action that re-syncs a row from its source |
| `video` becomes wider | About 15 added columns, mostly NULL for legacy rows, which costs little in PostgreSQL |

#### Verification after each phase

- Row counts of `video`, `video_m3u8` and every table referencing `video.id` equal the Phase 0 baseline.
- After Phase 2, no row has a NULL `public_id`.
- Ten spot-checked legacy videos still play.
- An end-to-end test upload creates one `video` row with `origin = 'upload'`, its `video_rendition` rows and one `video_m3u8` row, and plays.
- Two uploads with the same code both succeed, while inserting a duplicate legacy code still fails.
- `EXPLAIN` of the code lookup and the title search shows the same index use as before.

#### Rollback

- The feature flag is the first rollback: turning it off stops new uploads and leaves the schema in place.
- Before any upload row exists, the new columns, table and indexes can be dropped with no data loss, and the original constraint restored.
- Once uploads exist, restoring the constraint is only possible when no two rows share a code, so export the upload rows first, then delete or re-code them.

```sql
-- only possible when no two rows share a code
ALTER TABLE video ADD CONSTRAINT uq_video_video_id UNIQUE (video_id);
```

## Migration plan: move stream storage to the `streams` bucket

This plan moves every existing video folder from the `video-samples` bucket into a new `streams` bucket with `mc mv`, one folder at a time, so only about one folder of extra disk space is needed. Each folder's database row is repointed right after it moves. No file is changed. The plan is independent of the Model A or Model B choice above; the one place it touches Model B is the `public_id` backfill in phase 3.

### Current state

- One MinIO bucket, `video-samples`, with one folder per video named by a UUID such as `0703d5f7-ac41-55a4-9a3d-3ecc275b308e`.
- Each folder holds `index.m3u8` (the 328 B master playlist), four rendition folders (`1080p`, `720p`, `480p`, `360p`) each with `playlist.m3u8` and `seg_N.ts` MPEG-TS segments, a `samples/` folder of `sample_NN.jpg` images, and `review.mp4` (97 MiB).
- `video_m3u8.m3u8_url` stores a full URL with a hard-coded LAN address: `http://10.0.0.157:9000/video-samples/{uuid}/index.m3u8`. Sixteen rows point at MinIO. The one row on an external host (`id` 1, `fk_id` 16725) is out of scope and stays untouched.
- The folder UUID is not `video.id` (video 42 maps to folder `0703d5f7...`). The only link between a video and its folder is the URL, so the migration reads folder names from the URLs and never recomputes them.

### Migration Decisions

| Decision | Recommendation | Why |
| --- | --- | --- |
| What `streams` means | A new bucket named `streams` on the same MinIO | Matches the layout used in this doc. If you meant a prefix inside `video-samples`, the steps are the same with copies inside one bucket and URLs ending `/video-samples/streams/{uuid}/` |
| Key inside `streams` | Keep each existing UUID folder name, `streams/{uuid}/...`, and store it as `video.public_id` for that legacy row. New uploads also use `streams/{public_id}/` | One rule for old and new rows, and no folder is renamed |
| What moves | The whole folder as is, including `samples/` and `review.mp4` | The old bucket can then be retired. Splitting samples or review clips into other buckets can be a later change |
| Playlist contents | No rewriting | Relative paths keep working in the new location; phase 1 checks that no playlist holds an absolute URL |
| File names and segment format of existing videos | Unchanged (`index.m3u8`, `{label}/playlist.m3u8`, `seg_N.ts`) | Renaming would force rewriting every playlist. The database stores the full URL, so old and new naming can coexist. For new uploads, using the same master and playlist names keeps tooling uniform; the segment format can stay fMP4 |
| Base URL | Replace the LAN IP with a hostname held in one setting (`STREAMS_BASE_URL`) | The current URLs fail outside the LAN |
| Move method | mc mv, one folder at a time, with the database row updated right after each folder | Peak extra space is about one folder (roughly 9 GiB) instead of a 137 GiB copy. The source is deleted as it moves, so every folder is counted before and after and a backup must exist for anything irreplaceable |

Layout after the move:

```txt
streams/{public_id}/index.m3u8
streams/{public_id}/{label}/playlist.m3u8
streams/{public_id}/{label}/seg_{n}.ts
streams/{public_id}/samples/sample_{nn}.jpg
streams/{public_id}/review.mp4
```

### Migration Phases

`mc mv` copies each object and then deletes the source, so nothing can be recovered from the old bucket once a folder has moved. Each folder is therefore verified as it goes, and the script stops at the first mismatch.

#### Phase 0: prepare and audit

- Confirm a backup exists for anything that cannot be rebuilt (another disk, or an `mc mirror` to other storage). After the move, no second copy remains on this MinIO.
- Check free space. A move needs room for about one folder at a time, so find the largest folder with `mc du` and keep that much free, plus margin.
- Create the `streams` bucket with the same access policy as `video-samples` (its access shows as CUSTOM, so export that policy and apply it unchanged) plus CORS for the player's origin.
- Before anything moves, check that no playlist holds an absolute URL; any that does must be fixed first.
- Find every other place that mentions the old bucket: URL columns in `video_image_url`, `video_sample_image_url` and `video_sample_movie_url` (column names are not in the pasted schema), application config, worker settings and scripts.
- Rehearse on the smallest folder: move it, play it, move it back.

```bash
mc mb local/streams
mc anonymous get-json local/video-samples > policy.json   # review, then apply to streams
mc anonymous set-json policy.json local/streams

mc du local/video-samples/{uuid}                          # find the largest folder

for u in $(mc ls local/video-samples | awk '{print $NF}'); do
  echo "$u $(mc cat local/video-samples/${u}index.m3u8 | grep -c http)"
done                                                      # every count must be 0
```

```sql
SELECT count(*) FROM video_m3u8 WHERE m3u8_url LIKE '%/video-samples/%';  -- expect 16
-- repeat the same LIKE check on each URL column of the other URL tables
```

#### Phase 1: switch writers

Point the pipeline at the new buckets before moving anything: output bucket `streams`, raw bucket `raw-uploads`, public base `STREAMS_BASE_URL`. New uploads then land in `streams/{public_id}/` and nothing writes to the old bucket while folders are moving.

#### Phase 2: move and repoint, folder by folder

Take a backup of the table first. The script then moves each folder, checks that the object count at the destination equals what the source and destination held before, and only then updates that folder's row. The external row does not match the filter. If the script is interrupted, run it again: it continues with whatever is left in the old folder, and the count check accounts for what has already moved.

```sql
CREATE TABLE video_m3u8_bak_20261018 AS SELECT * FROM video_m3u8;
```

```bash
set -euo pipefail
cnt() { mc ls --recursive --summarize "$1" 2>/dev/null | awk '/Total Objects/ {print $3}'; }

psql -At -F' ' -c "SELECT id, substring(m3u8_url from '/video-samples/([0-9a-f-]{36})/')
                    FROM video_m3u8
                   WHERE m3u8_url LIKE 'http://10.0.0.157:9000/video-samples/%'
                   ORDER BY id" |
while read -r row_id uuid; do
  src=$(cnt local/video-samples/$uuid/); dst=$(cnt local/streams/$uuid/)
  mc mv --recursive local/video-samples/$uuid/ local/streams/$uuid/
  [ "$(cnt local/streams/$uuid/)" = "$(( ${src:-0} + ${dst:-0} ))" ] || { echo "count mismatch: $uuid"; exit 1; }
  psql -c "UPDATE video_m3u8
              SET m3u8_url = replace(m3u8_url, '/video-samples/', '/streams/'),
                  updated_at = now()
            WHERE id = $row_id"
done
```

Other URL tables found in phase 0 get the same kind of `replace`, each with its own backup table. To use a hostname instead of the LAN IP, change the host in the same `replace`.

#### Phase 3: record the folder as `public_id` (Model B)

This runs inside the Model B backfill and replaces the random-UUID step for these sixteen rows. Rows without a MinIO folder still get `gen_random_uuid()`.

```sql
UPDATE video v
   SET public_id = substring(m.m3u8_url from '/streams/([0-9a-f-]{36})/')::uuid
  FROM video_m3u8 m
 WHERE m.fk_id = v.id
   AND m.m3u8_url LIKE '%/streams/%'
   AND v.public_id IS NULL;
```

#### Phase 4: verify and soak (one to two weeks)

Run the verification checks below, then watch for 404s on `streams` and for any requests still using `/video-samples/` paths (`mc admin trace` or the MinIO audit log). Old URLs stop working the moment a folder moves. If any client may still hold one (cached API responses, open tabs), add a temporary proxy rule that rewrites `/video-samples/{uuid}/` to `/streams/{uuid}/` for the soak period.

#### Phase 5: retire the old bucket

When `mc ls local/video-samples` shows nothing and no old paths are being requested, remove the empty bucket. Without `--force` the command refuses to delete a bucket that still holds objects, which is the safety check. Keep the backup table for 30 days.

```bash
mc rb local/video-samples
```

### Migration Risks, Verification and Rollback

| Risk | Mitigation |
| --- | --- |
| Source objects are deleted as they move | An external backup for anything irreplaceable; a rehearsal on the smallest folder; the per-folder count check stops the script on a mismatch; an interrupted move is re-run and continues |
| Not enough disk | Only about one folder is duplicated at a time; the largest folder is checked in phase 0 |
| Old URLs stop working immediately | The gap is a few seconds per folder; an optional temporary proxy rewrite covers clients holding old URLs |
| Hard-coded LAN IP in stored URLs | Move the host into `STREAMS_BASE_URL` and use a hostname, so the next host change is one `replace` |
| Playlists containing absolute URLs | The phase 0 pre-check, run before anything moves |
| Writers still using the old bucket during the move | Phase 1 switches writers first |
| Wrong content types break playback | Compare `mc stat` output of a playlist and a segment on the rehearsal folder; `.m3u8` should be `application/vnd.apple.mpegurl` and `.ts` `video/mp2t` |
| Other tables or code still use the old bucket URL | The phase 0 audit and the 404 watch during the soak |

#### Verification

- For every folder, the object count in `streams/{uuid}/` equals the count recorded before the move (the script enforces this), and `mc ls local/video-samples` is empty at the end.
- All sixteen repointed rows return HTTP 200 for the master, every rendition playlist, and the first and last segment.
- Three videos play end to end in the real player from the new URLs.
- `video_m3u8` has the same number of rows as before, and none of the sixteen URLs contains `/video-samples/`.
- After phase 3, each of the sixteen videos has a `public_id` equal to its folder name.

#### Migration Rollback

- A move is reversible with the same low space need. For one folder, move it back and restore its URL from the backup table.

```bash
mc mv --recursive local/streams/{uuid}/ local/video-samples/{uuid}/
```

- For a full rollback, repeat that for each of the sixteen folders (recreate the old bucket first if it was already removed), then restore all URLs:

```sql
UPDATE video_m3u8 m SET m3u8_url = b.m3u8_url, updated_at = now()
  FROM video_m3u8_bak_20261018 b WHERE b.id = m.id;
```

## Implementation order

Build from the data outward: storage and database first (they hold the existing 16 videos and everything else depends on them), then the API, queue, worker, progress, and finally the frontend polish and hardening. Each step ends with something you can check by hand, so a problem shows up in the step that caused it. This order assumes Model B, the `streams` bucket replacing `video-samples`, and the stack named earlier: MinIO, PostgreSQL, RabbitMQ, Redis, ffmpeg workers, an API server and a web frontend with hls.js.

| Step | Build | Stack | Depends on | Done when |
| --- | --- | --- | --- | --- |
| 0 | Local environment and settings | Docker Compose with MinIO, PostgreSQL, RabbitMQ, Redis; one settings file holding bucket names, `STREAMS_BASE_URL` and queue names; a database backup | Nothing | The full stack starts with one command, and a restored copy of the database is available for rehearsals |
| 1 | Storage move | MinIO: create `streams` and `raw-uploads`; policies (`streams` public read, `raw-uploads` private); CORS; then the storage migration phases 0 to 2 | Step 0 | All sixteen existing videos play from `streams` URLs and `video-samples` is empty |
| 2 | Database expand and backfill | PostgreSQL: Model B phases 1 and 2, `video_rendition`, then the `public_id` backfill from folder names | Step 1 for the `public_id` backfill | Row counts match the baseline, the existing app still works, and each legacy video's `public_id` equals its folder name |
| 3 | API skeleton | API server: authentication, `POST /api/v1/videos` with metadata prefill, presigned multipart URLs, `/complete`; publish the contract as an OpenAPI file | Step 2 | A real large file uploaded with a script lands in `raw-uploads`, and its row moves to `UPLOADED` |
| 4 | Queue | RabbitMQ: durable queue, dead-letter queue, retry policy; publish one message on `/complete`; a stub consumer that only logs | Step 3 | A message arrives once per upload, and a forced failure ends in the dead-letter queue |
| 5 | Worker, first version | ffmpeg container: probe, ladder planner (capped at 1080p), encode renditions one after another, upload to `streams`, write the master, finalize in one transaction with the `video_m3u8` row | Steps 1 to 4 | An uploaded MP4 and MKV each end `READY` and play from the new URL; the planner passes tests for 480p, 900p, 1080p and 4K sources |
| 6 | Progress | Redis hash and pub/sub; worker reads ffmpeg `-progress`; API status endpoint and Server-Sent Events, with polling as fallback | Step 5 | The percentage rises steadily during an encode and reaches 100 at `READY` |
| 7 | Frontend | Upload component (parallel parts, resume, progress), status view on the event stream, player on hls.js using the primary playlist | The API contract from step 3 | A user can upload, watch progress and play, with no manual steps |
| 8 | Hardening | One task per rendition with a finalizer, retries and idempotent outputs, stuck-job reaper, worker autoscaling, sandboxing and time limits for ffmpeg, upload quotas and rate limits | Steps 5 and 6 | Killing a worker mid-encode still ends in `READY`, and a corrupt file ends in a clear `FAILED` code |
| 9 | Observability and tuning | Metrics for queue depth, encode time per minute of video and failure codes; alerts; a load test with several large sources; bitrate tuning with VMAF | Step 8 | Dashboards show a full run, and the load test meets the targets in the requirements |
| 10 | Cleanup | End the storage soak, remove the old bucket, finish Model B phases 3 and 4 | Steps 1, 2 and 9 | No request touches `video-samples`, and the old unique constraint is gone |

**Why storage and database come first.** Both are the only steps that touch existing data, they need no new application code, and every later component writes into them. Doing them first also removes the hard-coded LAN address from stored URLs before new code starts producing URLs.

**What can run in parallel.** After step 3 fixes the API contract, the frontend (step 7) can be built against mocks while steps 4 to 6 are built. The worker's ladder planner and probe logic in step 5 can also be written and tested with sample files as soon as step 0 exists.

**What to defer.** Fan-out per rendition, autoscaling, subtitles, multiple audio tracks, higher-than-1080p ladders and DRM are not needed for a first working path and are covered by steps 8 and 9 or the later phases in this doc.
