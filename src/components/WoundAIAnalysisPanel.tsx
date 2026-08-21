import { useState } from 'react';
import { BrainCircuit, Check, AlertTriangle, Sparkles } from 'lucide-react';
import { analyzeWoundImage, type WoundAIResult } from '../lib/woundAnalysis';

interface Props {
  file?: File;
  organizationId: string | null;
  woundId: string;
  patientId?: string;
  bodySite?: string;
  exudate?: string;
  onApply: (suggestions: { length?: number; width?: number; granulation?: number; slough?: number; eschar?: number; epithelial?: number }) => void;
  onAnalysisStored?: (analysisId: string) => void;
}

export default function WoundAIAnalysisPanel(props: Props) {
  const [result, setResult] = useState<WoundAIResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run() {
    if (!props.file) return setError('Capture or upload a wound image first.');
    setBusy(true); setError('');
    try { const next = await analyzeWoundImage({ ...props, file: props.file }); setResult(next); if (next.analysisId) props.onAnalysisStored?.(next.analysisId); }
    catch (e) { setError(e instanceof Error ? e.message : 'Analysis failed.'); }
    finally { setBusy(false); }
  }
  const survey = result?.survey;
  const interpretation = result?.interpretation;
  const apply = () => props.onApply({
    length: survey?.measurement?.scaleAvailable ? survey.measurement.lengthCm : undefined,
    width: survey?.measurement?.scaleAvailable ? survey.measurement.widthCm : undefined,
    granulation: survey?.tissue?.granulation, slough: survey?.tissue?.slough,
    eschar: survey?.tissue?.eschar, epithelial: survey?.tissue?.epithelial,
  });
  return <section className="rounded-xl bg-[#143f3c] text-white p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><BrainCircuit className="w-5 h-5 text-teal-300"/><div><h3 className="text-sm font-semibold">AI wound image assessment</h3><p className="text-[10px] text-teal-200">Documentation support · clinician confirmation required</p></div></div><button type="button" onClick={run} disabled={busy || !props.file} className="px-3 py-2 rounded-lg bg-teal-300 text-teal-950 text-xs font-bold disabled:opacity-40">{busy ? 'Analyzing image…' : result ? 'Run again' : 'Analyze image'}</button></div>
    {error && <div className="mt-3 rounded-lg bg-red-950/40 border border-red-300/30 p-3 text-xs text-red-100 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0"/>{error}</div>}
    {!result && !error && <p className="mt-4 text-xs leading-5 text-teal-100/75">Claude evaluates visible features in two passes: visual survey and clinical interpretation. It must name findings that cannot be determined from a photograph.</p>}
    {result && <div className="mt-4 space-y-3">
      <div className="flex flex-wrap gap-2 text-[10px]"><span className="px-2 py-1 rounded bg-white/10">Grade {survey?.imageQuality?.grade || '—'}</span><span className="px-2 py-1 rounded bg-white/10">Model {result.model}</span>{result.demo && <span className="px-2 py-1 rounded bg-amber-300 text-amber-950 font-bold">DEMO RESULT</span>}{result.partial && <span className="px-2 py-1 rounded bg-amber-300 text-amber-950">PARTIAL</span>}</div>
      <div className="grid sm:grid-cols-3 gap-2">{[['Tissue', `${survey?.tissue?.granulation ?? '—'}% granulation · ${survey?.tissue?.slough ?? '—'}% slough`],['Scale', survey?.measurement?.scaleAvailable ? `${survey.measurement.lengthCm} × ${survey.measurement.widthCm} cm` : `Withheld · ${survey?.measurement?.aspectRatio || 'no aspect ratio'}`],['Classification', `${interpretation?.classification?.etiology || 'Unassessed'} · ${interpretation?.classification?.etiologyConfidence || '—'} confidence`]].map(([label,value]) => <div key={label} className="rounded-lg bg-white/7 p-3"><p className="text-[9px] uppercase tracking-widest text-teal-300">{label}</p><p className="mt-1 text-xs leading-5 text-teal-50">{value}</p></div>)}</div>
      {interpretation?.flags?.length > 0 && <div className="rounded-lg border border-red-300/30 bg-red-950/30 p-3"><p className="text-xs font-bold text-red-100">Escalation flags</p>{interpretation.flags.map((flag: any, i: number) => <p key={i} className="mt-1 text-xs text-red-100">{flag.level}: {flag.finding} — {flag.action}</p>)}</div>}
      <div className="rounded-lg bg-white/7 p-3"><p className="text-[10px] uppercase tracking-wider text-teal-300">Cannot determine from image</p><p className="mt-1 text-xs text-teal-50">{interpretation?.cannotDetermine?.join(' · ') || 'Not returned'}</p></div>
      <button type="button" onClick={apply} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-teal-300/40 text-xs font-semibold hover:bg-white/10"><Check className="w-4 h-4"/>Apply suggestions for clinician review</button>
      <p className="flex gap-1.5 text-[10px] text-teal-200"><Sparkles className="w-3 h-3 shrink-0"/>AI output remains a draft. Triage is based on confirmed structured fields.</p>
    </div>}
  </section>;
}
