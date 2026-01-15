-- IMPORTANT: Run this in Supabase SQL Editor to fix the carpool_offers table
-- The geography columns need to be made optional (nullable) for inserts to work

-- Make pickup_location and dropoff_location nullable (allow NULL)
ALTER TABLE public.carpool_offers 
  ALTER COLUMN pickup_location DROP NOT NULL,
  ALTER COLUMN dropoff_location DROP NOT NULL;

-- Verify the table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'carpool_offers';
