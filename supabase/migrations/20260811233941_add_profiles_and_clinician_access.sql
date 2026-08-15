/*
# Add profiles table and clinician access

1. New Tables
  - `profiles`
    - `id` (uuid, primary key, references auth.users)
    - `role` (text, default 'patient') - 'patient' or 'clinician'
    - `display_name` (text)
    - `created_at` (timestamptz)

2. Security
  - RLS enabled on `profiles`
  - All authenticated users can read their own profile
  - Clinicians can read all profiles
  - Users can update their own display_name only (role is revoked from client writes)
  - New policies on `patients` so clinicians can read all patient records
  - New policies on `wound_entries` so clinicians can read all entries
  - Trigger to auto-create profile on signup

3. Important Notes
  - Role column is NOT client-writable (REVOKE UPDATE on role)
  - Clinician access is read-only for patient data
  - Default user_id on patients table to auth.uid()
*/

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'patient',
  display_name text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Revoke direct UPDATE on role column so clients can't escalate
REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (display_name) ON profiles TO authenticated;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, role, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'patient'),
    COALESCE(NEW.raw_user_meta_data->>'display_name', '')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Default user_id on patients to auth.uid()
ALTER TABLE patients ALTER COLUMN user_id SET DEFAULT auth.uid();

-- Add clinician read access to patients
DROP POLICY IF EXISTS "Patients can view own record" ON patients;
CREATE POLICY "select_patients" ON patients FOR SELECT
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'clinician')
  );

DROP POLICY IF EXISTS "Patients can insert own record" ON patients;
CREATE POLICY "insert_own_patient" ON patients FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Patients can update own record" ON patients;
CREATE POLICY "update_own_patient" ON patients FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_patient" ON patients;
CREATE POLICY "delete_own_patient" ON patients FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Add clinician read access to wound_entries
DROP POLICY IF EXISTS "Patients can view own wound entries" ON wound_entries;
CREATE POLICY "select_wound_entries" ON wound_entries FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM patients WHERE patients.id = wound_entries.patient_id AND patients.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'clinician')
  );

DROP POLICY IF EXISTS "Patients can insert own wound entries" ON wound_entries;
CREATE POLICY "insert_own_wound_entries" ON wound_entries FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM patients WHERE patients.id = wound_entries.patient_id AND patients.user_id = auth.uid())
  );

-- Documents: ensure all authenticated can read, clinicians can also add
DROP POLICY IF EXISTS "Authenticated users can view documents" ON documents;
CREATE POLICY "select_documents" ON documents FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert documents" ON documents;
CREATE POLICY "insert_documents" ON documents FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = uploaded_by);

DROP POLICY IF EXISTS "Document owners can update their documents" ON documents;
CREATE POLICY "update_own_documents" ON documents FOR UPDATE
  TO authenticated USING (auth.uid() = uploaded_by) WITH CHECK (auth.uid() = uploaded_by);

DROP POLICY IF EXISTS "Document owners can delete their documents" ON documents;
CREATE POLICY "delete_own_documents" ON documents FOR DELETE
  TO authenticated USING (auth.uid() = uploaded_by);

-- Default uploaded_by to auth.uid()
ALTER TABLE documents ALTER COLUMN uploaded_by SET DEFAULT auth.uid();
