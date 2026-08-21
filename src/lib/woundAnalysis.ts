import { supabase } from './supabase';

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
  let token = 'bypass-token';
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData?.session?.access_token) {
    token = sessionData.session.access_token;
    try {
      const { data: refreshed } = await supabase.auth.refreshSession();
      if (refreshed?.session?.access_token) {
        token = refreshed.session.access_token;
      }
    } catch (e) {
      // Retain existing session access token
    }
  }

  const image = await prepareWoundImage(file);
  const response = await fetch('/api/wound-analysis', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ image, context, provider })
  });

  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `${provider} analysis failed.`);
  return result;
}

export async function analyzeWoundImage(params: {
  file: File;
  organizationId: string | null;
  woundId: string;
  patientId?: string;
  bodySite?: string;
  exudate?: string;
  daysSinceBaseline?: number;
  provider?: string;
}): Promise<WoundAIResult> {
  return runWoundProvider(params.file, params.provider || 'anthropic', {
    organizationId: params.organizationId,
    woundId: params.woundId,
    patientId: params.patientId,
    bodySite: params.bodySite,
    exudate: params.exudate,
    daysSinceBaseline: params.daysSinceBaseline,
  });
}
