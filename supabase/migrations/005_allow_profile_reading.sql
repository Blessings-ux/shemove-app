-- Run this in Supabase SQL Editor to allow profile reading

-- Allow authenticated users to read basic profile info of other users
-- This enables drivers to see passenger info and vice versa
CREATE POLICY IF NOT EXISTS "Authenticated users can read all profiles" 
  ON public.profiles 
  FOR SELECT 
  USING (auth.role() = 'authenticated');

-- If above fails because policy exists, try dropping and recreating:
-- DROP POLICY IF EXISTS "Authenticated users can read all profiles" ON public.profiles;
-- Then run the CREATE POLICY again

-- Alternative: More restricted - only read profiles involved in rides
-- CREATE POLICY "Users can read profiles they interact with" 
--   ON public.profiles 
--   FOR SELECT 
--   USING (
--     auth.uid() = id OR
--     id IN (SELECT driver_id FROM rides WHERE passenger_id = auth.uid()) OR
--     id IN (SELECT passenger_id FROM rides WHERE driver_id = auth.uid())
--   );
