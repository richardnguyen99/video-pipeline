-- Backfill Model B columns on video from existing video_m3u8 rows.
-- Safe to re-run.
--
-- Sets:
--   public_id  ← UUID folder in streams (or video-samples) m3u8 URL
--   origin     ← 'legacy' when still default/null-ish
--   status     ← 'READY' when a playlist exists
--   ready_at   ← updated_at when status becomes READY and ready_at is null
--
-- Does not insert video_rendition rows (see scripts/pipeline/backfill-video-renditions.sh).

BEGIN;

-- 1) public_id from m3u8 folder UUID (prefer streams, then video-samples)
UPDATE video AS v
SET public_id = sub.folder_uuid::uuid,
    updated_at = now()
FROM (
    SELECT DISTINCT ON (m.fk_id)
        m.fk_id,
        substring(
            m.m3u8_url
            FROM '/(?:streams|video-samples)/([0-9a-fA-F-]{36})/'
        ) AS folder_uuid
    FROM video_m3u8 AS m
    WHERE m.m3u8_url ~ '/(streams|video-samples)/[0-9a-fA-F-]{36}/'
    ORDER BY m.fk_id, m.id
) AS sub
WHERE v.id = sub.fk_id
  AND sub.folder_uuid IS NOT NULL
  AND (v.public_id IS NULL OR v.public_id <> sub.folder_uuid::uuid);

-- 2) Any remaining NULL public_id gets a random UUID
UPDATE video
SET public_id = gen_random_uuid(),
    updated_at = now()
WHERE public_id IS NULL;

-- 3) Ensure origin is set for legacy catalog rows
UPDATE video
SET origin = 'legacy',
    updated_at = now()
WHERE origin IS NULL OR origin = '';

-- 4) Rows with a playlist → READY
UPDATE video AS v
SET status = 'READY',
    ready_at = COALESCE(v.ready_at, v.updated_at),
    updated_at = now()
WHERE (v.status IS NULL OR v.status = '')
  AND EXISTS (
      SELECT 1
      FROM video_m3u8 AS m
      WHERE m.fk_id = v.id
  );

-- Summary
SELECT
    count(*) AS video_rows,
    count(*) FILTER (WHERE public_id IS NOT NULL) AS with_public_id,
    count(*) FILTER (WHERE status = 'READY') AS ready,
    count(*) FILTER (
        WHERE EXISTS (SELECT 1 FROM video_m3u8 m WHERE m.fk_id = video.id)
    ) AS with_m3u8,
    count(*) FILTER (
        WHERE EXISTS (SELECT 1 FROM video_m3u8 m WHERE m.fk_id = video.id)
          AND public_id = (
              SELECT substring(m2.m3u8_url FROM '/(?:streams|video-samples)/([0-9a-fA-F-]{36})/')::uuid
              FROM video_m3u8 m2
              WHERE m2.fk_id = video.id
              ORDER BY m2.id
              LIMIT 1
          )
    ) AS public_id_matches_folder
FROM video;

SELECT v.id, v.video_id, v.public_id, v.status, v.origin, m.m3u8_url
FROM video v
JOIN video_m3u8 m ON m.fk_id = v.id
ORDER BY v.id;

COMMIT;
