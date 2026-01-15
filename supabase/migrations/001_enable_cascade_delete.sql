-- Migration to enable ON DELETE CASCADE for foreign keys to allow user deletion

-- 1. Modify DRIVERS table
-- Drop existing foreign key constraint if it exists (name might vary, so we try to find it or drop by standard naming)
-- Note: Supabase/Postgres default naming is typically table_column_fkey
ALTER TABLE public.drivers
DROP CONSTRAINT IF EXISTS drivers_id_fkey;

-- Add it back with ON DELETE CASCADE
ALTER TABLE public.drivers
ADD CONSTRAINT drivers_id_fkey
FOREIGN KEY (id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;


-- 2. Modify DRIVER_LOCATIONS table
ALTER TABLE public.driver_locations
DROP CONSTRAINT IF EXISTS driver_locations_driver_id_fkey;

ALTER TABLE public.driver_locations
ADD CONSTRAINT driver_locations_driver_id_fkey
FOREIGN KEY (driver_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;


-- 3. Modify RIDES table
-- Passenger Link: If passenger is deleted, delete their ride history? 
-- Usually we keep ride history for business records, but if the user deletion is "hard delete", then CASCADE is appropriate.
-- For this request ("Delete User"), we will CASCADE.
ALTER TABLE public.rides
DROP CONSTRAINT IF EXISTS rides_passenger_id_fkey;

ALTER TABLE public.rides
ADD CONSTRAINT rides_passenger_id_fkey
FOREIGN KEY (passenger_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;

-- Driver Link: If driver is deleted, we definitely want to KEEP the ride record (for passenger history), 
-- but set the driver_id to NULL.
ALTER TABLE public.rides
DROP CONSTRAINT IF EXISTS rides_driver_id_fkey;

ALTER TABLE public.rides
ADD CONSTRAINT rides_driver_id_fkey
FOREIGN KEY (driver_id)
REFERENCES public.profiles(id)
ON DELETE SET NULL;

-- 4. Note on PROFILES table
-- Profiles references auth.users. 
-- We want profiles to be deleted when auth.users is deleted.
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_id_fkey;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_id_fkey
FOREIGN KEY (id)
REFERENCES auth.users(id)
ON DELETE CASCADE;
