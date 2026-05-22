-- Migration: Simplified driver RLS - allow any authenticated user to insert if role is driver
-- Run this in Supabase SQL Editor

-- Drop existing restrictive policy if it exists
DROP POLICY IF EXISTS "Drivers can insert own record" ON public.drivers;

-- New policy: Allow authenticated users to insert their own driver record
CREATE POLICY "Users can insert own driver record" ON public.drivers 
FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Ensure the select/update policies exist
DROP POLICY IF EXISTS "Drivers viewable by everyone" ON public.drivers;
CREATE POLICY "Drivers viewable by everyone" ON public.drivers FOR SELECT USING (true);

DROP POLICY IF EXISTS "Drivers can update own status" ON public.drivers;
CREATE POLICY "Drivers can update own status" ON public.drivers FOR UPDATE USING (auth.uid() = id);
