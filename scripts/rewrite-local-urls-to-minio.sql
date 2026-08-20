-- Rewrite local disk paths in media tables to MinIO (or any S3-compatible)
-- public URLs. Run after objects are already in the bucket.
--
-- Usage:
--   psql "$DATABASE_URL" \
--     -v local_prefix='/path/prefix/' \
--     -v public_base='http://localhost:9000/video-samples/' \
--     -f scripts/rewrite-local-urls-to-minio.sql
--
-- Or with discrete PG* env and defaults below (edit if needed).
--
-- Path mapping:
--   {local_prefix}{uuid}/index.m3u8
--     → {public_base}{uuid}/index.m3u8
--   {local_prefix}{uuid}/samples/sample_01.jpg
--     → {public_base}{uuid}/samples/sample_01.jpg
--   {local_prefix}{uuid}/review.mp4
--     → {public_base}{uuid}/review.mp4
--
-- Only rows still under local_prefix are updated. http(s) URLs are left alone.

\set ON_ERROR_STOP on

-- Defaults when -v was not passed (psql leaves the name as the value).
SELECT CASE
  WHEN :'local_prefix' = 'local_prefix'
  THEN '/run/media/youknowwho/Jav/hls/'
  ELSE :'local_prefix'
END AS local_prefix \gset

SELECT CASE
  WHEN :'public_base' = 'public_base'
  THEN 'http://localhost:9000/video-samples/'
  ELSE :'public_base'
END AS public_base \gset

-- Normalize trailing slashes once.
SELECT
  rtrim(:'local_prefix', '/') || '/' AS local_prefix,
  rtrim(:'public_base', '/') || '/' AS public_base
\gset

\echo Local prefix : :local_prefix
\echo Public base  : :public_base
\echo

BEGIN;

-- Master HLS playlists
UPDATE public.video_m3u8
SET
  m3u8_url = :'public_base' || substr(m3u8_url, length(:'local_prefix') + 1),
  updated_at = now()
WHERE m3u8_url LIKE :'local_prefix' || '%';

\echo video_m3u8 updated: :ROW_COUNT

-- Sample stills (often under .../hls/<uuid>/samples/...)
UPDATE public.video_sample_image_url
SET
  url = :'public_base' || substr(url, length(:'local_prefix') + 1),
  updated_at = now()
WHERE url LIKE :'local_prefix' || '%';

\echo video_sample_image_url updated: :ROW_COUNT

-- Review / sample movies
UPDATE public.video_sample_movie_url
SET
  url = :'public_base' || substr(url, length(:'local_prefix') + 1),
  updated_at = now()
WHERE url LIKE :'local_prefix' || '%';

\echo video_sample_movie_url updated: :ROW_COUNT

-- Optional: other local roots (e.g. sample_gen outside hls/). Uncomment and set.
-- UPDATE public.video_sample_image_url
-- SET url = :'public_base' || substr(url, length('/run/media/youknowwho/Jav/') + 1),
--     updated_at = now()
-- WHERE url LIKE '/run/media/youknowwho/Jav/%'
--   AND url NOT LIKE 'http%';

COMMIT;

\echo
\echo Sample video_m3u8 after rewrite:
SELECT id, fk_id, m3u8_url
FROM public.video_m3u8
ORDER BY id
LIMIT 5;
