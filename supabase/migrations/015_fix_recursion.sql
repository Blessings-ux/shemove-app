-- AGGRESSIVE FIX: Drop ALL policies on profiles table
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON public.profiles';
        RAISE NOTICE 'Dropped policy: %', pol.policyname;
    END LOOP;
END $$;

-- Re-create simple, non-recursive policies
CREATE POLICY "profiles_select_all" 
ON public.profiles FOR SELECT 
USING (true);

CREATE POLICY "profiles_insert_own" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

-- Confirm RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
