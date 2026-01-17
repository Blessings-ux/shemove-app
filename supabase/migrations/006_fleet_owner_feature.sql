-- Fleet Owner Feature - Database Migration
-- Run this in Supabase SQL Editor

-- 1. Update the Role check to include 'fleet_owner'
-- First, check if constraint exists and drop it

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.constraint_column_usage WHERE constraint_name = 'profiles_role_check') THEN
        ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
    END IF;
END $$;

ALTER TABLE profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('passenger', 'driver', 'admin', 'fleet_owner'));

-- 2. Add owner_id column to drivers table if it doesn't exist
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES profiles(id);

-- 3. Create index for faster owner lookups
CREATE INDEX IF NOT EXISTS idx_drivers_owner_id ON drivers(owner_id);

-- 4. Create a Policy: Fleet Owners can only see their own drivers
-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Fleet owners view own drivers" ON drivers;

CREATE POLICY "Fleet owners view own drivers"
ON drivers FOR SELECT
USING (
  owner_id = auth.uid() OR 
  id = auth.uid() OR 
  auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin')
);

-- 5. Create policy for fleet owners to update their own drivers
DROP POLICY IF EXISTS "Fleet owners can update own drivers" ON drivers;

CREATE POLICY "Fleet owners can update own drivers"
ON drivers FOR UPDATE
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

-- =====================================================
-- 6. Create fleet_invites table for driver invitations
-- =====================================================

CREATE TABLE IF NOT EXISTS fleet_invites (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  fleet_owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(fleet_owner_id, driver_id)
);

-- 7. Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_fleet_invites_fleet_owner ON fleet_invites(fleet_owner_id);
CREATE INDEX IF NOT EXISTS idx_fleet_invites_driver ON fleet_invites(driver_id);
CREATE INDEX IF NOT EXISTS idx_fleet_invites_status ON fleet_invites(status);

-- 8. Enable RLS on fleet_invites
ALTER TABLE fleet_invites ENABLE ROW LEVEL SECURITY;

-- 9. Policies for fleet_invites

-- Fleet owners can view their own invites
DROP POLICY IF EXISTS "Fleet owners can view own invites" ON fleet_invites;
CREATE POLICY "Fleet owners can view own invites"
ON fleet_invites FOR SELECT
USING (fleet_owner_id = auth.uid());

-- Drivers can view invites sent to them
DROP POLICY IF EXISTS "Drivers can view invites to them" ON fleet_invites;
CREATE POLICY "Drivers can view invites to them"
ON fleet_invites FOR SELECT
USING (driver_id = auth.uid());

-- Fleet owners can create invites
DROP POLICY IF EXISTS "Fleet owners can create invites" ON fleet_invites;
CREATE POLICY "Fleet owners can create invites"
ON fleet_invites FOR INSERT
WITH CHECK (fleet_owner_id = auth.uid());

-- Fleet owners can delete their own pending invites
DROP POLICY IF EXISTS "Fleet owners can delete own invites" ON fleet_invites;
CREATE POLICY "Fleet owners can delete own invites"
ON fleet_invites FOR DELETE
USING (fleet_owner_id = auth.uid() AND status = 'pending');

-- Drivers can update invites sent to them (accept/reject)
DROP POLICY IF EXISTS "Drivers can respond to invites" ON fleet_invites;
CREATE POLICY "Drivers can respond to invites"
ON fleet_invites FOR UPDATE
USING (driver_id = auth.uid())
WITH CHECK (driver_id = auth.uid());

-- 10. Function to handle invite acceptance (links driver to fleet owner)
CREATE OR REPLACE FUNCTION accept_fleet_invite(invite_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_fleet_owner_id uuid;
  v_driver_id uuid;
BEGIN
  -- Get invite details
  SELECT fleet_owner_id, driver_id INTO v_fleet_owner_id, v_driver_id
  FROM fleet_invites
  WHERE id = invite_id AND status = 'pending' AND driver_id = auth.uid();
  
  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite or already processed';
  END IF;
  
  -- Update driver's owner_id
  UPDATE drivers SET owner_id = v_fleet_owner_id WHERE id = v_driver_id;
  
  -- Mark invite as accepted
  UPDATE fleet_invites SET status = 'accepted', updated_at = now() WHERE id = invite_id;
END;
$$;
