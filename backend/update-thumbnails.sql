-- 기존 포스트들의 썸네일 URL 업데이트 스크립트

-- 개발 환경에서는 S3 직접 URL, 프로덕션에서는 CDN URL 사용
UPDATE posts
SET thumbnail = CASE
    -- 파일이 있는 경우에만 업데이트
    WHEN thumbnail_image_id IS NOT NULL THEN
        CASE
            -- 개발 환경
            WHEN 'development' = current_setting('app.is_development', true) THEN
                'https://axricjc5utqz.compat.objectstorage.ap-singapore-1.oraclecloud.com/aigory-blog-prod-media/' ||
                (SELECT file_key FROM files WHERE id = posts.thumbnail_image_id)
            -- 프로덕션 환경 (CDN)
            ELSE
                'https://cdn.aigory.com/' ||
                (SELECT file_key FROM files WHERE id = posts.thumbnail_image_id)
        END ||
        -- 캐시 버스팅 타임스탬프 추가
        CASE
            WHEN posts.updated_at IS NOT NULL THEN
                '?v=' || EXTRACT(EPOCH FROM posts.updated_at)::bigint
            ELSE ''
        END
    ELSE NULL
END
WHERE thumbnail_image_id IS NOT NULL
  AND (thumbnail IS NULL OR thumbnail = '');

-- 업데이트된 건수 확인
SELECT
    COUNT(*) as updated_count,
    COUNT(CASE WHEN thumbnail IS NOT NULL THEN 1 END) as with_thumbnail
FROM posts
WHERE thumbnail_image_id IS NOT NULL;