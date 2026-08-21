import { useEffect, useMemo, useState } from 'react';
import { FlaskConical, Upload, Play, ShieldCheck, Save, Database } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { runWoundProvider, type WoundAIResult } from '../lib/woundAnalysis';

type Provider = 'anthropic' | 'openai' | 'gemini' | 'kimi';
type ProviderStatus = Record<Provider, { enabled: boolean; model: string }>;
type LabRun = { id?: string; provider: Provider; result?: WoundAIResult; error?: string; latency: number };
const PROVIDERS: Provider[] = ['anthropic','openai','gemini','kimi'];
const REASONS = ['incorrect_visible_finding','missed_visible_finding','hallucinated_finding','invalid_scale','unsafe_inference','wrong_classification','image_unassessable'];
const BODY_SITES = [
  ['lower_leg','Lower leg'], ['ankle','Ankle'], ['medial_malleolus','Ankle – medial malleolus'],
  ['lateral_malleolus','Ankle – lateral malleolus'], ['heel','Foot – heel'],
  ['plantar_forefoot','Foot – plantar forefoot'], ['dorsal_foot','Foot – dorsal'],
  ['toe','Foot – toe'], ['sacrum_coccyx','Sacrum / coccyx'], ['hip_trochanter','Hip / trochanter'],
  ['upper_leg','Upper leg'], ['hand','Hand'], ['arm','Arm'], ['abdomen_trunk','Abdomen / trunk'],
  ['other','Other'], ['not_recorded','Not recorded'],
] as const;
const LATERALITY = [['left','Left'],['right','Right'],['midline','Midline'],['not_applicable','Not applicable'],['unknown','Unknown']] as const;
const SURFACES = [['anterior','Anterior'],['posterior','Posterior'],['medial','Medial'],['lateral','Lateral'],['plantar','Plantar'],['dorsal','Dorsal'],['not_recorded','Not recorded']] as const;

export default function ModelLab() {
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [bodySite, setBodySite] = useState('not_recorded');
  const [laterality, setLaterality] = useState('unknown');
  const [surface, setSurface] = useState('not_recorded');
  const [bodySiteOther, setBodySiteOther] = useState('');
  const [skinTone, setSkinTone] = useState('not recorded');
  const [consentBasis, setConsentBasis] = useState('');
  const [deidentified, setDeidentified] = useState(false);
  const [selected, setSelected] = useState<Provider[]>(['anthropic']);
  const [runs, setRuns] = useState<LabRun[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [reviewed, setReviewed] = useState<Record<string, boolean>>({});

  useEffect(() => { fetch('/api/wound-analysis').then(r => r.json()).then(x => setStatus(x.providers)).catch(() => setStatus(null)); }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const blinded = useMemo(() => [...runs].sort((a,b) => `${a.id || a.provider}`.localeCompare(`${b.id || b.provider}`)), [runs]);

  function chooseFile(next?: File) {
    if (!next) return;
    if (preview) URL.revokeObjectURL(preview);
    setFile(next); setPreview(URL.createObjectURL(next)); setRuns([]); setReviewed({});
  }
  function toggleProvider(provider: Provider) { setSelected(current => current.includes(provider) ? current.filter(x => x !== provider) : [...current, provider]); }

  async function runComparison() {
    if (!file || !deidentified || !consentBasis.trim() || selected.length < 1) return setMessage('Add a de-identified image, document consent, and select at least one configured provider.');
    setBusy(true); setMessage(''); setRuns([]);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('A real Super Admin session is required.');
      const path = `${user.id}/${crypto.randomUUID()}.jpg`;
      const { error: uploadError } = await supabase.storage.from('model-lab').upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      const recordedBodySite = bodySite === 'other' ? bodySiteOther.trim() || 'other' : bodySite;
      const { data: labCase, error: caseError } = await supabase.from('ai_dataset_cases').insert({ image_storage_path: path, body_site: recordedBodySite, skin_tone_band: skinTone, consent_basis: consentBasis.trim(), deidentified: true, status: 'review', created_by: user.id, capture_metadata: { laterality, surface, body_site_code: bodySite } }).select('id').single();
      if (caseError) throw caseError;
      const completed = await Promise.all(selected.map(async provider => {
        const started = performance.now();
        try {
          const result = await runWoundProvider(file, provider, { bodySite: recordedBodySite, laterality, surface, skinTone });
          const latency = Math.round(performance.now() - started);
          const { data, error } = await supabase.from('ai_provider_runs').insert({ case_id: labCase.id, provider, model_version: result.model, prompt_version: result.promptVersion, status: result.partial ? 'partial' : 'complete', output: result, latency_ms: latency, created_by: user.id }).select('id').single();
          if (error) throw error;
          return { id: data.id, provider, result, latency } as LabRun;
        } catch (error) { return { provider, error: error instanceof Error ? error.message : 'Provider failed', latency: Math.round(performance.now() - started) } as LabRun; }
      }));
      setRuns(completed); setMessage('Comparison completed. Review cards are blinded until feedback is saved.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not create Model Lab case.'); }
    finally { setBusy(false); }
  }

  async function saveReview(run: LabRun, verdict: string, notes: string, reasonCodes: string[]) {
    if (!run.id) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('ai_human_reviews').insert({ run_id: run.id, reviewer_id: user?.id, verdict, notes, reason_codes: reasonCodes, blinded: true, confidence: 'moderate', field_corrections: {} });
    if (error) setMessage(error.message); else setReviewed(value => ({ ...value, [run.id!]: true }));
  }

  return <div className="space-y-6 max-w-7xl mx-auto">
    <header><div className="flex items-center gap-2 text-teal-700"><FlaskConical className="w-5 h-5"/><span className="text-xs font-bold uppercase tracking-widest">Model Lab</span></div><h1 className="text-2xl font-bold text-stone-900 mt-2">Wound AI training ground</h1><p className="text-sm text-stone-500 mt-1">Create consented dataset cases, compare providers blindly, collect expert corrections, and promote only validated releases.</p></header>
    {message && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{message}</div>}
    <div className="grid lg:grid-cols-[380px_1fr] gap-5">
      <aside className="bg-white border border-stone-200 rounded-2xl p-5 space-y-4 h-fit">
        <h2 className="font-semibold">1. Create dataset case</h2>
        <label className="block rounded-xl border-2 border-dashed border-stone-300 overflow-hidden cursor-pointer">{preview ? <img src={preview} className="w-full h-48 object-contain bg-stone-950" alt="De-identified wound case"/> : <span className="h-40 grid place-items-center text-sm text-stone-500"><Upload className="w-5 h-5 mb-1"/>Choose de-identified image</span>}<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => chooseFile(e.target.files?.[0])}/></label>
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-stone-600">Body site</label>
          <select value={bodySite} onChange={e => setBodySite(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">{BODY_SITES.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>
          {bodySite === 'other' && <input value={bodySiteOther} onChange={e => setBodySiteOther(e.target.value)} placeholder="Describe body site" className="w-full border rounded-lg px-3 py-2 text-sm"/>}
          <div className="grid grid-cols-2 gap-2">
            <select aria-label="Laterality" value={laterality} onChange={e => setLaterality(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">{LATERALITY.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>
            <select aria-label="Surface" value={surface} onChange={e => setSurface(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">{SURFACES.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>
          </div>
        </div>
        <select value={skinTone} onChange={e => setSkinTone(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm"><option>not recorded</option><option>Fitzpatrick I–II</option><option>Fitzpatrick III–IV</option><option>Fitzpatrick V–VI</option></select>
        <textarea value={consentBasis} onChange={e => setConsentBasis(e.target.value)} placeholder="Document consent or lawful basis" className="w-full border rounded-lg px-3 py-2 text-sm" rows={2}/>
        <label className="flex gap-2 text-xs text-stone-600"><input type="checkbox" checked={deidentified} onChange={e => setDeidentified(e.target.checked)}/>I confirm this training copy is de-identified and approved for model evaluation.</label>
        <h3 className="text-xs font-bold uppercase text-stone-500 pt-2">Providers</h3>
        <div className="grid grid-cols-2 gap-2">{PROVIDERS.map(provider => <button key={provider} type="button" disabled={!status?.[provider]?.enabled} onClick={() => toggleProvider(provider)} className={`rounded-lg border p-2 text-left ${selected.includes(provider) ? 'border-teal-500 bg-teal-50' : 'border-stone-200'} disabled:opacity-40`}><span className="block text-xs font-semibold capitalize">{provider}</span><span className="block text-[9px] truncate text-stone-500">{status?.[provider]?.enabled ? status[provider].model : 'Key/model not configured'}</span></button>)}</div>
        <button onClick={runComparison} disabled={busy} className="w-full flex justify-center items-center gap-2 bg-teal-700 text-white rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50"><Play className="w-4 h-4"/>{busy ? 'Running providers…' : 'Run blinded comparison'}</button>
      </aside>
      <main className="space-y-4"><div className="flex items-center justify-between"><h2 className="font-semibold">2. Blind expert review</h2><span className="text-xs text-stone-500">Provider identity reveals after review</span></div>{blinded.length === 0 ? <div className="bg-white border border-stone-200 rounded-2xl min-h-72 grid place-items-center text-center p-8"><div><Database className="w-9 h-9 text-stone-300 mx-auto"/><p className="text-sm text-stone-500 mt-3">Create a case and run two or more providers.</p></div></div> : <div className="grid xl:grid-cols-2 gap-4">{blinded.map((run,index) => <ReviewCard key={run.id || run.provider} alias={`Model ${String.fromCharCode(65+index)}`} run={run} revealed={Boolean(run.id && reviewed[run.id])} onSave={saveReview}/>)}</div>}</main>
    </div>
    <section className="bg-[#143f3c] text-white rounded-2xl p-5"><div className="flex gap-3"><ShieldCheck className="w-6 h-6 text-teal-300 shrink-0"/><div><h2 className="font-semibold">Release gate</h2><p className="text-xs text-teal-100 mt-1 leading-5">Lab results do not change the clinical scanner. A future release must be adjudicated, evaluated on a locked patient-level test set, approved, and explicitly deployed.</p></div></div></section>
  </div>;
}

function ReviewCard({ alias, run, revealed, onSave }: { alias: string; run: LabRun; revealed: boolean; onSave: (run: LabRun, verdict: string, notes: string, reasons: string[]) => void }) {
  const [verdict,setVerdict] = useState('edit'); const [notes,setNotes] = useState(''); const [reasons,setReasons] = useState<string[]>([]);
  const output = run.result; const survey = output?.survey; const interpretation = output?.interpretation;
  return <article className="bg-white border border-stone-200 rounded-2xl p-4 space-y-3"><div className="flex justify-between"><div><h3 className="font-bold">{revealed ? run.provider : alias}</h3><p className="text-[10px] text-stone-500">{run.latency} ms {revealed && output ? `· ${output.model}` : '· provider blinded'}</p></div>{run.error && <span className="text-xs text-red-600">Failed</span>}</div>{run.error ? <p className="text-xs text-red-700 bg-red-50 p-3 rounded-lg">{run.error}</p> : <><div className="grid grid-cols-2 gap-2 text-xs"><div className="bg-stone-50 rounded-lg p-2"><b>Quality</b><p>{survey?.imageQuality?.grade || '—'}</p></div><div className="bg-stone-50 rounded-lg p-2"><b>Classification</b><p>{interpretation?.classification?.etiology || '—'}</p></div><div className="bg-stone-50 rounded-lg p-2 col-span-2"><b>Tissue</b><p>{survey?.tissue?.granulation ?? '—'}% granulation · {survey?.tissue?.slough ?? '—'}% slough · {survey?.tissue?.eschar ?? '—'}% eschar</p></div></div><select value={verdict} onChange={e => setVerdict(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-xs"><option value="accept">Accept</option><option value="edit">Edit needed</option><option value="reject">Reject</option><option value="unassessable">Image unassessable</option></select><div className="flex flex-wrap gap-1">{REASONS.map(reason => <button type="button" key={reason} onClick={() => setReasons(x => x.includes(reason) ? x.filter(y => y!==reason) : [...x,reason])} className={`text-[9px] px-2 py-1 rounded ${reasons.includes(reason)?'bg-amber-100 text-amber-800':'bg-stone-100 text-stone-500'}`}>{reason.replace(/_/g,' ')}</button>)}</div><textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Expert correction notes" rows={2} className="w-full border rounded-lg px-3 py-2 text-xs"/><button type="button" onClick={() => onSave(run,verdict,notes,reasons)} className="flex items-center gap-2 px-3 py-2 bg-stone-900 text-white rounded-lg text-xs"><Save className="w-3.5 h-3.5"/>Save blind review</button></>}</article>;
}
