-- Add columns for Carpooling and Fare tracking
-- Run this in Supabase SQL Editor

-- Add carpool and fare columns to rides table
ALTER TABLE rides 
ADD COLUMN IF NOT EXISTS is_carpool boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS estimated_fare numeric,
ADD COLUMN IF NOT EXISTS distance_km numeric,
ADD COLUMN IF NOT EXISTS seats_requested int DEFAULT 1;

-- Enable realtime for rides table (for driver notifications)
ALTER PUBLICATION supabase_realtime ADD TABLE rides;

-- Create index for faster pending ride queries
CREATE INDEX IF NOT EXISTS idx_rides_status ON rides(status);
CREATE INDEX IF NOT EXISTS idx_rides_driver ON rides(driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_pending ON rides(status) WHERE status = 'pending';
