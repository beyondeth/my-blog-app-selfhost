-- Check recent posts (last 10) to see if tags are being saved
SELECT
    p.id,
    p.title,
    p.slug,
    p.created_at,
    p.tags as post_tags,
    pm.tags as metadata_tags,
    p.category as post_category,
    pm.category as metadata_category
FROM posts p
LEFT JOIN post_metadata pm ON p.id = pm.post_id
ORDER BY p.created_at DESC
LIMIT 10;

-- Check specifically for posts created by MCP (API key usage tracking)
SELECT
    p.id,
    p.title,
    p.slug,
    p.created_at,
    p.tags as post_tags,
    pm.tags as metadata_tags,
    ut.user_id,
    ut.created_at as mcp_created_at
FROM posts p
LEFT JOIN post_metadata pm ON p.id = pm.post_id
INNER JOIN usage_tracking ut ON p.id::text = ut.details->>'postId'
WHERE ut.action = 'mcp_post_created'
ORDER BY ut.created_at DESC
LIMIT 5;