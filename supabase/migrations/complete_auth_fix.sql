-- COMPLETE AUTH FIX FOR ALL ROLES
-- Run this ENTIRE script in Supabase SQL Editor

-- =====================================================
-- STEP 1: Drop the existing user_role enum if it's causing issues
-- and recreate profiles table with TEXT type for role
-- =====================================================

-- First, check if enum exists and what values it has
DO $$
BEGIN
  -- Try to add fleet_owner to the enum if it exists
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    BEGIN
      ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'fleet_owner';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not add fleet_owner to enum';
    END;
  END IF;
END $$;

-- =====================================================
-- STEP 2: Recreate the profiles table with TEXT role
-- (This is safer and avoids enum issues)
-- =====================================================

-- Drop the old table if it uses enum (backup data first if needed)
-- We'll recreate with TEXT type
DROP TABLE IF EXISTS public.profiles CASCADE;

CREATE TABLE public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL PRIMARY KEY,
  role text CHECK (role IN ('passenger', 'driver', 'admin', 'fleet_owner')) NOT NULL DEFAULT 'passenger',
  full_name text,
  phone text,
  loyalty_points integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- =====================================================
-- STEP 3: Recreate the drivers table (depends on profiles)
-- =====================================================

DROP TABLE IF EXISTS public.drivers CASCADE;

CREATE TABLE public.drivers (
  id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL PRIMARY KEY,
  vehicle_type text CHECK (vehicle_type IN ('boda', 'tuktuk', 'taxi')),
  plate_number text,
  is_online boolean DEFAULT false,
  owner_id uuid REFERENCES public.profiles(id),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "drivers_select_all" ON public.drivers FOR SELECT USING (true);
CREATE POLICY "drivers_insert_own" ON public.drivers FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "drivers_update_own" ON public.drivers FOR UPDATE USING (auth.uid() = id);

-- =====================================================
-- STEP 4: Recreate the trigger for new user signup
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
DECLARE
  user_role text;
BEGIN
  -- Get role from metadata, default to 'passenger'
  user_role := COALESCE(new.raw_user_meta_data->>'role', 'passenger');
  
  -- Validate role is one of allowed values
  IF user_role NOT IN ('passenger', 'driver', 'admin', 'fleet_owner') THEN
    user_role := 'passenger';
  END IF;
  
  INSERT INTO public.profiles (id, full_name, role, phone)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    user_role,
    new.raw_user_meta_data->>'phone'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- =====================================================
-- STEP 5: Create profiles for existing users
-- =====================================================

INSERT INTO public.profiles (id, role, full_name, phone)
SELECT 
  id, 
  COALESCE(raw_user_meta_data->>'role', 'passenger'),
  COALESCE(raw_user_meta_data->>'full_name', email),
  raw_user_meta_data->>'phone'
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- STEP 6: Create other required tables
-- =====================================================

-- Driver locations
CREATE TABLE IF NOT EXISTS public.driver_locations (
  driver_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL PRIMARY KEY,
  location geography(Point),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "driver_locations_select_all" ON public.driver_locations;
DROP POLICY IF EXISTS "driver_locations_insert_own" ON public.driver_locations;
DROP POLICY IF EXISTS "driver_locations_update_own" ON public.driver_locations;
CREATE POLICY "driver_locations_select_all" ON public.driver_locations FOR SELECT USING (true);
CREATE POLICY "driver_locations_insert_own" ON public.driver_locations FOR INSERT WITH CHECK (auth.uid() = driver_id);
CREATE POLICY "driver_locations_update_own" ON public.driver_locations FOR UPDATE USING (auth.uid() = driver_id);

-- Rides
CREATE TABLE IF NOT EXISTS public.rides (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  passenger_id uuid REFERENCES public.profiles(id) NOT NULL,
  driver_id uuid REFERENCES public.profiles(id),
  pickup_location geography(Point) NOT NULL,
  dropoff_location geography(Point) NOT NULL,
  status text CHECK (status IN ('pending', 'accepted', 'ongoing', 'completed', 'cancelled')) DEFAULT 'pending',
  fare numeric DEFAULT 0,
  payment_status text CHECK (payment_status IN ('unpaid', 'paid')) DEFAULT 'unpaid',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rides_select_all" ON public.rides;
DROP POLICY IF EXISTS "rides_insert_auth" ON public.rides;
DROP POLICY IF EXISTS "rides_update_all" ON public.rides;
CREATE POLICY "rides_select_all" ON public.rides FOR SELECT USING (true);
CREATE POLICY "rides_insert_auth" ON public.rides FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "rides_update_all" ON public.rides FOR UPDATE USING (true);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type text,
  title text,
  message text,
  data jsonb,
  read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_all" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_insert_all" ON public.notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- =====================================================
-- DONE!
-- =====================================================
SELECT 'Authentication setup complete for all roles!' as status;
