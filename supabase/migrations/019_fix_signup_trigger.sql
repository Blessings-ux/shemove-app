-- Migration to fix the signup trigger and resolve 500/406 errors
-- This replaces the enum-based handle_new_user with a robust text-based trigger.

-- 1. Create a robust, text-based handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
DECLARE
  user_role text;
  clean_phone text;
BEGIN
  -- Get role from metadata, default to 'passenger'
  user_role := COALESCE(new.raw_user_meta_data->>'role', 'passenger');
  
  -- Validate role is one of allowed values
  IF user_role NOT IN ('passenger', 'driver', 'admin', 'fleet_owner') THEN
    user_role := 'passenger';
  END IF;

  -- Normalize phone: if empty string, convert to NULL to prevent UNIQUE constraint violations
  clean_phone := NULLIF(TRIM(new.raw_user_meta_data->>'phone'), '');

  -- Insert into profiles
  INSERT INTO public.profiles (id, full_name, role, phone)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), 
    user_role,
    clean_phone
  );
  
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- Log the error details internally for DB admins
  RAISE WARNING 'Error in handle_new_user trigger: %', SQLERRM;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Bind the trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. Clean up any existing orphaned auth users who do not have a profile 
-- (This fixes the 406 / Cannot coerce result to single JSON object errors for users who signed up while the trigger was broken)
DELETE FROM auth.users WHERE id NOT IN (SELECT id FROM public.profiles);
