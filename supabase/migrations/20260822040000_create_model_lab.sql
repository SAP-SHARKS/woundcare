/* Governed, super-admin-only Model Lab. Never modifies the source clinical record. */
CREATE TABLE IF NOT EXISTS public.ai_dataset_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id),
  source_wound_id uuid REFERENCES public.wounds(id) ON DELETE SET NULL,
  source_image_id uuid REFERENCES public.wound_images(id) ON DELETE SET NULL,
  image_storage_path text NOT NULL,
  body_site text,
  skin_tone_band text,
  consent_basis text NOT NULL,
  deidentified boolean NOT NULL DEFAULT false,
  capture_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  bedside_ground_truth jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'review' CHECK (status IN ('intake','review','adjudication','gold','excluded')),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_provider_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.ai_dataset_cases(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('anthropic','openai','gemini','kimi')),
  model_version text NOT NULL,
  prompt_version text NOT NULL,
  schema_version text NOT NULL DEFAULT 'wound-assessment-v1',
  status text NOT NULL CHECK (status IN ('complete','partial','failed')),
  output jsonb,
  error_message text,
  latency_ms integer,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_human_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.ai_provider_runs(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES auth.users(id),
  review_round smallint NOT NULL DEFAULT 1,
  blinded boolean NOT NULL DEFAULT true,
  verdict text NOT NULL CHECK (verdict IN ('accept','edit','reject','unassessable')),
  field_corrections jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason_codes text[] NOT NULL DEFAULT '{}',
  notes text,
  confidence text CHECK (confidence IN ('low','moderate','high')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(run_id, reviewer_id, review_round)
);

CREATE TABLE IF NOT EXISTS public.ai_adjudications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL UNIQUE REFERENCES public.ai_dataset_cases(id) ON DELETE CASCADE,
  adjudicator_id uuid NOT NULL REFERENCES auth.users(id),
  gold_labels jsonb NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_dataset_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  case_ids uuid[] NOT NULL,
  split_manifest jsonb NOT NULL DEFAULT '{}'::jsonb,
  locked boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_model_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  provider text NOT NULL CHECK (provider IN ('anthropic','openai','gemini','kimi')),
  model_version text NOT NULL,
  prompt_version text NOT NULL,
  dataset_version_id uuid REFERENCES public.ai_dataset_versions(id),
  evaluation_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate','shadow','pilot','approved','retired')),
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_dataset_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_provider_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_human_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_adjudications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_dataset_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_model_releases ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['ai_dataset_cases','ai_provider_runs','ai_human_reviews','ai_adjudications','ai_dataset_versions','ai_model_releases'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "super_admin_model_lab" ON public.%I', t);
    EXECUTE format('CREATE POLICY "super_admin_model_lab" ON public.%I FOR ALL TO authenticated USING (public.is_super_admin()) WITH CHECK (public.is_super_admin())', t);
  END LOOP;
END $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('model-lab','model-lab',false,10485760,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public=false, file_size_limit=10485760, allowed_mime_types=EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "super_admin_model_lab_objects" ON storage.objects;
CREATE POLICY "super_admin_model_lab_objects" ON storage.objects FOR ALL TO authenticated
USING (bucket_id='model-lab' AND public.is_super_admin())
WITH CHECK (bucket_id='model-lab' AND public.is_super_admin());

CREATE INDEX IF NOT EXISTS ai_provider_runs_case_idx ON public.ai_provider_runs(case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_human_reviews_run_idx ON public.ai_human_reviews(run_id);
