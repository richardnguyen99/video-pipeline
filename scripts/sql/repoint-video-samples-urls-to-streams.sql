-- Repoint MinIO URL columns from /video-samples/ to /streams/
-- and repair doubled scheme prefixes (http:http://...).
-- Safe to re-run. Handles unique (fk_id, url) collisions.

BEGIN;

CREATE TABLE IF NOT EXISTS video_m3u8_bak_streams_mig AS
SELECT * FROM video_m3u8 WHERE false;

CREATE TABLE IF NOT EXISTS video_sample_image_url_bak_streams_mig AS
SELECT * FROM video_sample_image_url WHERE false;

CREATE TABLE IF NOT EXISTS video_sample_movie_url_bak_streams_mig AS
SELECT * FROM video_sample_movie_url WHERE false;

CREATE TABLE IF NOT EXISTS video_image_url_bak_streams_mig AS
SELECT * FROM video_image_url WHERE false;

INSERT INTO video_m3u8_bak_streams_mig
SELECT m.* FROM video_m3u8 m
LEFT JOIN video_m3u8_bak_streams_mig b ON b.id = m.id
WHERE b.id IS NULL AND m.m3u8_url LIKE '%/video-samples/%';

INSERT INTO video_sample_image_url_bak_streams_mig
SELECT m.* FROM video_sample_image_url m
LEFT JOIN video_sample_image_url_bak_streams_mig b ON b.id = m.id
WHERE b.id IS NULL
  AND (m.url LIKE '%/video-samples/%' OR m.url ~* '^https?:https?://');

INSERT INTO video_sample_movie_url_bak_streams_mig
SELECT m.* FROM video_sample_movie_url m
LEFT JOIN video_sample_movie_url_bak_streams_mig b ON b.id = m.id
WHERE b.id IS NULL
  AND (m.url LIKE '%/video-samples/%' OR m.url ~* '^https?:https?://');

INSERT INTO video_image_url_bak_streams_mig
SELECT m.* FROM video_image_url m
LEFT JOIN video_image_url_bak_streams_mig b ON b.id = m.id
WHERE b.id IS NULL
  AND (m.url LIKE '%/video-samples/%' OR m.url ~* '^https?:https?://');

-- Drop doubled-scheme rows when the cleaned URL already exists for the same fk_id.
DELETE FROM video_sample_image_url AS d
USING video_sample_image_url AS g
WHERE d.url ~* '^https?:https?://'
  AND g.fk_id = d.fk_id
  AND g.id <> d.id
  AND g.url = regexp_replace(
    d.url,
    '^[Hh][Tt][Tt][Pp][Ss]?:[Hh][Tt][Tt][Pp]([Ss]?)://',
    'http\1://'
  );

DELETE FROM video_sample_movie_url AS d
USING video_sample_movie_url AS g
WHERE d.url ~* '^https?:https?://'
  AND g.fk_id = d.fk_id
  AND g.id <> d.id
  AND g.url = regexp_replace(
    d.url,
    '^[Hh][Tt][Tt][Pp][Ss]?:[Hh][Tt][Tt][Pp]([Ss]?)://',
    'http\1://'
  );

DELETE FROM video_image_url AS d
USING video_image_url AS g
WHERE d.url ~* '^https?:https?://'
  AND g.fk_id = d.fk_id
  AND g.id <> d.id
  AND g.url = regexp_replace(
    d.url,
    '^[Hh][Tt][Tt][Pp][Ss]?:[Hh][Tt][Tt][Pp]([Ss]?)://',
    'http\1://'
  );

-- Fix remaining doubled schemes (no collision).
UPDATE video_sample_image_url
SET url = regexp_replace(url, '^[Hh][Tt][Tt][Pp][Ss]?:[Hh][Tt][Tt][Pp]([Ss]?)://', 'http\1://'),
    updated_at = now()
WHERE url ~* '^https?:https?://';

UPDATE video_sample_movie_url
SET url = regexp_replace(url, '^[Hh][Tt][Tt][Pp][Ss]?:[Hh][Tt][Tt][Pp]([Ss]?)://', 'http\1://'),
    updated_at = now()
WHERE url ~* '^https?:https?://';

UPDATE video_image_url
SET url = regexp_replace(url, '^[Hh][Tt][Tt][Pp][Ss]?:[Hh][Tt][Tt][Pp]([Ss]?)://', 'http\1://'),
    updated_at = now()
WHERE url ~* '^https?:https?://';

UPDATE video_m3u8
SET m3u8_url = regexp_replace(m3u8_url, '^[Hh][Tt][Tt][Pp][Ss]?:[Hh][Tt][Tt][Pp]([Ss]?)://', 'http\1://'),
    updated_at = now()
WHERE m3u8_url ~* '^https?:https?://';

-- Drop /video-samples/ rows when the /streams/ URL already exists for the same fk_id.
DELETE FROM video_sample_image_url AS d
USING video_sample_image_url AS g
WHERE d.url LIKE '%/video-samples/%'
  AND g.fk_id = d.fk_id
  AND g.id <> d.id
  AND g.url = replace(d.url, '/video-samples/', '/streams/');

DELETE FROM video_sample_movie_url AS d
USING video_sample_movie_url AS g
WHERE d.url LIKE '%/video-samples/%'
  AND g.fk_id = d.fk_id
  AND g.id <> d.id
  AND g.url = replace(d.url, '/video-samples/', '/streams/');

DELETE FROM video_image_url AS d
USING video_image_url AS g
WHERE d.url LIKE '%/video-samples/%'
  AND g.fk_id = d.fk_id
  AND g.id <> d.id
  AND g.url = replace(d.url, '/video-samples/', '/streams/');

DELETE FROM video_m3u8 AS d
USING video_m3u8 AS g
WHERE d.m3u8_url LIKE '%/video-samples/%'
  AND g.fk_id = d.fk_id
  AND g.id <> d.id
  AND g.m3u8_url = replace(d.m3u8_url, '/video-samples/', '/streams/');

-- Rewrite remaining /video-samples/ → /streams/
UPDATE video_m3u8
SET m3u8_url = replace(m3u8_url, '/video-samples/', '/streams/'),
    updated_at = now()
WHERE m3u8_url LIKE '%/video-samples/%';

UPDATE video_sample_image_url
SET url = replace(url, '/video-samples/', '/streams/'),
    updated_at = now()
WHERE url LIKE '%/video-samples/%';

UPDATE video_sample_movie_url
SET url = replace(url, '/video-samples/', '/streams/'),
    updated_at = now()
WHERE url LIKE '%/video-samples/%';

UPDATE video_image_url
SET url = replace(url, '/video-samples/', '/streams/'),
    updated_at = now()
WHERE url LIKE '%/video-samples/%';

SELECT 'video_m3u8' AS table_name,
       count(*) FILTER (WHERE m3u8_url LIKE '%/video-samples/%') AS still_old,
       count(*) FILTER (WHERE m3u8_url LIKE '%/streams/%') AS now_streams,
       count(*) FILTER (WHERE m3u8_url ~* '^https?:https?://') AS doubled_scheme
FROM video_m3u8
UNION ALL
SELECT 'video_sample_image_url',
       count(*) FILTER (WHERE url LIKE '%/video-samples/%'),
       count(*) FILTER (WHERE url LIKE '%/streams/%'),
       count(*) FILTER (WHERE url ~* '^https?:https?://')
FROM video_sample_image_url
UNION ALL
SELECT 'video_sample_movie_url',
       count(*) FILTER (WHERE url LIKE '%/video-samples/%'),
       count(*) FILTER (WHERE url LIKE '%/streams/%'),
       count(*) FILTER (WHERE url ~* '^https?:https?://')
FROM video_sample_movie_url
UNION ALL
SELECT 'video_image_url',
       count(*) FILTER (WHERE url LIKE '%/video-samples/%'),
       count(*) FILTER (WHERE url LIKE '%/streams/%'),
       count(*) FILTER (WHERE url ~* '^https?:https?://')
FROM video_image_url
ORDER BY 1;

COMMIT;
