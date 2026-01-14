-- Migration: Add carpool and pricing features
-- Run: Apply via Supabase Dashboard > SQL Editor

-- 1. Add rate_per_km to drivers table (custom pricing per driver)
ALTER TABLE public.drivers ADD COLUMN IF NOT EXISTS rate_per_km numeric DEFAULT 75;

-- 2. Add carpool fields to rides table
ALTER TABLE public.rides 
  ADD COLUMN IF NOT EXISTS seats_booked integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS departure_time timestamp with time zone,
  ADD COLUMN IF NOT EXISTS carpool_offer_id uuid;

-- 3. Create carpool_offers table
CREATE TABLE IF NOT EXISTS public.carpool_offers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  pickup_location geography(Point) NOT NULL,
  dropoff_location geography(Point) NOT NULL,
  pickup_name text,
  dropoff_name text,
  departure_time timestamp with time zone NOT NULL,
  total_seats integer NOT NULL DEFAULT 4,
  available_seats integer NOT NULL DEFAULT 4,
  fare_per_seat numeric NOT NULL,
  vehicle_type text CHECK (vehicle_type IN ('boda', 'tuktuk', 'taxi')) DEFAULT 'taxi',
  status text CHECK (status IN ('open', 'full', 'departed', 'cancelled')) DEFAULT 'open',
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on carpool_offers
ALTER TABLE public.carpool_offers ENABLE ROW LEVEL SECURITY;

-- Policies for carpool_offers
CREATE POLICY "Anyone can view open carpool offers" ON public.carpool_offers 
  FOR SELECT USING (true);

CREATE POLICY "Drivers can create carpool offers" ON public.carpool_offers 
  FOR INSERT WITH CHECK (auth.uid() = driver_id);

CREATE POLICY "Drivers can update own offers" ON public.carpool_offers 
  FOR UPDATE USING (auth.uid() = driver_id);

CREATE POLICY "Drivers can delete own offers" ON public.carpool_offers 
  FOR DELETE USING (auth.uid() = driver_id);

-- Index for finding offers by status and departure time
CREATE INDEX IF NOT EXISTS idx_carpool_offers_status ON public.carpool_offers(status, departure_time);

-- Foreign key from rides to carpool_offers
ALTER TABLE public.rides 
  ADD CONSTRAINT fk_rides_carpool_offer 
  FOREIGN KEY (carpool_offer_id) REFERENCES public.carpool_offers(id) ON DELETE SET NULL;
