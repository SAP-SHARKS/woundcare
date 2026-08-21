import { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { logAudit } from '../lib/audit';
import { X, Save, AlertTriangle, Camera, Upload, Trash2, Image } from 'lucide-react';
import WoundCamera from './WoundCamera';

interface Props {
  woundId: string;
  organizationId: string | null;
  patientId?: string;
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

export default function AssessmentForm({ woundId, organizationId, patientId, onClose, onSaved }: Props) {
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

      await supabase.from('wound_images').insert({
        assessment_id: assessmentId,
        wound_id: woundId,
        organization_id: organizationId,
        image_type: 'original',
        storage_path: storagePath,
        file_name: photo.file.name,
        mime_type: photo.file.type,
        file_size_bytes: photo.file.size,
      });
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

    try {
      const { data: assessment, error: err } = await supabase.from('wound_assessments').insert({
        wound_id: woundId,
        organization_id: organizationId,
        assessment_date: form.assessment_date,
        length_cm: l,
        width_cm: w,
        depth_cm: d,
        area_cm2: Math.round(area * 100) / 100,
        granulation_pct: form.granulation_pct,
        slough_pct: form.slough_pct,
        eschar_pct: form.eschar_pct,
        epithelial_pct: form.epithelial_pct,
        exudate_amount: form.exudate_amount,
        exudate_type: form.exudate_type,
        wound_edge: form.wound_edge,
        periwound: form.periwound,
        pain_score: form.pain_score,
        odor: form.odor,
        tunneling: form.tunneling,
        undermining: form.undermining,
        exposed_structures: form.exposed_structures,
        signs_requiring_review: form.signs_requiring_review,
        clinical_notes: form.clinical_notes,
        status: 'pending_review',
      }).select('id').single();
      if (err) throw err;

      if (assessment) {
        await uploadPhotos(assessment.id);
      }

      await logAudit('assessment.create', 'wound_assessment', woundId, organizationId);
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to save assessment');
      setSaving(false);
    }
  }

  const inputCls = 'w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 transition';
  const labelCls = 'block text-xs font-medium text-slate-600 mb-1';
  const sectionCls = 'bg-white rounded-xl border border-slate-200 p-4';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-slate-50 rounded-2xl shadow-xl w-full max-w-2xl my-6 mx-4">
        <div className="sticky top-0 z-10 bg-white rounded-t-2xl border-b border-slate-200 px-5 py-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">New Assessment</h2>
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

          {/* Photo Capture */}
          <div className={sectionCls}>
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
          </div>

          {/* Date */}
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
          <div className="flex items-center justify-between pt-2 pb-2">
            <div className="text-xs text-slate-400">{uploadProgress}</div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-white rounded-lg transition-colors">Cancel</button>
              <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 active:bg-teal-800 transition-colors shadow-sm disabled:opacity-50">
                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving...' : 'Save Assessment'}
              </button>
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
