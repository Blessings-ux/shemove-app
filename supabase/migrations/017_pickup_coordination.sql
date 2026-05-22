-- Pickup coordination: passenger arrival + admin user deletion
-- Run in Supabase SQL Editor
--
-- Your database uses ride_status ENUM on rides.status (not plain text).
-- Enum values must be added with ALTER TYPE — a CHECK constraint will fail.

-- 1. Passenger arrival timestamp
ALTER TABLE public.rides
ADD COLUMN IF NOT EXISTS passenger_arrived_at timestamp with time zone;

-- 2a. Add pickup statuses to ride_status enum (standalone statements required)
-- IF NOT EXISTS makes this safe to re-run.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ride_status') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'ride_status' AND e.enumlabel = 'arrived'
    ) THEN
      EXECUTE 'ALTER TYPE public.ride_status ADD VALUE ''arrived''';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'ride_status' AND e.enumlabel = 'passenger_arrived'
    ) THEN
      EXECUTE 'ALTER TYPE public.ride_status ADD VALUE ''passenger_arrived''';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'ride_status' AND e.enumlabel = 'in_progress'
    ) THEN
      EXECUTE 'ALTER TYPE public.ride_status ADD VALUE ''in_progress''';
    END IF;

    ALTER TABLE public.rides DROP CONSTRAINT IF EXISTS rides_status_check;
  END IF;
END $$;

-- 2b. Fallback for databases where rides.status is TEXT (not enum)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ride_status') THEN
    ALTER TABLE public.rides DROP CONSTRAINT IF EXISTS rides_status_check;

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
  END IF;
END $$;

-- 3. Helper to check admin role without RLS recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- 4. Allow admins to delete user profiles (fallback if RPC unavailable)
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles"
ON public.profiles FOR DELETE
USING (public.is_admin());

-- 5. Admin RPC: delete auth user (cascades to profiles and related data)
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete your own account from admin panel';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;

SELECT 'Pickup coordination migration applied successfully!' AS status;
