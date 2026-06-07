-- Migration to fix user deletion behavior
-- Ensures that deleting a profile from public.profiles also deletes the user from auth.users
-- And cleans up any existing orphaned users in auth.users that do not have profiles.

-- 1. Create a trigger function to delete the auth user when their public profile is deleted
CREATE OR REPLACE FUNCTION public.handle_deleted_profile()
RETURNS trigger AS $$
BEGIN
  -- Delete from auth.users. This will trigger the ON DELETE CASCADE constraint on profiles,
  -- but since it's already being deleted, it won't cause infinite recursion.
  -- SECURITY DEFINER allows this to run with bypass-RLS/superuser privileges.
  DELETE FROM auth.users WHERE id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Bind the trigger to the profiles table
DROP TRIGGER IF EXISTS on_profile_deleted ON public.profiles;
CREATE TRIGGER on_profile_deleted
  AFTER DELETE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.handle_deleted_profile();

-- 3. Clean up any existing orphaned auth users that have no profile
-- This resolves the issue where a user was partially deleted (profile deleted, auth user remained)
-- and allows those emails to be signed up again.
DELETE FROM auth.users WHERE id NOT IN (SELECT id FROM public.profiles);
