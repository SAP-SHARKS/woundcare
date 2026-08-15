/*
# Multi-Tenant Wound Care Platform Schema

## Overview
Adds multi-tenancy with organizations, proper wound/assessment separation,
expanded patient profiles, alerts, tasks, and audit logging.

## New Tables
- organizations, organization_memberships, wounds, wound_assessments,
  wound_images, alerts, tasks, audit_logs

## Modified Tables
- profiles: added organization_id, first_name, last_name, phone, email
- patients: added organization_id, expanded clinical fields

## Security
- RLS on all tables, org-scoped policies via membership checks
- Super admin cross-org access
- Audit logs insert-only
*/

-- ============================================
-- 1. CREATE ALL TABLES FIRST (no cross-references in policies)
-- ============================================

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  legal_name text DEFAULT '',
  org_type text NOT NULL DEFAULT 'wound_clinic',
  phone text DEFAULT '',
  email text DEFAULT '',
  address text DEFAULT '',
  city text DEFAULT '',
  region text DEFAULT '',
  country text DEFAULT 'Saudi Arabia',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS organization_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'nurse',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, user_id)
);
ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;

-- Expand profiles
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'organization_id') THEN
    ALTER TABLE profiles ADD COLUMN organization_id uuid REFERENCES organizations(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'first_name') THEN
    ALTER TABLE profiles ADD COLUMN first_name text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'last_name') THEN
    ALTER TABLE profiles ADD COLUMN last_name text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'phone') THEN
    ALTER TABLE profiles ADD COLUMN phone text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'email') THEN
    ALTER TABLE profiles ADD COLUMN email text DEFAULT '';
  END IF;
END $$;

-- Expand patients
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'organization_id') THEN
    ALTER TABLE patients ADD COLUMN organization_id uuid REFERENCES organizations(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'mrn') THEN
    ALTER TABLE patients ADD COLUMN mrn text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'first_name') THEN
    ALTER TABLE patients ADD COLUMN first_name text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'last_name') THEN
    ALTER TABLE patients ADD COLUMN last_name text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'sex') THEN
    ALTER TABLE patients ADD COLUMN sex text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'nationality') THEN
    ALTER TABLE patients ADD COLUMN nationality text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'preferred_language') THEN
    ALTER TABLE patients ADD COLUMN preferred_language text DEFAULT 'Arabic';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'address') THEN
    ALTER TABLE patients ADD COLUMN address text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'city') THEN
    ALTER TABLE patients ADD COLUMN city text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'height_cm') THEN
    ALTER TABLE patients ADD COLUMN height_cm numeric(5,1);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'weight_kg') THEN
    ALTER TABLE patients ADD COLUMN weight_kg numeric(5,1);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'diabetes_type') THEN
    ALTER TABLE patients ADD COLUMN diabetes_type text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'hba1c') THEN
    ALTER TABLE patients ADD COLUMN hba1c numeric(4,1);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'pad') THEN
    ALTER TABLE patients ADD COLUMN pad boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'neuropathy') THEN
    ALTER TABLE patients ADD COLUMN neuropathy boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'hypertension') THEN
    ALTER TABLE patients ADD COLUMN hypertension boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'kidney_disease') THEN
    ALTER TABLE patients ADD COLUMN kidney_disease boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'dialysis') THEN
    ALTER TABLE patients ADD COLUMN dialysis boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'cardiovascular_disease') THEN
    ALTER TABLE patients ADD COLUMN cardiovascular_disease boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'immunosuppression') THEN
    ALTER TABLE patients ADD COLUMN immunosuppression boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'mobility') THEN
    ALTER TABLE patients ADD COLUMN mobility text DEFAULT 'ambulatory';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'nutrition_status') THEN
    ALTER TABLE patients ADD COLUMN nutrition_status text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'previous_wounds') THEN
    ALTER TABLE patients ADD COLUMN previous_wounds boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'previous_amputations') THEN
    ALTER TABLE patients ADD COLUMN previous_amputations text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'medications') THEN
    ALTER TABLE patients ADD COLUMN medications text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'allergies') THEN
    ALTER TABLE patients ADD COLUMN allergies text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'status') THEN
    ALTER TABLE patients ADD COLUMN status text DEFAULT 'active';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'updated_at') THEN
    ALTER TABLE patients ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS wounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  location_description text NOT NULL DEFAULT '',
  wound_side text DEFAULT '',
  wound_type text NOT NULL DEFAULT 'other',
  date_first_observed date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'active',
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE wounds ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS wound_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wound_id uuid NOT NULL REFERENCES wounds(id),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  assessed_by uuid DEFAULT auth.uid() REFERENCES auth.users(id),
  assessment_date date NOT NULL DEFAULT CURRENT_DATE,
  length_cm numeric(5,2),
  width_cm numeric(5,2),
  depth_cm numeric(5,2),
  area_cm2 numeric(7,2),
  granulation_pct integer DEFAULT 0,
  slough_pct integer DEFAULT 0,
  eschar_pct integer DEFAULT 0,
  epithelial_pct integer DEFAULT 0,
  exudate_amount text DEFAULT 'none',
  exudate_type text DEFAULT '',
  wound_edge text DEFAULT '',
  periwound text DEFAULT '',
  pain_score integer DEFAULT 0,
  odor boolean DEFAULT false,
  tunneling text DEFAULT '',
  undermining text DEFAULT '',
  exposed_structures text DEFAULT '',
  signs_requiring_review text DEFAULT '',
  clinical_notes text DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  review_notes text DEFAULT '',
  push_score integer,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE wound_assessments ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS wound_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid REFERENCES wound_assessments(id),
  wound_id uuid NOT NULL REFERENCES wounds(id),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  image_type text NOT NULL DEFAULT 'original',
  storage_path text NOT NULL,
  file_name text DEFAULT '',
  mime_type text DEFAULT 'image/jpeg',
  file_size_bytes integer,
  capture_notes text DEFAULT '',
  uploaded_by uuid DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE wound_images ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  patient_id uuid REFERENCES patients(id),
  wound_id uuid REFERENCES wounds(id),
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  title text NOT NULL,
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'new',
  assigned_to uuid REFERENCES auth.users(id),
  resolved_by uuid REFERENCES auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  patient_id uuid REFERENCES patients(id),
  wound_id uuid REFERENCES wounds(id),
  assigned_to uuid REFERENCES auth.users(id),
  assigned_by uuid DEFAULT auth.uid() REFERENCES auth.users(id),
  title text NOT NULL,
  description text DEFAULT '',
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'pending',
  due_date date,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id),
  user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id),
  action text NOT NULL,
  entity_type text DEFAULT '',
  entity_id text DEFAULT '',
  metadata jsonb DEFAULT '{}',
  ip_address text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. ALL POLICIES (tables exist now)
-- ============================================

-- Helper: check org membership
-- organizations
DROP POLICY IF EXISTS "select_organizations" ON organizations;
CREATE POLICY "select_organizations" ON organizations FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
    OR EXISTS (SELECT 1 FROM organization_memberships WHERE organization_memberships.organization_id = organizations.id AND organization_memberships.user_id = auth.uid() AND organization_memberships.status = 'active')
  );

DROP POLICY IF EXISTS "insert_organizations" ON organizations;
CREATE POLICY "insert_organizations" ON organizations FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
  );

DROP POLICY IF EXISTS "update_organizations" ON organizations;
CREATE POLICY "update_organizations" ON organizations FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
    OR EXISTS (SELECT 1 FROM organization_memberships WHERE organization_memberships.organization_id = organizations.id AND organization_memberships.user_id = auth.uid() AND organization_memberships.role = 'clinic_admin' AND organization_memberships.status = 'active')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
    OR EXISTS (SELECT 1 FROM organization_memberships WHERE organization_memberships.organization_id = organizations.id AND organization_memberships.user_id = auth.uid() AND organization_memberships.role = 'clinic_admin' AND organization_memberships.status = 'active')
  );

DROP POLICY IF EXISTS "delete_organizations" ON organizations;
CREATE POLICY "delete_organizations" ON organizations FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
  );

-- organization_memberships
DROP POLICY IF EXISTS "select_org_memberships" ON organization_memberships;
CREATE POLICY "select_org_memberships" ON organization_memberships FOR SELECT
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
    OR EXISTS (SELECT 1 FROM organization_memberships om2 WHERE om2.organization_id = organization_memberships.organization_id AND om2.user_id = auth.uid() AND om2.status = 'active')
  );

DROP POLICY IF EXISTS "insert_org_memberships" ON organization_memberships;
CREATE POLICY "insert_org_memberships" ON organization_memberships FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
    OR EXISTS (SELECT 1 FROM organization_memberships om2 WHERE om2.organization_id = organization_memberships.organization_id AND om2.user_id = auth.uid() AND om2.role = 'clinic_admin' AND om2.status = 'active')
  );

DROP POLICY IF EXISTS "update_org_memberships" ON organization_memberships;
CREATE POLICY "update_org_memberships" ON organization_memberships FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
    OR EXISTS (SELECT 1 FROM organization_memberships om2 WHERE om2.organization_id = organization_memberships.organization_id AND om2.user_id = auth.uid() AND om2.role = 'clinic_admin' AND om2.status = 'active')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
    OR EXISTS (SELECT 1 FROM organization_memberships om2 WHERE om2.organization_id = organization_memberships.organization_id AND om2.user_id = auth.uid() AND om2.role = 'clinic_admin' AND om2.status = 'active')
  );

DROP POLICY IF EXISTS "delete_org_memberships" ON organization_memberships;
CREATE POLICY "delete_org_memberships" ON organization_memberships FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
  );

-- profiles (update select policy)
DROP POLICY IF EXISTS "select_own_profile" ON profiles;
DROP POLICY IF EXISTS "select_profiles" ON profiles;
CREATE POLICY "select_profiles" ON profiles FOR SELECT
  TO authenticated USING (
    id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p2 WHERE p2.id = auth.uid() AND p2.role = 'super_admin')
    OR EXISTS (
      SELECT 1 FROM organization_memberships om1
      JOIN organization_memberships om2 ON om1.organization_id = om2.organization_id
      WHERE om1.user_id = profiles.id AND om2.user_id = auth.uid() AND om2.status = 'active'
    )
  );

-- patients (update policies for org-scoped access)
DROP POLICY IF EXISTS "select_patients" ON patients;
CREATE POLICY "select_patients" ON patients FOR SELECT
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
    OR EXISTS (SELECT 1 FROM organization_memberships WHERE organization_memberships.organization_id = patients.organization_id AND organization_memberships.user_id = auth.uid() AND organization_memberships.status = 'active')
  );

DROP POLICY IF EXISTS "insert_own_patient" ON patients;
DROP POLICY IF EXISTS "insert_patients" ON patients;
CREATE POLICY "insert_patients" ON patients FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM organization_memberships WHERE organization_memberships.organization_id = patients.organization_id AND organization_memberships.user_id = auth.uid() AND organization_memberships.status = 'active' AND organization_memberships.role IN ('clinic_admin', 'doctor', 'wound_specialist', 'nurse'))
  );

DROP POLICY IF EXISTS "update_own_patient" ON patients;
DROP POLICY IF EXISTS "update_patients" ON patients;
CREATE POLICY "update_patients" ON patients FOR UPDATE
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM organization_memberships WHERE organization_memberships.organization_id = patients.organization_id AND organization_memberships.user_id = auth.uid() AND organization_memberships.status = 'active' AND organization_memberships.role IN ('clinic_admin', 'doctor', 'wound_specialist', 'nurse'))
  ) WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM organization_memberships WHERE organization_memberships.organization_id = patients.organization_id AND organization_memberships.user_id = auth.uid() AND organization_memberships.status = 'active' AND organization_memberships.role IN ('clinic_admin', 'doctor', 'wound_specialist', 'nurse'))
  );

DROP POLICY IF EXISTS "delete_own_patient" ON patients;
DROP POLICY IF EXISTS "delete_patients" ON patients;
CREATE POLICY "delete_patients" ON patients FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
    OR EXISTS (SELECT 1 FROM organization_memberships WHERE organization_memberships.organization_id = patients.organization_id AND organization_memberships.user_id = auth.uid() AND organization_memberships.status = 'active' AND organization_memberships.role = 'clinic_admin')
  );

-- wounds
DROP POLICY IF EXISTS "select_wounds" ON wounds;
CREATE POLICY "select_wounds" ON wounds FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
    OR EXISTS (SELECT 1 FROM organization_memberships WHERE organization_memberships.organization_id = wounds.organization_id AND organization_memberships.user_id = auth.uid() AND organization_memberships.status = 'active')
    OR EXISTS (SELECT 1 FROM patients WHERE patients.id = wounds.patient_id AND patients.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_wounds" ON wounds;
CREATE POLICY "insert_wounds" ON wounds FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM organization_memberships WHERE organization_memberships.organization_id = wounds.organization_id AND organization_memberships.user_id = auth.uid() AND organization_memberships.status = 'active' AND organization_memberships.role IN ('clinic_admin', 'doctor', 'wound_specialist', 'nurse'))
  );

DROP POLICY IF EXISTS "update_wounds" ON wounds;
CREATE POLICY "update_wounds" ON wounds FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM organization_memberships WHERE organization_memberships.organization_id = wounds.organization_id AND organization_memberships.user_id = auth.uid() AND organization_memberships.status = 'active' AND organization_memberships.role IN ('clinic_admin', 'doctor', 'wound_specialist', 'nurse'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM organization_memberships WHERE organization_memberships.organization_id = wounds.organization_id AND organization_memberships.user_id = auth.uid() AND organization_memberships.status = 'active' AND organization_memberships.role IN ('clinic_admin', 'doctor', 'wound_specialist', 'nurse'))
  );

DROP POLICY IF EXISTS "delete_wounds" ON wounds;
CREATE POLICY "delete_wounds" ON wounds FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM organization_memberships WHERE organization_memberships.organization_id = wounds.organization_id AND organization_memberships.user_id = auth.uid() AND organization_memberships.status = 'active' AND organization_memberships.role IN ('clinic_admin', 'doctor'))
  );

-- wound_assessments
DROP POLICY IF EXISTS "select_assessments" ON wound_assessments;
CREATE POLICY "select_assessments" ON wound_assessments FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
    OR EXISTS (SELECT 1 FROM organization_memberships WHERE organization_memberships.organization_id = wound_assessments.organization_id AND organization_memberships.user_id = auth.uid() AND organization_memberships.status = 'active')
    OR EXISTS (SELECT 1 FROM wounds JOIN patients ON patients.id = wounds.patient_id WHERE wounds.id = wound_assessments.wound_id AND patients.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_assessments" ON wound_assessments;
CREATE POLICY "insert_assessments" ON wound_assessments FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM organization_memberships WHERE organization_memberships.organization_id = wound_assessments.organization_id AND organization_memberships.user_id = auth.uid() AND organization_memberships.status = 'active' AND organization_memberships.role IN ('clinic_admin', 'doctor', 'wound_specialist', 'nurse'))
  );

DROP POLICY IF EXISTS "update_assessments" ON wound_assessments;
CREATE POLICY "update_assessments" ON wound_assessments FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM organization_memberships WHERE organization_memberships.organization_id = wound_assessments.organization_id AND organization_memberships.user_id = auth.uid() AND organization_memberships.status = 'active' AND organization_memberships.role IN ('clinic_admin', 'doctor', 'wound_specialist', 'nurse'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM organization_memberships WHERE organization_memberships.organization_id = wound_assessments.organization_id AND organization_memberships.user_id = auth.uid() AND organization_memberships.status = 'active' AND organization_memberships.role IN ('clinic_admin', 'doctor', 'wound_specialist', 'nurse'))
  );

DROP POLICY IF EXISTS "delete_assessments" ON wound_assessments;
CREATE POLICY "delete_assessments" ON wound_assessments FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM organization_memberships WHERE organization_memberships.organization_id = wound_assessments.organization_id AND organization_memberships.user_id = auth.uid() AND organization_memberships.status = 'active' AND organization_memberships.role IN ('clinic_admin', 'doctor'))
  );

-- wound_images
DROP POLICY IF EXISTS "select_wound_images" ON wound_images;
CREATE POLICY "select_wound_images" ON wound_images FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
    OR EXISTS (SELECT 1 FROM organization_memberships WHERE organization_memberships.organization_id = wound_images.organization_id AND organization_memberships.user_id = auth.uid() AND organization_memberships.status = 'active')
  );

DROP POLICY IF EXISTS "insert_wound_images" ON wound_images;
CREATE POLICY "insert_wound_images" ON wound_images FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM organization_memberships WHERE organization_memberships.organization_id = wound_images.organization_id AND organization_memberships.user_id = auth.uid() AND organization_memberships.status = 'active')
  );

DROP POLICY IF EXISTS "update_wound_images" ON wound_images;
CREATE POLICY "update_wound_images" ON wound_images FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM organization_memberships WHERE organization_memberships.organization_id = wound_images.organization_id AND organization_memberships.user_id = auth.uid() AND organization_memberships.status = 'active')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM organization_memberships WHERE organization_memberships.organization_id = wound_images.organization_id AND organization_memberships.user_id = auth.uid() AND organization_memberships.status = 'active')
  );

DROP POLICY IF EXISTS "delete_wound_images" ON wound_images;
CREATE POLICY "delete_wound_images" ON wound_images FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM organization_memberships WHERE organization_memberships.organization_id = wound_images.organization_id AND organization_memberships.user_id = auth.uid() AND organization_memberships.status = 'active' AND organization_memberships.role IN ('clinic_admin', 'doctor'))
  );

-- alerts
DROP POLICY IF EXISTS "select_alerts" ON alerts;
CREATE POLICY "select_alerts" ON alerts FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM organization_memberships WHERE organization_memberships.organization_id = alerts.organization_id AND organization_memberships.user_id = auth.uid() AND organization_memberships.status = 'active')
  );

DROP POLICY IF EXISTS "insert_alerts" ON alerts;
CREATE POLICY "insert_alerts" ON alerts FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM organization_memberships WHERE organization_memberships.organization_id = alerts.organization_id AND organization_memberships.user_id = auth.uid() AND organization_memberships.status = 'active')
  );

DROP POLICY IF EXISTS "update_alerts" ON alerts;
CREATE POLICY "update_alerts" ON alerts FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM organization_memberships WHERE organization_memberships.organization_id = alerts.organization_id AND organization_memberships.user_id = auth.uid() AND organization_memberships.status = 'active')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM organization_memberships WHERE organization_memberships.organization_id = alerts.organization_id AND organization_memberships.user_id = auth.uid() AND organization_memberships.status = 'active')
  );

DROP POLICY IF EXISTS "delete_alerts" ON alerts;
CREATE POLICY "delete_alerts" ON alerts FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM organization_memberships WHERE organization_memberships.organization_id = alerts.organization_id AND organization_memberships.user_id = auth.uid() AND organization_memberships.status = 'active' AND organization_memberships.role IN ('clinic_admin', 'doctor'))
  );

-- tasks
DROP POLICY IF EXISTS "select_tasks" ON tasks;
CREATE POLICY "select_tasks" ON tasks FOR SELECT
  TO authenticated USING (
    assigned_to = auth.uid() OR assigned_by = auth.uid()
    OR EXISTS (SELECT 1 FROM organization_memberships WHERE organization_memberships.organization_id = tasks.organization_id AND organization_memberships.user_id = auth.uid() AND organization_memberships.status = 'active' AND organization_memberships.role IN ('clinic_admin', 'doctor', 'wound_specialist'))
  );

DROP POLICY IF EXISTS "insert_tasks" ON tasks;
CREATE POLICY "insert_tasks" ON tasks FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM organization_memberships WHERE organization_memberships.organization_id = tasks.organization_id AND organization_memberships.user_id = auth.uid() AND organization_memberships.status = 'active')
  );

DROP POLICY IF EXISTS "update_tasks" ON tasks;
CREATE POLICY "update_tasks" ON tasks FOR UPDATE
  TO authenticated USING (
    assigned_to = auth.uid() OR assigned_by = auth.uid()
    OR EXISTS (SELECT 1 FROM organization_memberships WHERE organization_memberships.organization_id = tasks.organization_id AND organization_memberships.user_id = auth.uid() AND organization_memberships.status = 'active' AND organization_memberships.role IN ('clinic_admin', 'doctor'))
  ) WITH CHECK (
    assigned_to = auth.uid() OR assigned_by = auth.uid()
    OR EXISTS (SELECT 1 FROM organization_memberships WHERE organization_memberships.organization_id = tasks.organization_id AND organization_memberships.user_id = auth.uid() AND organization_memberships.status = 'active' AND organization_memberships.role IN ('clinic_admin', 'doctor'))
  );

DROP POLICY IF EXISTS "delete_tasks" ON tasks;
CREATE POLICY "delete_tasks" ON tasks FOR DELETE
  TO authenticated USING (
    assigned_by = auth.uid()
    OR EXISTS (SELECT 1 FROM organization_memberships WHERE organization_memberships.organization_id = tasks.organization_id AND organization_memberships.user_id = auth.uid() AND organization_memberships.status = 'active' AND organization_memberships.role IN ('clinic_admin', 'doctor'))
  );

-- audit_logs (insert-only for users, read for admins)
DROP POLICY IF EXISTS "select_audit_logs" ON audit_logs;
CREATE POLICY "select_audit_logs" ON audit_logs FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin')
    OR EXISTS (SELECT 1 FROM organization_memberships WHERE organization_memberships.organization_id = audit_logs.organization_id AND organization_memberships.user_id = auth.uid() AND organization_memberships.status = 'active' AND organization_memberships.role = 'clinic_admin')
  );

DROP POLICY IF EXISTS "insert_audit_logs" ON audit_logs;
CREATE POLICY "insert_audit_logs" ON audit_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_audit_logs" ON audit_logs;
CREATE POLICY "update_audit_logs" ON audit_logs FOR UPDATE
  TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "delete_audit_logs" ON audit_logs;
CREATE POLICY "delete_audit_logs" ON audit_logs FOR DELETE
  TO authenticated USING (false);

-- wound_entries (update for org-scoped access)
DROP POLICY IF EXISTS "select_wound_entries" ON wound_entries;
CREATE POLICY "select_wound_entries" ON wound_entries FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM patients WHERE patients.id = wound_entries.patient_id AND patients.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('clinician', 'super_admin'))
    OR EXISTS (SELECT 1 FROM patients p JOIN organization_memberships om ON om.organization_id = p.organization_id WHERE p.id = wound_entries.patient_id AND om.user_id = auth.uid() AND om.status = 'active')
  );

-- ============================================
-- 3. INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_org_memberships_user ON organization_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_org ON organization_memberships(organization_id);
CREATE INDEX IF NOT EXISTS idx_patients_org ON patients(organization_id);
CREATE INDEX IF NOT EXISTS idx_wounds_patient ON wounds(patient_id);
CREATE INDEX IF NOT EXISTS idx_wounds_org ON wounds(organization_id);
CREATE INDEX IF NOT EXISTS idx_assessments_wound ON wound_assessments(wound_id);
CREATE INDEX IF NOT EXISTS idx_assessments_org ON wound_assessments(organization_id);
CREATE INDEX IF NOT EXISTS idx_wound_images_assessment ON wound_images(assessment_id);
CREATE INDEX IF NOT EXISTS idx_wound_images_wound ON wound_images(wound_id);
CREATE INDEX IF NOT EXISTS idx_alerts_org ON alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_org ON tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
