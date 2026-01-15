-- Add ride_type column to rides table for Carpooling
ALTER TABLE public.rides 
ADD COLUMN IF NOT EXISTS ride_type text CHECK (ride_type IN ('solo', 'shared')) DEFAULT 'solo';

-- Index for analytics/filtering
CREATE INDEX IF NOT EXISTS idx_rides_ride_type ON public.rides(ride_type);
