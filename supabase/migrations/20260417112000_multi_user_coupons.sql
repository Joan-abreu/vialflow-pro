
-- 1. Add the new array column
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS restricted_to_user_ids UUID[] DEFAULT '{}';

-- 2. Migrate data from the old single-user column to the new array column
UPDATE public.coupons 
SET restricted_to_user_ids = ARRAY[restricted_to_user_id]
WHERE restricted_to_user_id IS NOT NULL;

-- 3. Drop the old column
ALTER TABLE public.coupons DROP COLUMN IF EXISTS restricted_to_user_id;

-- 4. Ensure existing rows have an empty array if NULL
UPDATE public.coupons 
SET restricted_to_user_ids = '{}' 
WHERE restricted_to_user_ids IS NULL;
