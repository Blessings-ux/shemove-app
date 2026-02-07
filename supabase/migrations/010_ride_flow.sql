-- RIDE FLOW MIGRATION
-- Run this in Supabase SQL Editor

-- 1. Add timestamp columns for ride lifecycle
ALTER TABLE public.rides 
ADD COLUMN IF NOT EXISTS driver_arrived_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS ride_started_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS ride_completed_at timestamp with time zone;

-- 2. Add rating columns
ALTER TABLE public.rides
ADD COLUMN IF NOT EXISTS passenger_rating integer CHECK (passenger_rating >= 1 AND passenger_rating <= 5),
ADD COLUMN IF NOT EXISTS driver_rating integer CHECK (driver_rating >= 1 AND driver_rating <= 5),
ADD COLUMN IF NOT EXISTS rating_comment text;

-- 3. Update status constraint to include new statuses
-- First, drop the existing constraint if it exists
DO $$
BEGIN
  ALTER TABLE public.rides DROP CONSTRAINT IF EXISTS rides_status_check;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

-- Add new constraint with all statuses
ALTER TABLE public.rides 
ADD CONSTRAINT rides_status_check 
CHECK (status IN ('pending', 'accepted', 'arrived', 'in_progress', 'completed', 'cancelled'));

-- Done!
SELECT 'Ride flow columns added successfully!' as status;
