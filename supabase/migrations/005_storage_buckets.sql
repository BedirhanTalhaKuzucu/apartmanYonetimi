-- Migration 005: Setup Storage Buckets for Announcements, Requests & Receipts

-- 1. Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('attachments', 'attachments', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']),
  ('request-photos', 'request-photos', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif']),
  ('requests', 'requests', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif', 'application/pdf']),
  ('receipts', 'receipts', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Clean up old storage policies if present
DO $$
BEGIN
  DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can update their uploads" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can delete their uploads" ON storage.objects;
END $$;

-- 3. Allow public read access to uploaded media
CREATE POLICY "Public Read Access"
ON storage.objects FOR SELECT
USING (bucket_id IN ('attachments', 'request-photos', 'requests', 'receipts'));

-- 4. Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id IN ('attachments', 'request-photos', 'requests', 'receipts'));

-- 5. Allow authenticated users to update their files
CREATE POLICY "Authenticated users can update their uploads"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id IN ('attachments', 'request-photos', 'requests', 'receipts'));

-- 6. Allow authenticated users to delete their files
CREATE POLICY "Authenticated users can delete their uploads"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id IN ('attachments', 'request-photos', 'requests', 'receipts'));
