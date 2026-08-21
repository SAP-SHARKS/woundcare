import { supabase } from './supabase';
import { isUuid } from './validation';

export interface WoundAIResult {
  survey: any | null;
  interpretation: any | null;
  partial: boolean;
  model: string;
  promptVersion: string;
  provider?: string;
  analysisId?: string;
  demo?: boolean;
}

export async function prepareWoundImage(file: File): Promise<{ mediaType: string; base64: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
  return { mediaType: 'image/jpeg', base64: dataUrl.split(',')[1] };
}

export async function runWoundProvider(file: File, provider: string, context: Record<string, unknown> = {}): Promise<WoundAIResult> {
  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
  const session = refreshed.session;
  if (refreshError || !session) throw new Error('Your session could not be refreshed. Sign out and sign in again.');
  const image = await prepareWoundImage(file);
  const response = await fetch('/api/wound-analysis', { method: 'POST', headers: { 'content-type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ image, context, provider }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `${provider} analysis failed.`);
  return result;
}

function demoResult(): WoundAIResult {
  return {
    demo: true, partial: false, model: 'demo-fixture', promptVersion: 'wound-image-assessment-claude-reference-v1',
    survey: {
      imageQuality: { grade: 'B', scaleReference: false, limitations: ['No coplanar scale marker'], privacyConcerns: [] },
      measurement: { scaleAvailable: false, lengthCm: null, widthCm: null, areaCm2: null, aspectRatio: '1.4:1', note: 'Centimetres withheld without scale.' },
      tissue: { granulation: 60, granulationQuality: 'healthy', slough: 30, eschar: 10, escharState: 'n/a', epithelial: 0, exposedStructures: [], note: 'Demo visual estimate.' },
      edges: { findings: ['callused', 'attached'], note: 'Confirm at bedside.' },
      periwound: { findings: ['mild discoloration'], erythemaExtentCm: null, note: 'Margin partly visible.' },
      moisture: { state: 'moist', note: 'Visual appearance only.' },
    },
    interpretation: {
      flags: [], infection: { nerdsPresent: ['Debris'], stoneesPresent: [], assessment: 'Clinical correlation indicated.' },
      classification: { etiology: 'Diabetic / neuropathic ulcer', etiologyConfidence: 'moderate', differential: ['Pressure injury from footwear'], stagingApplicable: false, stage: null, stageConfidence: null, rationale: 'Plantar morphology with callus.' },
      cannotDetermine: ['depth', 'undermining', 'temperature', 'odor'], push: { computable: false, score: null, missingInputs: ['bedside depth'] }, nextCapture: ['Include a coplanar scale marker'],
    },
  };
}

export async function analyzeWoundImage(args: { file: File; organizationId: string | null; woundId: string; patientId?: string; bodySite?: string; exudate?: string }): Promise<WoundAIResult> {
  if (args.patientId?.startsWith('sample-') || args.woundId.startsWith('sample-')) return new Promise(resolve => setTimeout(() => resolve(demoResult()), 900));
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Sign in with a real account to run AI analysis. Role preview uses demo analysis only.');
  void session;
  const result = await runWoundProvider(args.file, 'anthropic', { bodySite: args.bodySite, exudate: args.exudate });
  if (isUuid(args.organizationId) && isUuid(args.woundId)) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase.from('wound_ai_analyses').insert({
      organization_id: args.organizationId, wound_id: args.woundId, created_by: user?.id, model_provider: result.provider || 'anthropic',
      status: result.partial ? 'partial' : 'draft', model_version: result.model,
      prompt_version: result.promptVersion, visual_survey: result.survey,
      clinical_interpretation: result.interpretation,
      limitations: result.survey?.imageQuality?.limitations || [],
    }).select('id').single();
    if (error) throw new Error(`Analysis completed but could not be stored: ${error.message}`);
    result.analysisId = data.id;
  }
  return result;
}
