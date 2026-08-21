import { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { logAudit } from '../lib/audit';
import { X, Save, AlertTriangle, Camera, Upload, Trash2, Image } from 'lucide-react';
import WoundCamera from './WoundCamera';
import { enqueueOfflineAssessment, isOfflineEnabled } from '../lib/offline';
import { requireUuid } from '../lib/validation';
import WoundAIAnalysisPanel from './WoundAIAnalysisPanel';

interface Props {
  woundId: string;
  organizationId: string | null;
  patientId?: string;
  patientName?: string;
  woundLabel?: string;
  onClose: () => void;
  onSaved: () => void;
}

const EXUDATE_AMOUNTS = ['none', 'scant', 'small', 'moderate', 'large'] as const;
const EXUDATE_TYPES = ['', 'serous', 'sanguineous', 'serosanguineous', 'purulent', 'other'] as const;
const WOUND_EDGES = ['', 'attached', 'rolled', 'macerated', 'callused', 'irregular', 'undermined'] as const;
const PERIWOUND = ['', 'normal', 'erythema', 'maceration', 'edema', 'induration', 'discoloration'] as const;

interface SelectedFile {
  file: File;
  preview: string;
}

export default function AssessmentForm({ woundId, organizationId, patientId, patientName = 'Selected patient', woundLabel = 'Selected wound', onClose, onSaved }: Props) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    assessment_date: new Date().toISOString().slice(0, 10),
    length_cm: '',
    width_cm: '',
    depth_cm: '',
    granulation_pct: 50,
    slough_pct: 30,
    eschar_pct: 20,
    epithelial_pct: 0,
    exudate_amount: 'none',
    exudate_type: '',
    wound_edge: '',
    periwound: '',
    pain_score: 0,
    odor: false,
    tunneling: '',
    undermining: '',
    exposed_structures: '',
    signs_requiring_review: '',
    clinical_notes: '',
  });
  const [photos, setPhotos] = useState<SelectedFile[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [analysisApplied, setAnalysisApplied] = useState(false);
  const steps = [
    ['Patient & wound', 'confirm identity'], ['Guided capture', 'quality gate'],
    ['Measurements', 'clinician entered'], ['Observations', 'structured fields'],
    ['Triage & submit', 'rules decide'],
  ];
  const urgent = form.exudate_type === 'purulent' && (form.odor || form.pain_score >= 7);
  const needsReview = urgent || form.pain_score >= 7 || Boolean(form.signs_requiring_review.trim());

  async function handleCameraCapture(imageDataUrl: string) {
    try {
      const blob = await (await fetch(imageDataUrl)).blob();
      const file = new File([blob], `capture-${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });
      setPhotos(prev => [...prev, { file, preview: imageDataUrl }]);
      setShowCamera(false);
    } catch {
      setError('The captured image could not be prepared. Please retake it or upload an image.');
    }
  }

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function adjustTissue(key: 'granulation_pct' | 'slough_pct' | 'eschar_pct' | 'epithelial_pct', value: number) {
    const keys: (typeof key)[] = ['granulation_pct', 'slough_pct', 'eschar_pct', 'epithelial_pct'];
    const others = keys.filter(k => k !== key);
    const remaining = 100 - value;
    const otherTotal = others.reduce((s, k) => s + form[k], 0);
    const next = { ...form, [key]: value };
    if (otherTotal > 0) {
      others.forEach(k => { next[k] = Math.round((form[k] / otherTotal) * remaining); });
    } else {
      others.forEach((k, i) => { next[k] = i === 0 ? remaining : 0; });
    }
    const diff = 100 - (next.granulation_pct + next.slough_pct + next.eschar_pct + next.epithelial_pct);
    if (diff !== 0) next[others[0]] += diff;
    setForm(next);
  }

  function handleFileSelect(files: FileList | null) {
    if (!files) return;
    const newFiles: SelectedFile[] = Array.from(files)
      .filter(f => f.type.startsWith('image/'))
      .slice(0, 5 - photos.length)
      .map(file => ({ file, preview: URL.createObjectURL(file) }));
    setPhotos(prev => [...prev, ...newFiles]);
  }

  function removePhoto(index: number) {
    setPhotos(prev => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  function applyAISuggestions(suggestions: { length?: number; width?: number; granulation?: number; slough?: number; eschar?: number; epithelial?: number }) {
    setForm(prev => ({
      ...prev,
      length_cm: suggestions.length == null ? prev.length_cm : String(suggestions.length),
      width_cm: suggestions.width == null ? prev.width_cm : String(suggestions.width),
      granulation_pct: suggestions.granulation ?? prev.granulation_pct,
      slough_pct: suggestions.slough ?? prev.slough_pct,
      eschar_pct: suggestions.eschar ?? prev.eschar_pct,
      epithelial_pct: suggestions.epithelial ?? prev.epithelial_pct,
    }));
    setStep(2);
  }

  async function uploadPhotos(assessmentId: string): Promise<void> {
    if (!organizationId || photos.length === 0) return;

    for (let i = 0; i < photos.length; i++) {
      setUploadProgress(`Uploading photo ${i + 1} of ${photos.length}...`);
      const photo = photos[i];
      const ext = photo.file.name.split('.').pop() || 'jpg';
      const storagePath = `${organizationId}/${patientId || 'unknown'}/${woundId}/${assessmentId}/${Date.now()}-${i}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('wound-images')
        .upload(storagePath, photo.file, { contentType: photo.file.type, upsert: false });

      if (uploadErr) throw new Error(`Photo upload failed: ${uploadErr.message}`);

      const { error: imageRowError } = await supabase.from('wound_images').insert({
        assessment_id: assessmentId,
        wound_id: woundId,
        organization_id: organizationId,
        image_type: 'original',
        storage_path: storagePath,
        file_name: photo.file.name,
        mime_type: photo.file.type,
        file_size_bytes: photo.file.size,
      });
      if (imageRowError) throw new Error(`Photo record could not be saved: ${imageRowError.message}`);
    }
    setUploadProgress('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);

    const l = parseFloat(form.length_cm) || 0;
    const w = parseFloat(form.width_cm) || 0;
    const d = parseFloat(form.depth_cm) || 0;
    const area = l * w;

    const assessmentPayload = {
      wound_id: woundId, organization_id: organizationId, assessment_date: form.assessment_date,
      length_cm: l, width_cm: w, depth_cm: d, area_cm2: Math.round(area * 100) / 100,
      granulation_pct: form.granulation_pct, slough_pct: form.slough_pct, eschar_pct: form.eschar_pct,
      epithelial_pct: form.epithelial_pct, exudate_amount: form.exudate_amount, exudate_type: form.exudate_type,
      wound_edge: form.wound_edge, periwound: form.periwound, pain_score: form.pain_score, odor: form.odor,
      tunneling: form.tunneling, undermining: form.undermining, exposed_structures: form.exposed_structures,
      signs_requiring_review: form.signs_requiring_review, clinical_notes: form.clinical_notes, status: 'pending_review'
    };

    if (patientId?.startsWith('sample-') || woundId.startsWith('sample-')) {
      alert('Preview assessment created locally. Connect a real patient record to save it to Supabase.');
      setSaving(false);
      onSaved();
      return;
    }

    try {
      requireUuid(woundId, 'Wound episode');
      requireUuid(organizationId, 'Clinic');
      if (!navigator.onLine && isOfflineEnabled(organizationId)) {
        if (!organizationId) throw new Error('A clinic must be selected before saving offline.');
        const offlinePhotos = photos.map(photo => ({ name: photo.file.name, type: photo.file.type, file: photo.file }));
        await enqueueOfflineAssessment({ localId: crypto.randomUUID(), organizationId, patientId, woundId, createdAt: new Date().toISOString(), assessment: assessmentPayload, photos: offlinePhotos });
        alert('Saved securely on this device. WoundTrack will show it as pending until synchronization is available.'); onSaved(); return;
      }
      const { data: assessment, error: err } = await supabase.from('wound_assessments').insert(assessmentPayload).select('id').single();
      if (err) throw err;

      if (assessment) {
        await uploadPhotos(assessment.id);
        if (analysisId) {
          const { data: { user } } = await supabase.auth.getUser();
          const { error: linkError } = await supabase.from('wound_ai_analyses').update({
            assessment_id: assessment.id,
            ...(analysisApplied ? { status: 'accepted', reviewed_by: user?.id, reviewed_at: new Date().toISOString() } : {}),
          }).eq('id', analysisId);
          if (linkError) throw new Error(`Assessment saved, but its AI analysis could not be linked: ${linkError.message}`);
        }
      }

      await logAudit('assessment.create', 'wound_assessment', woundId, organizationId);
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save assessment');
      setSaving(false);
    }
  }

  const inputCls = 'w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 transition';
  const labelCls = 'block text-xs font-medium text-slate-600 mb-1';
  const sectionCls = 'bg-white rounded-xl border border-slate-200 p-4';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#f7f5f2] rounded-2xl shadow-xl w-full max-w-6xl my-3 sm:my-6 mx-2 sm:mx-4">
        <div className="sticky top-0 z-10 bg-white rounded-t-2xl border-b border-slate-200 px-5 py-4 flex items-center justify-between">
          <div><p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">Weekly check-in</p><h2 className="text-base font-semibold text-slate-900">{patientName} · {woundLabel}</h2></div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          <div className="overflow-x-auto pb-2">
            <div className="grid grid-cols-5 min-w-[720px] border-t-2 border-stone-200">
              {steps.map(([title, subtitle], index) => <button key={title} type="button" onClick={() => index < step && setStep(index)} className={`pt-3 pr-3 text-left border-t-2 -mt-0.5 ${index <= step ? 'border-teal-700' : 'border-transparent'}`}><span className={`inline-grid place-items-center w-6 h-6 rounded-full text-xs font-bold mr-2 ${index < step ? 'bg-teal-50 text-teal-700' : index === step ? 'bg-teal-700 text-white' : 'bg-stone-100 text-stone-400'}`}>{index < step ? '✓' : index + 1}</span><span className="text-xs font-semibold text-stone-800">{title}</span><span className="block ml-8 text-[10px] text-stone-500">{subtitle}</span></button>)}
            </div>
          </div>

          {step === 0 && <div className="grid lg:grid-cols-[1fr_330px] gap-4"><section className={sectionCls}><h3 className="text-base font-semibold mb-1">Confirm patient & wound</h3><p className="text-xs text-stone-500 mb-4">One wound per check-in. Confirm identity before capturing an image.</p><div className="grid sm:grid-cols-2 gap-3">{[['Patient', patientName], ['Wound', woundLabel], ['Visit type', 'Weekly wound check-in'], ['Assessment date', form.assessment_date]].map(([label,value]) => <div key={label}><span className={labelCls}>{label}</span><div className="min-h-10 px-3 py-2 rounded-lg border border-stone-200 bg-stone-50 text-sm font-medium">{value}</div></div>)}</div></section><aside className={sectionCls}><h3 className="text-sm font-semibold">Safety check</h3><p className="mt-2 text-xs leading-5 text-stone-600">Confirm the patient, wound identity, anatomical site and consent before proceeding. Images and measurements are attached only to this wound episode.</p></aside></div>}

          {/* Photo Capture */}
          {step === 1 && <><div className="grid lg:grid-cols-[1fr_330px] gap-4"><div className={sectionCls}>
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Wound Photographs</h3>

            {photos.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
                {photos.map((p, i) => (
                  <div key={i} className="relative group aspect-square rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                    <img src={p.preview} alt={`Wound photo ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      className="absolute top-1 right-1 p-1 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3 text-white" />
                    </button>
                    <div className="absolute bottom-0 inset-x-0 bg-black/40 px-1.5 py-0.5">
                      <span className="text-[10px] text-white truncate block">{p.file.name}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {photos.length < 5 && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCamera(true)}
                  className="flex-1 flex items-center justify-center gap-2 py-6 border-2 border-dashed border-teal-300 bg-teal-50/50 rounded-xl text-sm font-medium text-teal-700 hover:bg-teal-50 hover:border-teal-400 transition-colors"
                >
                  <Camera className="w-5 h-5" />
                  <span className="hidden sm:inline">Take Photo</span>
                  <span className="sm:hidden">Camera</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 py-6 border-2 border-dashed border-slate-300 bg-slate-50 rounded-xl text-sm font-medium text-slate-600 hover:bg-white hover:border-slate-400 transition-colors"
                >
                  <Upload className="w-5 h-5" />
                  <span className="hidden sm:inline">Upload Image</span>
                  <span className="sm:hidden">Upload</span>
                </button>
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={e => handleFileSelect(e.target.files)}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={e => handleFileSelect(e.target.files)}
                />
              </div>
            )}

            {photos.length === 0 && (
              <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                <Image className="w-3.5 h-3.5" /> Up to 5 photos per assessment. Camera opens on mobile.
              </p>
            )}
          </div><aside className={sectionCls}><div className="flex justify-between"><h3 className="text-sm font-semibold">Quality gate</h3><span className={`text-xs font-semibold px-2 py-1 rounded ${photos.length ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>{photos.length ? 'Image attached' : 'Awaiting capture'}</span></div><div className="mt-4 space-y-3">{['Wound fully in frame', 'Sharpness / focus reviewed', 'Lighting / glare reviewed', 'Camera perpendicular to wound', 'Scale marker recorded if used'].map(check => <div key={check} className="flex gap-2 text-xs"><span className={photos.length ? 'text-emerald-600' : 'text-stone-300'}>{photos.length ? '✓' : '●'}</span>{check}</div>)}</div><p className="mt-4 pt-4 border-t text-[11px] leading-4 text-stone-500">These are capture prompts, not validated automated image-quality results. The clinician remains responsible for accepting the image.</p></aside></div><WoundAIAnalysisPanel file={photos[0]?.file} organizationId={organizationId} woundId={woundId} patientId={patientId} bodySite={woundLabel} exudate={form.exudate_amount} onApply={(suggestions) => { applyAISuggestions(suggestions); setAnalysisApplied(true); }} onAnalysisStored={setAnalysisId}/></>}

          {/* Date */}
          {step === 2 && <>
          <div className={sectionCls}>
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Assessment Details</h3>
            <div>
              <label className={labelCls}>Assessment Date</label>
              <input type="date" value={form.assessment_date} onChange={e => set('assessment_date', e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Measurements */}
          <div className={sectionCls}>
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Measurements</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Length (cm)</label>
                <input type="number" step="0.1" min="0" value={form.length_cm} onChange={e => set('length_cm', e.target.value)} placeholder="0.0" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Width (cm)</label>
                <input type="number" step="0.1" min="0" value={form.width_cm} onChange={e => set('width_cm', e.target.value)} placeholder="0.0" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Depth (cm)</label>
                <input type="number" step="0.1" min="0" value={form.depth_cm} onChange={e => set('depth_cm', e.target.value)} placeholder="0.0" className={inputCls} />
              </div>
            </div>
            {form.length_cm && form.width_cm && (
              <div className="mt-2 text-xs text-slate-500">
                Estimated area: <span className="font-semibold text-teal-700">{(parseFloat(form.length_cm) * parseFloat(form.width_cm)).toFixed(1)} cm²</span>
              </div>
            )}
          </div>

          {/* Wound Bed */}
          <div className={sectionCls}>
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Wound Bed Composition</h3>
            <div className="space-y-3">
              {([
                { key: 'granulation_pct' as const, label: 'Granulation', color: 'bg-red-400' },
                { key: 'slough_pct' as const, label: 'Slough', color: 'bg-amber-300' },
                { key: 'eschar_pct' as const, label: 'Eschar', color: 'bg-stone-800' },
                { key: 'epithelial_pct' as const, label: 'Epithelial', color: 'bg-pink-200' },
              ]).map(t => (
                <div key={t.key} className="flex items-center gap-3">
                  <div className="flex items-center gap-2 w-24">
                    <div className={`w-2.5 h-2.5 rounded-full ${t.color}`} />
                    <span className="text-xs font-medium text-slate-600">{t.label}</span>
                  </div>
                  <input type="range" min="0" max="100" value={form[t.key]} onChange={e => adjustTissue(t.key, parseInt(e.target.value))} className="flex-1 h-1.5 accent-teal-600" />
                  <span className="text-xs font-semibold text-slate-700 w-10 text-right">{form[t.key]}%</span>
                </div>
              ))}
              <div className="flex gap-1 h-3 rounded-full overflow-hidden mt-1">
                <div className="bg-red-400 transition-all" style={{ width: `${form.granulation_pct}%` }} />
                <div className="bg-amber-300 transition-all" style={{ width: `${form.slough_pct}%` }} />
                <div className="bg-stone-800 transition-all" style={{ width: `${form.eschar_pct}%` }} />
                <div className="bg-pink-200 transition-all" style={{ width: `${form.epithelial_pct}%` }} />
              </div>
            </div>
          </div>

          {/* Exudate & Pain */}
          </>}
          {step === 3 && <>
          <div className={sectionCls}>
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Exudate & Symptoms</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Exudate Amount</label>
                <select value={form.exudate_amount} onChange={e => set('exudate_amount', e.target.value)} className={inputCls}>
                  {EXUDATE_AMOUNTS.map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Exudate Type</label>
                <select value={form.exudate_type} onChange={e => set('exudate_type', e.target.value)} className={inputCls}>
                  {EXUDATE_TYPES.map(v => <option key={v} value={v}>{v ? v.charAt(0).toUpperCase() + v.slice(1) : 'Select...'}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Wound Edge</label>
                <select value={form.wound_edge} onChange={e => set('wound_edge', e.target.value)} className={inputCls}>
                  {WOUND_EDGES.map(v => <option key={v} value={v}>{v ? v.charAt(0).toUpperCase() + v.slice(1) : 'Select...'}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Periwound Skin</label>
                <select value={form.periwound} onChange={e => set('periwound', e.target.value)} className={inputCls}>
                  {PERIWOUND.map(v => <option key={v} value={v}>{v ? v.charAt(0).toUpperCase() + v.slice(1) : 'Select...'}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-3">
              <label className={labelCls}>Pain Score (0-10)</label>
              <div className="flex items-center gap-3">
                <input type="range" min="0" max="10" value={form.pain_score} onChange={e => set('pain_score', parseInt(e.target.value))} className="flex-1 h-1.5 accent-teal-600" />
                <span className={`text-sm font-semibold w-8 text-center ${form.pain_score >= 7 ? 'text-red-600' : form.pain_score >= 4 ? 'text-amber-600' : 'text-emerald-600'}`}>{form.pain_score}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <input type="checkbox" id="odor" checked={form.odor} onChange={e => set('odor', e.target.checked)} className="rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
              <label htmlFor="odor" className="text-sm text-slate-600">Odor present</label>
            </div>
          </div>

          {/* Additional */}
          <div className={sectionCls}>
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Additional Findings</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Tunneling</label>
                <input value={form.tunneling} onChange={e => set('tunneling', e.target.value)} placeholder="Clock direction & depth" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Undermining</label>
                <input value={form.undermining} onChange={e => set('undermining', e.target.value)} placeholder="Clock direction & depth" className={inputCls} />
              </div>
            </div>
            <div className="mt-3">
              <label className={labelCls}>Exposed Structures</label>
              <input value={form.exposed_structures} onChange={e => set('exposed_structures', e.target.value)} placeholder="Bone, tendon, etc." className={inputCls} />
            </div>
            <div className="mt-3">
              <label className={labelCls}>Signs Requiring Clinical Review</label>
              <textarea value={form.signs_requiring_review} onChange={e => set('signs_requiring_review', e.target.value)} rows={2} placeholder="Any concerning findings..." className={inputCls + ' resize-none'} />
            </div>
          </div>

          {/* Clinical Notes */}
          <div className={sectionCls}>
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Clinical Notes</h3>
            <textarea value={form.clinical_notes} onChange={e => set('clinical_notes', e.target.value)} rows={3} placeholder="Assessment observations and notes..." className={inputCls + ' resize-none'} />
          </div>

          {/* Actions */}
          </>}

          {step === 4 && <div className="grid lg:grid-cols-[1fr_330px] gap-4"><div className="space-y-4"><section className={sectionCls}><div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-semibold">Triage result</h3><span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${urgent ? 'bg-red-50 text-red-700 border border-red-200' : needsReview ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>{urgent ? 'URGENT — clinician review' : needsReview ? 'NEEDS REVIEW' : 'ROUTINE'}</span></div><div className="mt-4 space-y-2">{[
            ['Infection indicators', form.exudate_type === 'purulent' && form.odor, `Purulence ${form.exudate_type === 'purulent' ? 'present' : 'not recorded'} · odor ${form.odor ? 'present' : 'absent'}`],
            ['Pain escalation', form.pain_score >= 7, `Pain score ${form.pain_score}/10`],
            ['Clinician-entered warning signs', Boolean(form.signs_requiring_review.trim()), form.signs_requiring_review || 'None entered'],
          ].map(([label,fired,detail]) => <div key={String(label)} className={`rounded-xl border p-3 ${fired ? 'bg-red-50 border-red-200' : 'bg-stone-50 border-stone-200'}`}><div className="flex gap-2"><span className={fired ? 'text-red-600' : 'text-stone-400'}>●</span><div><p className="text-sm font-semibold">{label}</p><p className="text-xs text-stone-600 mt-1">{detail}</p></div></div></div>)}</div></section><section className="rounded-xl bg-[#124f4b] text-white p-5"><p className="text-[10px] uppercase tracking-widest text-teal-200">Structured visit summary</p><p className="mt-2 text-sm leading-6 text-teal-50">Wound measures {(parseFloat(form.length_cm) || 0).toFixed(1)} × {(parseFloat(form.width_cm) || 0).toFixed(1)} cm with estimated area {((parseFloat(form.length_cm) || 0) * (parseFloat(form.width_cm) || 0)).toFixed(1)} cm². Pain is {form.pain_score}/10. Exudate is {form.exudate_amount}{form.exudate_type ? ` and ${form.exudate_type}` : ''}. This summary is generated from entered fields and requires clinician review.</p></section></div><aside className="space-y-4"><section className={sectionCls}><h3 className="text-sm font-semibold">Escalation flags</h3><p className="mt-2 text-xs leading-5 text-stone-600">{urgent ? 'Features associated with local infection were entered. Urgent clinical correlation is indicated; the image alone does not diagnose infection.' : needsReview ? 'One or more entered findings require clinician review.' : 'No configured escalation rule fired from the entered fields.'}</p></section><section className={sectionCls}><h3 className="text-sm font-semibold">Not obtainable from a photograph</h3><div className="mt-2 flex flex-wrap gap-1.5">{['Depth', 'Undermining', 'Tunnelling', 'Induration', 'Temperature', 'Odour', 'Pain', 'Blanchability'].map(x => <span key={x} className="px-2 py-1 rounded bg-stone-100 text-[10px] text-stone-600">{x} · bedside</span>)}</div></section></aside></div>}

          <div className="flex items-center justify-between pt-2 pb-2">
            <div className="text-xs text-slate-400">{uploadProgress}</div>
            <div className="flex gap-2">
              <button type="button" onClick={step === 0 ? onClose : () => setStep(s => s - 1)} className="px-4 py-2.5 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 hover:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-500/30 rounded-lg transition-colors">{step === 0 ? 'Save draft & exit' : 'Back'}</button>
              {step < 4 ? <button type="button" onClick={() => setStep(s => Math.min(4, s + 1))} disabled={step === 1 && photos.length === 0} className="px-5 py-2.5 bg-teal-700 text-white text-sm font-semibold rounded-lg hover:bg-teal-800 disabled:bg-stone-300 disabled:cursor-not-allowed">Continue</button> : <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 active:bg-teal-800 transition-colors shadow-sm disabled:opacity-50">
                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving...' : 'Save Assessment'}
              </button>}
            </div>
          </div>
        </form>
      </div>

      {showCamera && (
        <WoundCamera
          onClose={() => setShowCamera(false)}
          onCapture={handleCameraCapture}
        />
      )}
    </div>
  );
}
