/* Draft AI image analyses. Model output never overwrites clinician-authored fields. */
CREATE TABLE IF NOT EXISTS public.wound_ai_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  wound_id uuid NOT NULL REFERENCES public.wounds(id) ON DELETE CASCADE,
  assessment_id uuid REFERENCES public.wound_assessments(id) ON DELETE SET NULL,
  image_id uuid REFERENCES public.wound_images(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','partial','accepted','rejected','failed')),
  model_provider text NOT NULL DEFAULT 'anthropic',
  model_version text NOT NULL,
  prompt_version text NOT NULL,
  visual_survey jsonb,
  clinical_interpretation jsonb,
  comparison jsonb,
  limitations jsonb NOT NULL DEFAULT '[]'::jsonb,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wound_ai_analyses ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS wound_ai_analyses_wound_idx ON public.wound_ai_analyses(wound_id, created_at DESC);
CREATE INDEX IF NOT EXISTS wound_ai_analyses_assessment_idx ON public.wound_ai_analyses(assessment_id);

DROP POLICY IF EXISTS "members_read_wound_ai_analyses" ON public.wound_ai_analyses;
CREATE POLICY "members_read_wound_ai_analyses" ON public.wound_ai_analyses FOR SELECT TO authenticated
USING (public.is_super_admin() OR public.is_org_member(auth.uid(), organization_id));

DROP POLICY IF EXISTS "clinicians_create_wound_ai_analyses" ON public.wound_ai_analyses;
CREATE POLICY "clinicians_create_wound_ai_analyses" ON public.wound_ai_analyses FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND public.is_org_member(auth.uid(), organization_id)
  AND EXISTS (SELECT 1 FROM public.wounds w WHERE w.id = wound_id AND w.organization_id = wound_ai_analyses.organization_id)
);

DROP POLICY IF EXISTS "clinicians_review_wound_ai_analyses" ON public.wound_ai_analyses;
CREATE POLICY "clinicians_review_wound_ai_analyses" ON public.wound_ai_analyses FOR UPDATE TO authenticated
USING (public.is_super_admin() OR public.is_org_member(auth.uid(), organization_id))
WITH CHECK (public.is_super_admin() OR public.is_org_member(auth.uid(), organization_id));

DROP TRIGGER IF EXISTS wound_ai_analyses_set_updated_at ON public.wound_ai_analyses;
CREATE OR REPLACE FUNCTION public.set_wound_ai_analysis_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER wound_ai_analyses_set_updated_at BEFORE UPDATE ON public.wound_ai_analyses
FOR EACH ROW EXECUTE FUNCTION public.set_wound_ai_analysis_updated_at();
