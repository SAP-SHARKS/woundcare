/*
  # WoundTrack Database Schema

  1. New Tables
    - `patients`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `full_name` (text)
      - `dob` (date)
      - `patient_id_code` (text, unique external ID like PT-2026-0147)
      - `phone` (text)
      - `email` (text)
      - `diabetes` (boolean)
      - `smoking` (boolean)
      - `anticoagulants` (boolean)
      - `wound_type` (text)
      - `onset_date` (date)
      - `body_location` (text)
      - `consent_given` (boolean)
      - `created_at` (timestamptz)

    - `wound_entries`
      - `id` (uuid, primary key)
      - `patient_id` (uuid, references patients)
      - `week` (integer)
      - `entry_date` (date)
      - `length_cm` (numeric)
      - `width_cm` (numeric)
      - `depth_cm` (numeric)
      - `area_cm2` (numeric)
      - `granulation_pct` (integer)
      - `slough_pct` (integer)
      - `eschar_pct` (integer)
      - `exudate_amount` (text)
      - `exudate_type` (text)
      - `pain_score` (integer)
      - `odor` (boolean)
      - `notes` (text)
      - `push_score` (integer)
      - `created_at` (timestamptz)

    - `documents`
      - `id` (uuid, primary key)
      - `title` (text)
      - `category` (text) - e.g. protocol, guideline, form, reference
      - `description` (text)
      - `file_url` (text)
      - `uploaded_by` (uuid, references auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - RLS enabled on all tables
    - Patients can read their own data
    - Authenticated clinicians can read all patient data
    - Documents accessible to all authenticated users
*/

-- Patients table
CREATE TABLE IF NOT EXISTS patients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  full_name text NOT NULL,
  dob date,
  patient_id_code text UNIQUE NOT NULL,
  phone text DEFAULT '',
  email text DEFAULT '',
  diabetes boolean DEFAULT false,
  smoking boolean DEFAULT false,
  anticoagulants boolean DEFAULT false,
  wound_type text NOT NULL,
  onset_date date NOT NULL,
  body_location text DEFAULT '',
  consent_given boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can view own record"
  ON patients FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Patients can insert own record"
  ON patients FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Patients can update own record"
  ON patients FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Wound entries table
CREATE TABLE IF NOT EXISTS wound_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES patients(id),
  week integer NOT NULL DEFAULT 1,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  length_cm numeric(5,2) NOT NULL DEFAULT 0,
  width_cm numeric(5,2) NOT NULL DEFAULT 0,
  depth_cm numeric(5,2) NOT NULL DEFAULT 0,
  area_cm2 numeric(7,2) NOT NULL DEFAULT 0,
  granulation_pct integer NOT NULL DEFAULT 0,
  slough_pct integer NOT NULL DEFAULT 0,
  eschar_pct integer NOT NULL DEFAULT 0,
  exudate_amount text NOT NULL DEFAULT 'None',
  exudate_type text NOT NULL DEFAULT 'Serous',
  pain_score integer NOT NULL DEFAULT 0,
  odor boolean DEFAULT false,
  notes text DEFAULT '',
  push_score integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE wound_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients can view own wound entries"
  ON wound_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM patients
      WHERE patients.id = wound_entries.patient_id
      AND patients.user_id = auth.uid()
    )
  );

CREATE POLICY "Patients can insert own wound entries"
  ON wound_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM patients
      WHERE patients.id = wound_entries.patient_id
      AND patients.user_id = auth.uid()
    )
  );

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL DEFAULT 'reference',
  description text DEFAULT '',
  file_url text DEFAULT '',
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view documents"
  ON documents FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert documents"
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Document owners can update their documents"
  ON documents FOR UPDATE
  TO authenticated
  USING (auth.uid() = uploaded_by)
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Document owners can delete their documents"
  ON documents FOR DELETE
  TO authenticated
  USING (auth.uid() = uploaded_by);
