/*
# Fix infinite recursion in RLS policies

## Problem
Policies on organization_memberships, organizations, patients, wounds, etc.
reference `profiles` to check `role = 'super_admin'`, while the `profiles`
SELECT policy references `organization_memberships`. This creates a circular
dependency causing "infinite recursion detected in policy for relation profiles".

## Solution
1. Copy the role from user_metadata to app_metadata (user-immutable) for security.
2. Create a helper function `public.is_super_admin()` that reads the JWT app_metadata
   instead of querying the profiles table, breaking the cycle.
3. Replace all `EXISTS (SELECT 1 FROM profiles ...)` super_admin checks with
   `public.is_super_admin()`.
4. Fix the profiles SELECT policy self-reference.

## Tables affected
- profiles (SELECT policy)
- organizations (SELECT, INSERT, UPDATE, DELETE policies)
- organization_memberships (SELECT, INSERT, UPDATE, DELETE policies)
- patients (SELECT, DELETE policies)
- wounds (SELECT policy)
- wound_assessments (SELECT policy)
- wound_images (SELECT policy)
- wound_entries (SELECT policy)
- audit_logs (SELECT policy)
*/

-- Step 1: Copy role to app_metadata for all existing users
UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('role', COALESCE(raw_user_meta_data->>'role', 'patient'));

-- Step 2: Update the trigger to also set app_metadata on new signups
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, role, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'patient'),
    COALESCE(NEW.raw_user_meta_data->>'display_name', '')
  );
  -- Also copy role to app_metadata (user-immutable)
  NEW.raw_app_meta_data := COALESCE(NEW.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', COALESCE(NEW.raw_user_meta_data->>'role', 'patient'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Create helper function using JWT (no table query = no recursion)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (auth.jwt()->'app_metadata'->>'role') = 'super_admin',
    false
  );
$$;

-- Step 4: Fix profiles SELECT policy (remove self-referencing subquery)
DROP POLICY IF EXISTS "select_profiles" ON profiles;
CREATE POLICY "select_profiles" ON profiles FOR SELECT TO authenticated
USING (
  (id = auth.uid())
  OR public.is_super_admin()
  OR (EXISTS (
    SELECT 1
    FROM organization_memberships om1
    JOIN organization_memberships om2 ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = profiles.id
      AND om2.user_id = auth.uid()
      AND om2.status = 'active'
  ))
);

-- Step 5: Fix organizations policies
DROP POLICY IF EXISTS "select_organizations" ON organizations;
CREATE POLICY "select_organizations" ON organizations FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR (EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE organization_memberships.organization_id = organizations.id
      AND organization_memberships.user_id = auth.uid()
      AND organization_memberships.status = 'active'
  ))
);

DROP POLICY IF EXISTS "insert_organizations" ON organizations;
CREATE POLICY "insert_organizations" ON organizations FOR INSERT TO authenticated
WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "update_organizations" ON organizations;
CREATE POLICY "update_organizations" ON organizations FOR UPDATE TO authenticated
USING (
  public.is_super_admin()
  OR (EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE organization_memberships.organization_id = organizations.id
      AND organization_memberships.user_id = auth.uid()
      AND organization_memberships.role = 'clinic_admin'
      AND organization_memberships.status = 'active'
  ))
)
WITH CHECK (
  public.is_super_admin()
  OR (EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE organization_memberships.organization_id = organizations.id
      AND organization_memberships.user_id = auth.uid()
      AND organization_memberships.role = 'clinic_admin'
      AND organization_memberships.status = 'active'
  ))
);

DROP POLICY IF EXISTS "delete_organizations" ON organizations;
CREATE POLICY "delete_organizations" ON organizations FOR DELETE TO authenticated
USING (public.is_super_admin());

-- Step 6: Fix organization_memberships policies
DROP POLICY IF EXISTS "select_org_memberships" ON organization_memberships;
CREATE POLICY "select_org_memberships" ON organization_memberships FOR SELECT TO authenticated
USING (
  (user_id = auth.uid())
  OR public.is_super_admin()
  OR (EXISTS (
    SELECT 1 FROM organization_memberships om2
    WHERE om2.organization_id = organization_memberships.organization_id
      AND om2.user_id = auth.uid()
      AND om2.status = 'active'
  ))
);

DROP POLICY IF EXISTS "insert_org_memberships" ON organization_memberships;
CREATE POLICY "insert_org_memberships" ON organization_memberships FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin()
  OR (EXISTS (
    SELECT 1 FROM organization_memberships om2
    WHERE om2.organization_id = organization_memberships.organization_id
      AND om2.user_id = auth.uid()
      AND om2.role = 'clinic_admin'
      AND om2.status = 'active'
  ))
);

DROP POLICY IF EXISTS "update_org_memberships" ON organization_memberships;
CREATE POLICY "update_org_memberships" ON organization_memberships FOR UPDATE TO authenticated
USING (
  public.is_super_admin()
  OR (EXISTS (
    SELECT 1 FROM organization_memberships om2
    WHERE om2.organization_id = organization_memberships.organization_id
      AND om2.user_id = auth.uid()
      AND om2.role = 'clinic_admin'
      AND om2.status = 'active'
  ))
)
WITH CHECK (
  public.is_super_admin()
  OR (EXISTS (
    SELECT 1 FROM organization_memberships om2
    WHERE om2.organization_id = organization_memberships.organization_id
      AND om2.user_id = auth.uid()
      AND om2.role = 'clinic_admin'
      AND om2.status = 'active'
  ))
);

DROP POLICY IF EXISTS "delete_org_memberships" ON organization_memberships;
CREATE POLICY "delete_org_memberships" ON organization_memberships FOR DELETE TO authenticated
USING (public.is_super_admin());

-- Step 7: Fix patients policies
DROP POLICY IF EXISTS "select_patients" ON patients;
CREATE POLICY "select_patients" ON patients FOR SELECT TO authenticated
USING (
  (auth.uid() = user_id)
  OR public.is_super_admin()
  OR (EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE organization_memberships.organization_id = patients.organization_id
      AND organization_memberships.user_id = auth.uid()
      AND organization_memberships.status = 'active'
  ))
);

DROP POLICY IF EXISTS "delete_patients" ON patients;
CREATE POLICY "delete_patients" ON patients FOR DELETE TO authenticated
USING (
  public.is_super_admin()
  OR (EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE organization_memberships.organization_id = patients.organization_id
      AND organization_memberships.user_id = auth.uid()
      AND organization_memberships.status = 'active'
      AND organization_memberships.role = 'clinic_admin'
  ))
);

-- Step 8: Fix wounds policies
DROP POLICY IF EXISTS "select_wounds" ON wounds;
CREATE POLICY "select_wounds" ON wounds FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR (EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE organization_memberships.organization_id = wounds.organization_id
      AND organization_memberships.user_id = auth.uid()
      AND organization_memberships.status = 'active'
  ))
  OR (EXISTS (
    SELECT 1 FROM patients
    WHERE patients.id = wounds.patient_id
      AND patients.user_id = auth.uid()
  ))
);

-- Step 9: Fix wound_assessments policies
DROP POLICY IF EXISTS "select_assessments" ON wound_assessments;
CREATE POLICY "select_assessments" ON wound_assessments FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR (EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE organization_memberships.organization_id = wound_assessments.organization_id
      AND organization_memberships.user_id = auth.uid()
      AND organization_memberships.status = 'active'
  ))
  OR (EXISTS (
    SELECT 1 FROM wounds
    JOIN patients ON patients.id = wounds.patient_id
    WHERE wounds.id = wound_assessments.wound_id
      AND patients.user_id = auth.uid()
  ))
);

-- Step 10: Fix wound_images policies
DROP POLICY IF EXISTS "select_wound_images" ON wound_images;
CREATE POLICY "select_wound_images" ON wound_images FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR (EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE organization_memberships.organization_id = wound_images.organization_id
      AND organization_memberships.user_id = auth.uid()
      AND organization_memberships.status = 'active'
  ))
);

-- Step 11: Fix wound_entries policies
DROP POLICY IF EXISTS "select_wound_entries" ON wound_entries;
CREATE POLICY "select_wound_entries" ON wound_entries FOR SELECT TO authenticated
USING (
  (EXISTS (
    SELECT 1 FROM patients
    WHERE patients.id = wound_entries.patient_id
      AND patients.user_id = auth.uid()
  ))
  OR public.is_super_admin()
  OR (EXISTS (
    SELECT 1 FROM patients p
    JOIN organization_memberships om ON om.organization_id = p.organization_id
    WHERE p.id = wound_entries.patient_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
  ))
);

-- Step 12: Fix audit_logs policies
DROP POLICY IF EXISTS "select_audit_logs" ON audit_logs;
CREATE POLICY "select_audit_logs" ON audit_logs FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR (EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE organization_memberships.organization_id = audit_logs.organization_id
      AND organization_memberships.user_id = auth.uid()
      AND organization_memberships.status = 'active'
      AND organization_memberships.role = 'clinic_admin'
  ))
);
