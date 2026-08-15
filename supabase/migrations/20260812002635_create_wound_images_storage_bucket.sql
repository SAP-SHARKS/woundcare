/*
# Create wound-images storage bucket

## Overview
Creates a private storage bucket for wound photographs.
Images are organized by: org_id/patient_id/wound_id/assessment_id/filename

## Security
- Bucket is private (no public access)
- RLS policies enforce org membership for upload and download
- Only authenticated users with active org membership can access images
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('wound-images', 'wound-images', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "org_members_select_wound_images" ON storage.objects;
CREATE POLICY "org_members_select_wound_images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'wound-images'
  AND (storage.foldername(name))[1] IN (
    SELECT om.organization_id::text FROM organization_memberships om
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  )
);

DROP POLICY IF EXISTS "org_members_insert_wound_images" ON storage.objects;
CREATE POLICY "org_members_insert_wound_images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'wound-images'
  AND (storage.foldername(name))[1] IN (
    SELECT om.organization_id::text FROM organization_memberships om
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  )
);

DROP POLICY IF EXISTS "org_members_update_wound_images" ON storage.objects;
CREATE POLICY "org_members_update_wound_images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'wound-images'
  AND (storage.foldername(name))[1] IN (
    SELECT om.organization_id::text FROM organization_memberships om
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  )
) WITH CHECK (
  bucket_id = 'wound-images'
  AND (storage.foldername(name))[1] IN (
    SELECT om.organization_id::text FROM organization_memberships om
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  )
);

DROP POLICY IF EXISTS "org_members_delete_wound_images" ON storage.objects;
CREATE POLICY "org_members_delete_wound_images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'wound-images'
  AND (storage.foldername(name))[1] IN (
    SELECT om.organization_id::text FROM organization_memberships om
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  )
);
