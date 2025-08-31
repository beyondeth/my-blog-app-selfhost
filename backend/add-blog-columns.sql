-- Add isPublic and allowComments columns to blogs table
ALTER TABLE blogs 
ADD COLUMN IF NOT EXISTS "isPublic" boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS "allowComments" boolean DEFAULT true;

-- Update existing rows to have default values if needed
UPDATE blogs 
SET "isPublic" = true 
WHERE "isPublic" IS NULL;

UPDATE blogs 
SET "allowComments" = true 
WHERE "allowComments" IS NULL;