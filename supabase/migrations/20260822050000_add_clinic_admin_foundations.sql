/* Clinic identity and administration foundations. */

CREATE EXTENSION IF NOT EXISTS citext;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS slug citext,
  ADD COLUMN IF NOT EXISTS logo_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS app_icon_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#1f6f6b',
  ADD COLUMN IF NOT EXISTS secondary_color text DEFAULT '#eef4f3',
  ADD COLUMN IF NOT EXISTS website text DEFAULT '',
  ADD COLUMN IF NOT EXISTS support_email text DEFAULT '';

UPDATE public.organizations
SET slug = trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')) || '-' || left(id::text, 8)
WHERE slug IS NULL OR slug = '';

ALTER TABLE public.organizations ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS organizations_slug_unique ON public.organizations(slug);

CREATE OR REPLACE FUNCTION public.is_org_admin(p_user_id uuid, p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin() OR EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.user_id = p_user_id
      AND om.organization_id = p_org_id
      AND om.status = 'active'
      AND om.role IN ('clinic_admin', 'clinic_owner')
  );
$$;

CREATE TABLE IF NOT EXISTS public.clinic_settings (
  organization_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  timezone text NOT NULL DEFAULT 'UTC',
  default_language text NOT NULL DEFAULT 'English',
  date_format text NOT NULL DEFAULT 'MM/DD/YYYY',
  measurement_system text NOT NULL DEFAULT 'metric',
  sender_name text DEFAULT '',
  reply_to_email text DEFAULT '',
  clinical_alert_email text DEFAULT '',
  administrative_email text DEFAULT '',
  require_mfa boolean NOT NULL DEFAULT false,
  session_timeout_minutes integer NOT NULL DEFAULT 480 CHECK (session_timeout_minutes BETWEEN 15 AND 43200),
  allow_patient_home_checkin boolean NOT NULL DEFAULT true,
  require_photo_consent boolean NOT NULL DEFAULT true,
  require_calibration_marker boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);
ALTER TABLE public.clinic_settings ENABLE ROW LEVEL SECURITY;

INSERT INTO public.clinic_settings (organization_id)
SELECT id FROM public.organizations
ON CONFLICT (organization_id) DO NOTHING;

DROP POLICY IF EXISTS clinic_settings_select ON public.clinic_settings;
CREATE POLICY clinic_settings_select ON public.clinic_settings FOR SELECT TO authenticated
USING (public.is_org_member(auth.uid(), organization_id));
DROP POLICY IF EXISTS clinic_settings_insert ON public.clinic_settings;
CREATE POLICY clinic_settings_insert ON public.clinic_settings FOR INSERT TO authenticated
WITH CHECK (public.is_org_admin(auth.uid(), organization_id));
DROP POLICY IF EXISTS clinic_settings_update ON public.clinic_settings;
CREATE POLICY clinic_settings_update ON public.clinic_settings FOR UPDATE TO authenticated
USING (public.is_org_admin(auth.uid(), organization_id))
WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('clinic-branding', 'clinic-branding', true, 2097152, ARRAY['image/png','image/jpeg','image/webp','image/svg+xml'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 2097152;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('clinic-documents', 'clinic-documents', false, 20971520, ARRAY[
  'application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png','image/jpeg','image/webp'
])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 20971520;

DROP POLICY IF EXISTS clinic_documents_member_read ON storage.objects;
CREATE POLICY clinic_documents_member_read ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'clinic-documents' AND public.is_org_member(auth.uid(), (storage.foldername(name))[1]::uuid));
DROP POLICY IF EXISTS clinic_documents_member_insert ON storage.objects;
CREATE POLICY clinic_documents_member_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'clinic-documents'
  AND public.is_org_member(auth.uid(), (storage.foldername(name))[1]::uuid)
  AND (storage.foldername(name))[2] = auth.uid()::text
);
DROP POLICY IF EXISTS clinic_documents_owner_delete ON storage.objects;
CREATE POLICY clinic_documents_owner_delete ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'clinic-documents'
  AND public.is_org_member(auth.uid(), (storage.foldername(name))[1]::uuid)
  AND (storage.foldername(name))[2] = auth.uid()::text
);

DROP POLICY IF EXISTS clinic_branding_public_read ON storage.objects;
CREATE POLICY clinic_branding_public_read ON storage.objects FOR SELECT
USING (bucket_id = 'clinic-branding');
DROP POLICY IF EXISTS clinic_branding_admin_insert ON storage.objects;
CREATE POLICY clinic_branding_admin_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'clinic-branding' AND public.is_org_admin(auth.uid(), (storage.foldername(name))[1]::uuid));
DROP POLICY IF EXISTS clinic_branding_admin_update ON storage.objects;
CREATE POLICY clinic_branding_admin_update ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'clinic-branding' AND public.is_org_admin(auth.uid(), (storage.foldername(name))[1]::uuid));
DROP POLICY IF EXISTS clinic_branding_admin_delete ON storage.objects;
CREATE POLICY clinic_branding_admin_delete ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'clinic-branding' AND public.is_org_admin(auth.uid(), (storage.foldername(name))[1]::uuid));

CREATE OR REPLACE FUNCTION public.audit_clinic_admin_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE org_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    org_id := CASE WHEN TG_TABLE_NAME = 'organizations' THEN OLD.id ELSE OLD.organization_id END;
  ELSE
    org_id := CASE WHEN TG_TABLE_NAME = 'organizations' THEN NEW.id ELSE NEW.organization_id END;
  END IF;
  INSERT INTO public.audit_logs(organization_id,user_id,action,entity_type,entity_id,metadata)
  VALUES(org_id,auth.uid(),lower(TG_OP),TG_TABLE_NAME,org_id::text,jsonb_build_object('source','clinic_admin'));
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS audit_organization_admin_change ON public.organizations;
CREATE TRIGGER audit_organization_admin_change AFTER UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.audit_clinic_admin_change();
DROP TRIGGER IF EXISTS audit_clinic_settings_change ON public.clinic_settings;
CREATE TRIGGER audit_clinic_settings_change AFTER INSERT OR UPDATE ON public.clinic_settings FOR EACH ROW EXECUTE FUNCTION public.audit_clinic_admin_change();

ALTER TABLE organization_memberships
  ADD COLUMN IF NOT EXISTS invited_at timestamptz,
  ADD COLUMN IF NOT EXISTS activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS access_revoked_at timestamptz;

CREATE OR REPLACE FUNCTION public.protect_last_clinic_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.role IN ('clinic_admin', 'clinic_owner') AND OLD.status = 'active'
     AND (TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND (NEW.status <> 'active' OR NEW.role NOT IN ('clinic_admin', 'clinic_owner')))) THEN
    IF NOT EXISTS (
      SELECT 1 FROM organization_memberships other
      WHERE other.organization_id = OLD.organization_id AND other.id <> OLD.id
        AND other.status = 'active' AND other.role IN ('clinic_admin', 'clinic_owner')
    ) THEN RAISE EXCEPTION 'A clinic must retain at least one active administrator.'; END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END $$;
DROP TRIGGER IF EXISTS protect_last_clinic_admin_trigger ON organization_memberships;
CREATE TRIGGER protect_last_clinic_admin_trigger BEFORE UPDATE OR DELETE ON organization_memberships
FOR EACH ROW EXECUTE FUNCTION public.protect_last_clinic_admin();
DROP TRIGGER IF EXISTS audit_organization_memberships_changes ON organization_memberships;
CREATE TRIGGER audit_organization_memberships_changes AFTER INSERT OR UPDATE OR DELETE ON organization_memberships
FOR EACH ROW EXECUTE FUNCTION public.audit_clinic_admin_change();

CREATE TABLE IF NOT EXISTS clinic_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'not_configured' CHECK (status IN ('not_configured','testing','connected','disabled')),
  endpoint_url text NOT NULL DEFAULT '',
  credential_reference text NOT NULL DEFAULT '',
  config_notes text NOT NULL DEFAULT '',
  last_tested_at timestamptz,
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, provider)
);
ALTER TABLE clinic_integrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clinic members view integration metadata" ON clinic_integrations;
CREATE POLICY "clinic members view integration metadata" ON clinic_integrations FOR SELECT USING (is_org_member(auth.uid(), organization_id));
DROP POLICY IF EXISTS "clinic admins insert integration metadata" ON clinic_integrations;
CREATE POLICY "clinic admins insert integration metadata" ON clinic_integrations FOR INSERT WITH CHECK (is_org_admin(auth.uid(), organization_id));
DROP POLICY IF EXISTS "clinic admins update integration metadata" ON clinic_integrations;
CREATE POLICY "clinic admins update integration metadata" ON clinic_integrations FOR UPDATE USING (is_org_admin(auth.uid(), organization_id)) WITH CHECK (is_org_admin(auth.uid(), organization_id));
DROP POLICY IF EXISTS "clinic admins delete integration metadata" ON clinic_integrations;
CREATE POLICY "clinic admins delete integration metadata" ON clinic_integrations FOR DELETE USING (is_org_admin(auth.uid(), organization_id));
DROP TRIGGER IF EXISTS audit_clinic_integrations_changes ON clinic_integrations;
CREATE TRIGGER audit_clinic_integrations_changes AFTER INSERT OR UPDATE OR DELETE ON clinic_integrations
FOR EACH ROW EXECUTE FUNCTION public.audit_clinic_admin_change();
