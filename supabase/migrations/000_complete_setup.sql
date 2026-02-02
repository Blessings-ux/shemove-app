-- COMPLETE DATABASE SETUP FOR JIRANIRIDE
-- Run this in Supabase SQL Editor to set up all required tables and triggers

-- 1. Enable PostGIS extension for geolocation
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. PROFILES Table (if not exists)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users NOT NULL PRIMARY KEY,
  role text CHECK (role IN ('passenger', 'driver', 'admin', 'fleet_owner')) NOT NULL DEFAULT 'passenger',
  full_name text,
  phone text,
  loyalty_points integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. Drop all existing policies on profiles (clean slate)
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON public.profiles';
    END LOOP;
END $$;

-- 5. Create simple non-recursive policies
CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 6. DRIVERS Table (if not exists)
CREATE TABLE IF NOT EXISTS public.drivers (
  id uuid REFERENCES public.profiles(id) NOT NULL PRIMARY KEY,
  vehicle_type text CHECK (vehicle_type IN ('boda', 'tuktuk', 'taxi')),
  plate_number text,
  is_online boolean DEFAULT false,
  owner_id uuid REFERENCES public.profiles(id),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

-- Drop and recreate driver policies
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'drivers' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON public.drivers';
    END LOOP;
END $$;

CREATE POLICY "drivers_select_all" ON public.drivers FOR SELECT USING (true);
CREATE POLICY "drivers_insert_own" ON public.drivers FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "drivers_update_own" ON public.drivers FOR UPDATE USING (auth.uid() = id);

-- 7. DRIVER LOCATIONS Table
CREATE TABLE IF NOT EXISTS public.driver_locations (
  driver_id uuid REFERENCES public.profiles(id) NOT NULL PRIMARY KEY,
  location geography(Point),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'driver_locations' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON public.driver_locations';
    END LOOP;
END $$;

CREATE POLICY "driver_locations_select_all" ON public.driver_locations FOR SELECT USING (true);
CREATE POLICY "driver_locations_insert_own" ON public.driver_locations FOR INSERT WITH CHECK (auth.uid() = driver_id);
CREATE POLICY "driver_locations_update_own" ON public.driver_locations FOR UPDATE USING (auth.uid() = driver_id);

-- 8. RIDES Table
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

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'rides' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON public.rides';
    END LOOP;
END $$;

CREATE POLICY "rides_select_all" ON public.rides FOR SELECT USING (true);
CREATE POLICY "rides_insert_auth" ON public.rides FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "rides_update_all" ON public.rides FOR UPDATE USING (true);

-- 9. TRIGGER: Handle New User -> Profile Creation
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, phone)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    coalesce(new.raw_user_meta_data->>'role', 'passenger'), 
    new.raw_user_meta_data->>'phone'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 10. NOTIFICATIONS Table (for app notifications)
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id) NOT NULL,
  type text,
  title text,
  message text,
  data jsonb,
  read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'notifications' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON public.notifications';
    END LOOP;
END $$;

CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_insert_all" ON public.notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- 11. Create missing profile for existing user (if any)
INSERT INTO public.profiles (id, role, full_name, phone)
SELECT id, 
  COALESCE(raw_user_meta_data->>'role', 'passenger')::text,
  COALESCE(raw_user_meta_data->>'full_name', email),
  raw_user_meta_data->>'phone'
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- Done!
SELECT 'Database setup complete!' as status;
