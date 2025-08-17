-- CASCADE 제약조건 적용 스크립트
-- 기존 제약조건을 CASCADE로 변경

BEGIN;

-- 1. blogs 테이블 - users 참조
ALTER TABLE blogs 
DROP CONSTRAINT IF EXISTS "FK_50205032574e0b039d655f6cfd3";

ALTER TABLE blogs 
ADD CONSTRAINT "FK_50205032574e0b039d655f6cfd3" 
FOREIGN KEY ("userId") 
REFERENCES users(id) 
ON DELETE CASCADE;

-- 2. files 테이블 - users 참조  
ALTER TABLE files 
DROP CONSTRAINT IF EXISTS "FK_a7435dbb7583938d5e7d1376041";

ALTER TABLE files 
ADD CONSTRAINT "FK_a7435dbb7583938d5e7d1376041" 
FOREIGN KEY (user_id) 
REFERENCES users(id) 
ON DELETE CASCADE;

-- 3. posts 테이블 - blogs 참조
ALTER TABLE posts 
DROP CONSTRAINT IF EXISTS "FK_55d9c167993fed3f375391c8e31";

ALTER TABLE posts 
ADD CONSTRAINT "FK_55d9c167993fed3f375391c8e31" 
FOREIGN KEY ("blogId") 
REFERENCES blogs(id) 
ON DELETE CASCADE;

-- 4. posts 테이블 - users(author) 참조
ALTER TABLE posts 
DROP CONSTRAINT IF EXISTS "FK_c4f9a7bd77b489e711277ee5986";

ALTER TABLE posts 
ADD CONSTRAINT "FK_c4f9a7bd77b489e711277ee5986" 
FOREIGN KEY ("authorId") 
REFERENCES users(id) 
ON DELETE CASCADE;

-- 5. api_keys 테이블 - blogs 참조
ALTER TABLE api_keys 
DROP CONSTRAINT IF EXISTS "FK_ea832c070ef3f903d1db1ce7b9d";

ALTER TABLE api_keys 
ADD CONSTRAINT "FK_ea832c070ef3f903d1db1ce7b9d" 
FOREIGN KEY ("blogId") 
REFERENCES blogs(id) 
ON DELETE CASCADE;

-- 6. api_keys 테이블 - users 참조
ALTER TABLE api_keys 
DROP CONSTRAINT IF EXISTS "FK_6c2e267ae764a9413b863a29342";

ALTER TABLE api_keys 
ADD CONSTRAINT "FK_6c2e267ae764a9413b863a29342" 
FOREIGN KEY ("userId") 
REFERENCES users(id) 
ON DELETE CASCADE;

-- 7. comments 테이블 - posts 참조
ALTER TABLE comments 
DROP CONSTRAINT IF EXISTS "FK_e44ddaaa6d058cb4092f83ad61f";

ALTER TABLE comments 
ADD CONSTRAINT "FK_e44ddaaa6d058cb4092f83ad61f" 
FOREIGN KEY ("postId") 
REFERENCES posts(id) 
ON DELETE CASCADE;

-- 8. comments 테이블 - users(author) 참조
ALTER TABLE comments 
DROP CONSTRAINT IF EXISTS "FK_4548cc4a409b8651ec75f70e280";

ALTER TABLE comments 
ADD CONSTRAINT "FK_4548cc4a409b8651ec75f70e280" 
FOREIGN KEY ("authorId") 
REFERENCES users(id) 
ON DELETE CASCADE;

-- 9. post_likes 테이블 - posts 참조
ALTER TABLE post_likes 
DROP CONSTRAINT IF EXISTS "FK_6199f13e2ff401739b476841eae";

ALTER TABLE post_likes 
ADD CONSTRAINT "FK_6199f13e2ff401739b476841eae" 
FOREIGN KEY ("postId") 
REFERENCES posts(id) 
ON DELETE CASCADE;

-- 10. post_likes 테이블 - users 참조
ALTER TABLE post_likes 
DROP CONSTRAINT IF EXISTS "FK_37d337ad54b1aa6b9a44415a498";

ALTER TABLE post_likes 
ADD CONSTRAINT "FK_37d337ad54b1aa6b9a44415a498" 
FOREIGN KEY ("userId") 
REFERENCES users(id) 
ON DELETE CASCADE;

-- 11. comment_likes 테이블 - comments 참조
ALTER TABLE comment_likes 
DROP CONSTRAINT IF EXISTS "FK_abbd506a94a424dd6a3a68d26f4";

ALTER TABLE comment_likes 
ADD CONSTRAINT "FK_abbd506a94a424dd6a3a68d26f4" 
FOREIGN KEY ("commentId") 
REFERENCES comments(id) 
ON DELETE CASCADE;

-- 12. comment_likes 테이블 - users 참조
ALTER TABLE comment_likes 
DROP CONSTRAINT IF EXISTS "FK_34d1f902a8a527dbc2502f87c88";

ALTER TABLE comment_likes 
ADD CONSTRAINT "FK_34d1f902a8a527dbc2502f87c88" 
FOREIGN KEY ("userId") 
REFERENCES users(id) 
ON DELETE CASCADE;

COMMIT;

-- 확인
SELECT 
    tc.table_name, 
    tc.constraint_name,
    rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.referential_constraints rc 
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name;