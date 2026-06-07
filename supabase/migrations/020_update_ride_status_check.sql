-- Migration to update check constraint on public.rides.status
-- Unconditionally drops the constraint and recreates it with the full list of allowed statuses.
-- This handles databases where rides.status is TEXT, resolving status transition failures.

-- 1. Drop the restrictive constraint
ALTER TABLE public.rides DROP CONSTRAINT IF EXISTS rides_status_check;

-- 2. Re-create the constraint with all required statuses: 
-- 'pending', 'accepted', 'arrived', 'passenger_arrived', 'in_progress', 'completed', 'cancelled'
ALTER TABLE public.rides
ADD CONSTRAINT rides_status_check
CHECK (status::text IN (
  'pending',
  'accepted',
  'arrived',
  'passenger_arrived',
  'in_progress',
  'completed',
  'cancelled'
));

SELECT 'Ride status check constraint updated successfully!' AS status;
