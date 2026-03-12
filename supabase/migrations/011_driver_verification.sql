-- ====================================================================
-- Migration: Driver Verification for SheMove
-- Adds gender verification fields to drivers table
-- Creates storage bucket for ID photos
-- ====================================================================

-- 1. Add verification columns to drivers table
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('female')),
  ADD COLUMN IF NOT EXISTS id_photo_url text,
  ADD COLUMN IF NOT EXISTS selfie_url text,
  ADD COLUMN IF NOT EXISTS verification_status text 
    CHECK (verification_status IN ('pending', 'verified', 'rejected', 'unverified'))
    DEFAULT 'unverified';

-- 2. Create storage bucket for driver verification documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('driver-verifications', 'driver-verifications', false)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage Policies: Drivers can upload their own verification files
CREATE POLICY "Drivers can upload own verification files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'driver-verifications' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Drivers can view their own verification files
CREATE POLICY "Drivers can view own verification files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'driver-verifications' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Drivers can update/replace their own verification files
CREATE POLICY "Drivers can update own verification files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'driver-verifications' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Admins can view all verification files (for review)
CREATE POLICY "Admins can view all verification files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'driver-verifications' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- 4. Allow drivers to update their own verification fields
-- (existing policy "Drivers can update own status" already covers this since it uses auth.uid() = id)

-- 5. Index for admin queries on verification status
CREATE INDEX IF NOT EXISTS idx_drivers_verification_status 
ON public.drivers(verification_status);
