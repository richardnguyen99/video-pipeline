# Video pipeline baseline inventory (Step 0)

Run `scripts/pipeline/inventory-baseline.sh` against a live environment and
paste the output into the sections below. Do not change storage or schema
until this inventory is recorded.

## Environment

| Item | Value |
| --- | --- |
| Date | |
| Postgres database | |
| MinIO endpoint | |
| `object_storage_bucket` (legacy) | `video-samples` |
| Target streams bucket | `streams` |
| Target raw-uploads bucket | `raw-uploads` |

## MinIO buckets and object counts

```text
# paste: mc ls local
# paste: mc ls --recursive --summarize local/video-samples
```

Largest folder under `video-samples` (bytes / object count):

```text
```

Absolute URL check inside playlists (must be 0 http matches per folder):

```text
# paste: for each folder, count of "http" in index.m3u8
```

## PostgreSQL row baselines

| Table | Count |
| --- | --- |
| video | |
| video_m3u8 | |
| video_image_url | |
| video_sample_image_url | |
| video_sample_movie_url | |
| video_reaction | |
| video_view | |
| comment | |
| playlist_video | |

```sql
-- reference queries
SELECT count(*) FROM video;
SELECT count(*) FROM video_m3u8;
SELECT count(*) FROM video_m3u8 WHERE m3u8_url LIKE '%/video-samples/%';
SELECT count(*) FROM video_m3u8 WHERE m3u8_url LIKE '%/streams/%';
```

## Hard-coded URL hosts

| Pattern | Rows |
| --- | --- |
| `http://10.0.0.157:9000/video-samples/` | |
| `http://localhost:9000/video-samples/` | |
| Other hosts in `video_m3u8.m3u8_url` | |

```sql
SELECT
  regexp_replace(m3u8_url, '^(https?://[^/]+).*$', '\1') AS host,
  count(*)
FROM video_m3u8
GROUP BY 1
ORDER BY 2 DESC;
```

## Code that assumes one row per business `video_id`

Search the repo for:

- `get_by_video_id` / unique lookups by `Video.video_id`
- Import / upsert jobs keyed only on the business code
- Any code that would break when multiple rows share a code (Model B)

Findings:

```text
```

## Verification checklist before Step 1

- [ ] Baseline counts recorded
- [ ] Playlist absolute-URL pre-check is clean (or documented exceptions)
- [ ] Backup of Postgres taken
- [ ] MinIO has free space for one largest folder
