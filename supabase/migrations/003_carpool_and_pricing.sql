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

-- 4. Function to increment loyalty points
CREATE OR REPLACE FUNCTION increment_loyalty_points(user_id uuid, points integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET loyalty_points = COALESCE(loyalty_points, 0) + points
  WHERE id = user_id;
END;
$$;

-- 5. Allow authenticated users to book (update) carpool offers (decrement seats)
CREATE POLICY "Authenticated users can book offers" ON public.carpool_offers 
  FOR UPDATE USING (auth.role() = 'authenticated');

-- 6. Create notifications table for driver/passenger alerts
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL, -- 'carpool_booking', 'ride_request', 'ride_completed', etc.
  title text NOT NULL,
  message text,
  data jsonb DEFAULT '{}',
  read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications" ON public.notifications 
  FOR SELECT USING (auth.uid() = user_id);

-- Authenticated users can create notifications (for cross-user alerts)
CREATE POLICY "Authenticated users can create notifications" ON public.notifications 
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Users can update (mark as read) their own notifications
CREATE POLICY "Users can update own notifications" ON public.notifications 
  FOR UPDATE USING (auth.uid() = user_id);

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, created_at DESC);
