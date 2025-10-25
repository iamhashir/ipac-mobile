-- Migration: Setup media bucket and RLS policies for authenticated users
-- This migration creates the media storage bucket (if not exists) and sets up RLS policies
-- to allow authenticated users to upload and read their own media files.

-- =====================================================
-- 1. Create the 'media' storage bucket (if it doesn't exist)
-- =====================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', false)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 2. Enable RLS on storage.objects table (should already be enabled by default)
-- =====================================================
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 3. Drop existing policies if they exist (to allow re-running this migration)
-- =====================================================
DROP POLICY IF EXISTS "Authenticated users can upload media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update media" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete media" ON storage.objects;

-- =====================================================
-- 4. Create RLS policies for the media bucket
-- =====================================================

-- Allow authenticated users to upload (INSERT) files to the media bucket
CREATE POLICY "Authenticated users can upload media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'media');

-- Allow authenticated users to read (SELECT) files from the media bucket
CREATE POLICY "Authenticated users can read media"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'media');

-- Allow authenticated users to update files in the media bucket
CREATE POLICY "Authenticated users can update media"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'media')
WITH CHECK (bucket_id = 'media');

-- Allow authenticated users to delete files in the media bucket
CREATE POLICY "Authenticated users can delete media"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'media');

-- =====================================================
-- 5. Additional notes
-- =====================================================
-- The media bucket is set to private (public = false)
-- This means files can only be accessed via signed URLs or by authenticated users
-- Signed URLs are generated server-side and have an expiration time
-- This provides better security control over who can access the media files
