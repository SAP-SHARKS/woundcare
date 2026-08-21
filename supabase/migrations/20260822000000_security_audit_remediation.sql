/* Forward-only remediation for the 2026 security and quality audit. */

-- New accounts are always least-privilege. Elevated roles must be assigned by a trusted admin flow.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, display_name)
  VALUES (NEW.id, 'patient', COALESCE(NEW.raw_user_meta_data->>'display_name', ''))
  ON CONFLICT (id) DO NOTHING;
  NEW.raw_app_meta_data := COALESCE(NEW.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'patient');
  NEW.raw_user_meta_data := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb) - 'role';
  RETURN NEW;
END;
$$;

-- User metadata is client-writable and must never retain an authorization claim.
UPDATE auth.users SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) - 'role' WHERE raw_user_meta_data ? 'role';
-- Existing app_metadata super_admin assignments are intentionally not changed automatically:
-- review them against the approved administrator roster before deploying this migration.

-- Tenant-scope the clinical document library. Legacy unassigned rows remain inaccessible.
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);
UPDATE public.documents d SET organization_id = p.organization_id FROM public.profiles p WHERE d.uploaded_by = p.id AND d.organization_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_organization ON public.documents(organization_id);
DROP POLICY IF EXISTS "Authenticated users can view documents" ON public.documents;
DROP POLICY IF EXISTS "Authenticated users can insert documents" ON public.documents;
DROP POLICY IF EXISTS "Document owners can update their documents" ON public.documents;
DROP POLICY IF EXISTS "Document owners can delete their documents" ON public.documents;
DROP POLICY IF EXISTS "select_documents" ON public.documents;
DROP POLICY IF EXISTS "insert_documents" ON public.documents;
DROP POLICY IF EXISTS "update_own_documents" ON public.documents;
DROP POLICY IF EXISTS "delete_own_documents" ON public.documents;
CREATE POLICY "tenant_select_documents" ON public.documents FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "tenant_insert_documents" ON public.documents FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid() AND public.is_org_member(auth.uid(), organization_id));
CREATE POLICY "tenant_update_documents" ON public.documents FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR (uploaded_by = auth.uid() AND public.is_org_member(auth.uid(), organization_id)))
  WITH CHECK (public.is_super_admin() OR (uploaded_by = auth.uid() AND public.is_org_member(auth.uid(), organization_id)));
CREATE POLICY "tenant_delete_documents" ON public.documents FOR DELETE TO authenticated
  USING (public.is_super_admin() OR (uploaded_by = auth.uid() AND public.is_org_member(auth.uid(), organization_id)));

-- Composite foreign keys guarantee parent and child belong to the same tenant.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='patients_id_organization_unique') THEN ALTER TABLE public.patients ADD CONSTRAINT patients_id_organization_unique UNIQUE (id, organization_id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='wounds_id_organization_unique') THEN ALTER TABLE public.wounds ADD CONSTRAINT wounds_id_organization_unique UNIQUE (id, organization_id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='assessments_id_organization_unique') THEN ALTER TABLE public.wound_assessments ADD CONSTRAINT assessments_id_organization_unique UNIQUE (id, organization_id); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='wounds_patient_same_org') THEN ALTER TABLE public.wounds ADD CONSTRAINT wounds_patient_same_org FOREIGN KEY (patient_id, organization_id) REFERENCES public.patients(id, organization_id) NOT VALID; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='assessments_wound_same_org') THEN ALTER TABLE public.wound_assessments ADD CONSTRAINT assessments_wound_same_org FOREIGN KEY (wound_id, organization_id) REFERENCES public.wounds(id, organization_id) NOT VALID; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='images_wound_same_org') THEN ALTER TABLE public.wound_images ADD CONSTRAINT images_wound_same_org FOREIGN KEY (wound_id, organization_id) REFERENCES public.wounds(id, organization_id) NOT VALID; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='images_assessment_same_org') THEN ALTER TABLE public.wound_images ADD CONSTRAINT images_assessment_same_org FOREIGN KEY (assessment_id, organization_id) REFERENCES public.wound_assessments(id, organization_id) NOT VALID; END IF;
END $$;

DROP POLICY IF EXISTS "insert_wounds" ON public.wounds;
CREATE POLICY "insert_wounds" ON public.wounds FOR INSERT TO authenticated WITH CHECK (
  public.is_org_member(auth.uid(), organization_id) AND EXISTS (SELECT 1 FROM public.patients p WHERE p.id=patient_id AND p.organization_id=wounds.organization_id)
);
DROP POLICY IF EXISTS "insert_assessments" ON public.wound_assessments;
CREATE POLICY "insert_assessments" ON public.wound_assessments FOR INSERT TO authenticated WITH CHECK (
  public.is_org_member(auth.uid(), organization_id) AND EXISTS (SELECT 1 FROM public.wounds w WHERE w.id=wound_id AND w.organization_id=wound_assessments.organization_id)
);
DROP POLICY IF EXISTS "insert_wound_images" ON public.wound_images;
CREATE POLICY "insert_wound_images" ON public.wound_images FOR INSERT TO authenticated WITH CHECK (
  public.is_org_member(auth.uid(), organization_id)
  AND EXISTS (SELECT 1 FROM public.wounds w WHERE w.id=wound_id AND w.organization_id=wound_images.organization_id)
  AND (assessment_id IS NULL OR EXISTS (SELECT 1 FROM public.wound_assessments a WHERE a.id=assessment_id AND a.wound_id=wound_images.wound_id AND a.organization_id=wound_images.organization_id))
);

-- Idempotency key used by the offline sync engine.
ALTER TABLE public.wound_assessments ADD COLUMN IF NOT EXISTS client_submission_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS wound_assessments_client_submission_unique ON public.wound_assessments(client_submission_id) WHERE client_submission_id IS NOT NULL;

-- Database-owned immutable audit trail.
CREATE OR REPLACE FUNCTION public.write_clinical_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE row_data jsonb; org_id uuid; target_id text;
BEGIN
  row_data := CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  org_id := NULLIF(row_data->>'organization_id','')::uuid;
  target_id := COALESCE(row_data->>'id','');
  INSERT INTO public.audit_logs(organization_id,user_id,action,entity_type,entity_id,metadata)
  VALUES(org_id,auth.uid(),lower(TG_OP),TG_TABLE_NAME,target_id,jsonb_build_object('source','database_trigger'));
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$$;
DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY['patients','wounds','wound_assessments','wound_images','documents'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS system_audit_trigger ON public.%I',table_name);
    EXECUTE format('CREATE TRIGGER system_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.write_clinical_audit_event()',table_name);
  END LOOP;
END $$;
DROP POLICY IF EXISTS "insert_audit_logs" ON public.audit_logs;
REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM anon, authenticated;
