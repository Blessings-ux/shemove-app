-- FIX: Trigger with proper enum handling
-- Run this in Supabase SQL Editor

-- STEP 1: Check what enum values exist (optional, for debugging)
-- SELECT unnest(enum_range(NULL::user_role)) as valid_roles;

-- STEP 2: Drop and recreate the trigger with proper enum casting
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
DECLARE
  role_value user_role;
BEGIN
  -- Safely convert role text to enum, default to 'passenger' if invalid
  BEGIN
    role_value := COALESCE(new.raw_user_meta_data->>'role', 'passenger')::user_role;
  EXCEPTION WHEN OTHERS THEN
    role_value := 'passenger'::user_role;
  END;
  
  INSERT INTO public.profiles (id, full_name, role, phone)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    role_value,
    new.raw_user_meta_data->>'phone'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

SELECT 'Trigger fixed!' as status;
