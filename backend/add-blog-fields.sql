-- blogs 테이블에 isPublic과 allowComments 필드 추가
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS "isPublic" BOOLEAN DEFAULT true;
ALTER TABLE blogs ADD COLUMN IF NOT EXISTS "allowComments" BOOLEAN DEFAULT true;