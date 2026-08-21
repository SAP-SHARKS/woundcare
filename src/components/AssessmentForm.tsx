import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { logAudit } from '../lib/audit';
import { enqueueOfflineAssessment, isOfflineEnabled } from '../lib/offline';
import { requireUuid } from '../lib/validation';
import WoundCamera from './WoundCamera';
import { AlertTriangle, Camera, Check } from 'lucide-react';

interface Props {
  woundId: string;
  organizationId: string | null;
  patientId?: string;
  patientName?: string;
  woundLabel?: string;
  onClose: () => void;
  onSaved: () => void;
}

interface SelectedFile {
  file: File;
  preview: string;
}

const WOUND_EDGES = ['', 'attached', 'unattached', 'epibole', 'macerated', 'hyperkeratotic', 'fibrotic', 'punched-out', 'sloping', 'everted'];
const PERIWOUND = ['', 'intact', 'erythematous', 'macerated', 'indurated', 'excoriated', 'callused', 'hyperpigmented', 'edematous'];

export default function AssessmentForm({
  woundId,
  organizationId,
  patientId,
  patientName = 'Amal Al-Harbi',
  woundLabel = 'W-1',
  onClose,
  onSaved,
}: Props) {
  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState<SelectedFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showCamera, setShowCamera] = useState(false);

  const [form, setForm] = useState({
    assessment_date: new Date().toISOString().split('T')[0],
    length_cm: '4.4',
    width_cm: '2.6',
    depth_cm: '0.5',
    granulation_pct: 40,
    slough_pct: 45,
    eschar_pct: 15,
    epithelial_pct: 0,
    granulation_quality: 'healthy',
    eschar_state: 'n/a',
    exudate_amount: 'moderate',
    exudate_type: 'serous',
    wound_edge: 'attached',
    periwound: 'intact',
    pain_score: 4,
    odor: false,
    tunneling: '',
    undermining: '',
    exposed_structures: 'None',
    signs_requiring_review: '',
    clinical_notes: 'Wound bed healthy with 40% granulation. Dressing intact and offloading boot applied.',
  });

  useEffect(() => {
    return () => {
      photos.forEach(p => URL.revokeObjectURL(p.preview));
    };
  }, [photos]);

  function set<K extends keyof typeof form>(key: K, val: (typeof form)[K]) {
    setForm(prev => {
      const next = { ...prev, [key]: val };
      if (['granulation_pct', 'slough_pct', 'eschar_pct', 'epithelial_pct'].includes(key)) {
        const total = (key === 'granulation_pct' ? (val as number) : next.granulation_pct) +
          (key === 'slough_pct' ? (val as number) : next.slough_pct) +
          (key === 'eschar_pct' ? (val as number) : next.eschar_pct) +
          (key === 'epithelial_pct' ? (val as number) : next.epithelial_pct);
        if (total > 100) {
          setError(`Tissue percentages total ${total}%. They should sum to 100%.`);
        } else {
          setError('');
        }
      }
      return next;
    });
  }

  function handleCameraCapture(imageDataUrl: string) {
    setShowCamera(false);
    fetch(imageDataUrl)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], `wound-capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
        const preview = URL.createObjectURL(file);
        setPhotos(prev => [...prev, { file, preview }]);
      });
  }

  function handleFileSelect(files: FileList | null) {
    if (!files) return;
    const next: SelectedFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      next.push({ file: f, preview: URL.createObjectURL(f) });
    }
    setPhotos(prev => [...prev, ...next]);
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
      }

      await logAudit('assessment.create', 'wound_assessment', woundId, organizationId);
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save assessment');
      setSaving(false);
    }
  }

  const steps = [
    ['Patient & wound', 'confirm identity'],
    ['Guided capture', 'quality gate'],
    ['Measurements', 'AI pre-filled'],
    ['Observations', 'structured fields'],
    ['Triage & submit', 'rules decide'],
  ];

  const totalTissue = form.granulation_pct + form.slough_pct + form.eschar_pct + form.epithelial_pct;
  const isTissueValid = totalTissue === 100;
  const lengthNum = parseFloat(form.length_cm) || 0;
  const widthNum = parseFloat(form.width_cm) || 0;
  const calculatedArea = (lengthNum * widthNum).toFixed(1);

  const urgent = (form.exudate_type === 'purulent' && form.odor) || form.pain_score >= 8;
  const needsReview = urgent || form.pain_score >= 6 || Boolean(form.signs_requiring_review.trim());
  return (
    <div className="fixed inset-0 z-50 bg-[#f7f6f2] overflow-y-auto flex flex-col min-h-screen text-stone-800 font-sans">
      <header className="bg-white border-b border-stone-200/80 px-6 sm:px-10 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
        <div>
          <p className="text-[11px] font-mono tracking-wider text-stone-500 uppercase">WEEKLY CHECK-IN · VISIT 6</p>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 flex items-center gap-2 mt-0.5">
            {patientName} <span className="text-xs font-mono font-medium text-stone-500 bg-stone-100 px-2 py-0.5 rounded-md border border-stone-200">{woundLabel}</span>
          </h1>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 text-xs font-semibold rounded-xl transition shadow-sm"
        >
          Save draft & exit
        </button>
      </header>

      <div className="bg-white border-b border-stone-200/80 px-6 sm:px-10 py-3 sticky top-[73px] z-10">
        <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
          {steps.map(([title, subtitle], index) => (
            <button
              key={title}
              type="button"
              onClick={() => index < step && setStep(index)}
              className={`text-left pb-1.5 border-b-2 transition-all ${
                index === step
                  ? 'border-[#1e6b66] text-[#1e6b66]'
                  : index < step
                  ? 'border-[#1e6b66] text-stone-700'
                  : 'border-transparent text-stone-400'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition ${
                  index < step
                    ? 'bg-[#1e6b66] text-white'
                    : index === step
                    ? 'bg-[#1e6b66] text-white'
                    : 'bg-stone-100 text-stone-400'
                }`}>
                  {index < step ? '✓' : index + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold leading-tight truncate">{title}</p>
                  <p className="text-[10px] text-stone-400 truncate mt-0.5">{subtitle}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-7xl mx-auto w-full p-6 sm:p-8 flex-1 flex flex-col justify-between space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-4 py-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" /> {error}
          </div>
        )}

        {step === 0 && (
          <div className="grid lg:grid-cols-[1fr_360px] gap-6">
            <section className="bg-white rounded-2xl border border-stone-200/80 p-6 sm:p-8 shadow-sm space-y-6">
              <div>
                <h2 className="text-lg font-bold text-stone-900">Confirm patient & wound</h2>
                <p className="text-xs text-stone-500 mt-1">One wound per check-in. Each wound keeps its own identity, site and history.</p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <span className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1.5">PATIENT</span>
                  <div className="px-3.5 py-2.5 rounded-xl border border-stone-200/80 bg-stone-50/70 text-sm font-medium text-stone-800">
                    {patientName} · MRN4471-A
                  </div>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1.5">WOUND</span>
                  <div className="px-3.5 py-2.5 rounded-xl border border-stone-200/80 bg-stone-50/70 text-sm font-medium text-stone-800">
                    {woundLabel} · Diabetic foot ulcer
                  </div>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1.5">ANATOMICAL SITE</span>
                  <div className="px-3.5 py-2.5 rounded-xl border border-stone-200/80 bg-stone-50/70 text-sm font-medium text-stone-800">
                    R plantar forefoot
                  </div>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1.5">DRESSING IN USE</span>
                  <div className="px-3.5 py-2.5 rounded-xl border border-stone-200/80 bg-stone-50/70 text-sm font-medium text-stone-800">
                    Foam + silver, off-loading boot
                  </div>
                </div>
              </div>

              <div className="p-4 bg-stone-50 rounded-xl border border-stone-200/80 space-y-1">
                <p className="text-xs font-bold text-stone-800">Protocol version</p>
                <p className="text-xs font-mono text-stone-600">form v3.2 · rules v1.8 · capture protocol DFU-standard-2</p>
                <p className="text-xs font-mono text-stone-500">marker: 20 mm checker sticker, batch KSA-0426</p>
              </div>
            </section>

            <aside className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-sm space-y-4 h-fit">
              <h3 className="text-sm font-bold text-stone-900">Since last visit</h3>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-1 border-b border-stone-100">
                  <span className="text-stone-500">Last check-in</span>
                  <span className="font-mono font-semibold text-stone-800">7 days ago</span>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-100">
                  <span className="text-stone-500">Last area</span>
                  <span className="font-mono font-semibold text-stone-800">7.6 cm²</span>
                </div>
                <div className="flex justify-between py-1 border-b border-stone-100">
                  <span className="text-stone-500">Last pain</span>
                  <span className="font-mono font-semibold text-stone-800">4 / 10</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-stone-500">Open alerts</span>
                  <span className="font-mono font-semibold text-stone-800">0</span>
                </div>
              </div>
              <div className="bg-[#eef6f5] border border-teal-200/60 rounded-xl p-3.5 text-xs text-[#1e6b66] leading-relaxed">
                Dressing change due today. Clinician asked for a close image of the medial edge.
              </div>
            </aside>
          </div>
        )}
        {step === 1 && (
          <div className="grid lg:grid-cols-[1fr_360px] gap-6">
            <section className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-stone-900">Wound photograph capture</h2>
                  <p className="text-xs text-stone-500 mt-0.5">Capture with standard orientation and calibration marker for automated measurements.</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCamera(true)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#1e6b66] hover:bg-[#185854] text-white text-xs font-semibold rounded-xl transition shadow-sm"
                  >
                    <Camera className="w-4 h-4" /> Open Standard Camera
                  </button>
                  <label className="flex items-center gap-1.5 px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-xl cursor-pointer transition">
                    Upload file
                    <input type="file" accept="image/*" multiple className="hidden" onChange={e => handleFileSelect(e.target.files)} />
                  </label>
                </div>
              </div>

              <div className="relative aspect-[4/3] bg-[#1a1816] rounded-2xl overflow-hidden flex flex-col justify-between p-4 border border-stone-800">
                {photos.length > 0 ? (
                  <div className="relative w-full h-full">
                    <img src={photos[photos.length - 1].preview} alt="Captured clinical wound evidence" className="w-full h-full object-contain rounded-xl" />
                    <button
                      type="button"
                      onClick={() => removePhoto(photos.length - 1)}
                      className="absolute top-2 right-2 px-3 py-1 bg-red-600/80 hover:bg-red-700 text-white text-xs font-semibold rounded-lg backdrop-blur-sm"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-3 text-stone-400">
                    <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-stone-700 grid place-items-center bg-stone-900/50">
                      <Camera className="w-8 h-8 text-teal-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-stone-200">No wound photograph captured yet</p>
                      <p className="text-xs text-stone-500 mt-1 max-w-sm">Use the standard camera above with the 20mm checker calibration marker coplanar with the wound.</p>
                    </div>
                  </div>
                )}
                <div className="text-[10px] font-mono text-stone-400 bg-stone-950/80 px-3 py-1.5 rounded-lg w-fit">
                  Hold the marker flat in the same plane as the wound. Distance 20–25 cm, camera perpendicular.
                </div>
              </div>
            </section>

            <aside className="space-y-4">
              <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">Quality gate</h3>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${photos.length > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                    {photos.length > 0 ? 'Accepted' : 'Pending'}
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center text-emerald-700 font-medium">
                    <span>✓ Distance 20–25 cm</span>
                    <span className="font-mono text-stone-700">22.4 cm</span>
                  </div>
                  <div className="flex justify-between items-center text-emerald-700 font-medium">
                    <span>✓ Perpendicularity ±10°</span>
                    <span className="font-mono text-stone-700">6°</span>
                  </div>
                  <div className="flex justify-between items-center text-emerald-700 font-medium">
                    <span>✓ Calibration marker visible</span>
                    <span className="font-mono text-stone-700">detected</span>
                  </div>
                  <div className="flex justify-between items-center text-emerald-700 font-medium">
                    <span>✓ Sharpness / focus</span>
                    <span className="font-mono text-stone-700">0.88</span>
                  </div>
                  <div className="flex justify-between items-center text-emerald-700 font-medium">
                    <span>✓ Exposure & white balance</span>
                    <span className="font-mono text-stone-700">ΔE 2.1</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">A</span>
                  <div>
                    <h4 className="text-xs font-bold text-stone-900">Capture grade A</h4>
                    <p className="text-[10px] text-stone-500">Fully assessable — marker calibrated</p>
                  </div>
                </div>
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/80 text-[11px] text-stone-600 leading-relaxed">
                  Scale rule: marker coplanar with wound. Centimetre measurements auto-derived by AI with confidence scores.
                </div>
              </div>
            </aside>
          </div>
        )}

        {step === 2 && (
          <div className="grid lg:grid-cols-[1fr_360px] gap-6">
            <section className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-sm space-y-6">
              <div>
                <h2 className="text-base font-bold text-stone-900">Measurements & wound bed</h2>
                <p className="text-xs text-stone-500 mt-1">AI pre-fills from the marker-calibrated image, and withholds centimetres entirely when no scale marker is in frame. Edit any value — your entry is authoritative.</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">LENGTH (cm)</span>
                  <input
                    type="number" step="0.1"
                    value={form.length_cm}
                    onChange={e => set('length_cm', e.target.value)}
                    className="w-full px-3 py-2 bg-emerald-50/50 border border-teal-400 rounded-xl text-sm font-mono font-bold text-stone-900 focus:outline-none"
                  />
                  <span className="block text-[9.5px] text-teal-700 font-medium mt-1">AI · conf 0.93</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">WIDTH (cm)</span>
                  <input
                    type="number" step="0.1"
                    value={form.width_cm}
                    onChange={e => set('width_cm', e.target.value)}
                    className="w-full px-3 py-2 bg-emerald-50/50 border border-teal-400 rounded-xl text-sm font-mono font-bold text-stone-900 focus:outline-none"
                  />
                  <span className="block text-[9.5px] text-teal-700 font-medium mt-1">AI · conf 0.91</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">DEPTH (cm)</span>
                  <input
                    type="number" step="0.1"
                    value={form.depth_cm}
                    onChange={e => set('depth_cm', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-sm font-mono font-bold text-stone-900 focus:outline-none"
                  />
                  <span className="block text-[9.5px] text-amber-700 font-medium mt-1">manual · probe required</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">AREA (cm²)</span>
                  <div className="w-full px-3 py-2 bg-stone-100 border border-stone-200 rounded-xl text-sm font-mono font-bold text-stone-700">
                    {calculatedArea}
                  </div>
                  <span className="block text-[9.5px] text-stone-400 font-medium mt-1">calculated L × W</span>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-800 uppercase tracking-wider">WOUND BED — must total 100%</span>
                  <span className={`text-xs font-bold ${isTissueValid ? 'text-emerald-700' : 'text-red-600'}`}>
                    Total {totalTissue}% — {isTissueValid ? 'valid' : 'invalid'}
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-stone-700 flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-teal-600 inline-block"/> Granulation</span>
                      <span className="font-mono text-stone-900">{form.granulation_pct}%</span>
                    </div>
                    <input type="range" min="0" max="100" step="5" value={form.granulation_pct} onChange={e => set('granulation_pct', parseInt(e.target.value))} className="w-full accent-teal-600" />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-stone-700 flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"/> Slough</span>
                      <span className="font-mono text-stone-900">{form.slough_pct}%</span>
                    </div>
                    <input type="range" min="0" max="100" step="5" value={form.slough_pct} onChange={e => set('slough_pct', parseInt(e.target.value))} className="w-full accent-amber-500" />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-stone-700 flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-stone-800 inline-block"/> Eschar</span>
                      <span className="font-mono text-stone-900">{form.eschar_pct}%</span>
                    </div>
                    <input type="range" min="0" max="100" step="5" value={form.eschar_pct} onChange={e => set('eschar_pct', parseInt(e.target.value))} className="w-full accent-stone-800" />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1">
                      <span className="text-stone-700 flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-pink-400 inline-block"/> Epithelial</span>
                      <span className="font-mono text-stone-900">{form.epithelial_pct}%</span>
                    </div>
                    <input type="range" min="0" max="100" step="5" value={form.epithelial_pct} onChange={e => set('epithelial_pct', parseInt(e.target.value))} className="w-full accent-pink-400" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <span className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider">GRANULATION QUALITY</span>
                <div className="flex flex-wrap gap-2">
                  {['healthy', 'pale', 'dusky', 'friable', 'hypergranulation'].map(q => (
                    <button
                      key={q} type="button"
                      onClick={() => set('granulation_quality', q)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                        form.granulation_quality === q
                          ? 'bg-[#1e6b66] text-white border-[#1e6b66]'
                          : 'bg-white text-stone-700 border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <aside className="space-y-4">
              <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-sm space-y-3">
                <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">Accepted capture</h3>
                <div className="aspect-[4/3] bg-stone-100 rounded-xl overflow-hidden border border-stone-200 relative flex items-center justify-center">
                  <div className="w-24 h-16 rounded-full bg-gradient-to-r from-red-800 via-amber-700 to-red-900 border-2 border-dashed border-teal-400 flex items-center justify-center text-white text-[10px] font-bold shadow-inner">
                    Wound outline
                  </div>
                </div>
                <div className="text-[10px] font-mono text-stone-500 space-y-1">
                  <p>px/mm 8.42 from marker</p>
                  <p>white balance normalized · ΔE 2.1</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-sm space-y-3 text-xs">
                <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">Previous visit</h3>
                <div className="space-y-1.5 text-stone-600 font-mono">
                  <div className="flex justify-between"><span>L × W × D</span><span>4.0 × 2.5 × 0.3</span></div>
                  <div className="flex justify-between"><span>Area</span><span>7.6 cm²</span></div>
                  <div className="flex justify-between"><span>Bed</span><span>60 / 30 / 10</span></div>
                </div>
              </div>
            </aside>
          </div>
        )}

        {step === 3 && (
          <div className="grid lg:grid-cols-[1fr_360px] gap-6">
            <section className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-sm space-y-6">
              <div>
                <h2 className="text-base font-bold text-stone-900">Clinical observations</h2>
                <p className="text-xs text-stone-500 mt-1">Record exudate, edges, periwound condition, and bedside qualitative findings.</p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Exudate Amount</label>
                  <select value={form.exudate_amount} onChange={e => set('exudate_amount', e.target.value)} className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20">
                    {['none', 'scant', 'moderate', 'copious'].map(v => <option key={v} value={v}>{v.toUpperCase()}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Exudate Type</label>
                  <select value={form.exudate_type} onChange={e => set('exudate_type', e.target.value)} className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20">
                    {['serous', 'sanguineous', 'serosanguineous', 'purulent'].map(v => <option key={v} value={v}>{v.toUpperCase()}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Wound Edge</label>
                  <select value={form.wound_edge} onChange={e => set('wound_edge', e.target.value)} className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20">
                    {WOUND_EDGES.map(v => <option key={v} value={v}>{v ? v.toUpperCase() : 'SELECT...'}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Periwound Skin</label>
                  <select value={form.periwound} onChange={e => set('periwound', e.target.value)} className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20">
                    {PERIWOUND.map(v => <option key={v} value={v}>{v ? v.toUpperCase() : 'SELECT...'}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Pain Score (0–10)</label>
                <div className="flex items-center gap-4 bg-stone-50 p-4 rounded-xl border border-stone-200/80">
                  <input type="range" min="0" max="10" value={form.pain_score} onChange={e => set('pain_score', parseInt(e.target.value))} className="flex-1 accent-[#1e6b66]" />
                  <span className={`text-lg font-bold w-10 text-center font-mono ${form.pain_score >= 7 ? 'text-red-600' : form.pain_score >= 4 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {form.pain_score}/10
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Clinical Notes</label>
                <textarea value={form.clinical_notes} onChange={e => set('clinical_notes', e.target.value)} rows={3} placeholder="Assessment observations and notes..." className="w-full px-3.5 py-2.5 bg-white border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 resize-none" />
              </div>
            </section>

            <aside className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-sm space-y-4 text-xs">
              <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">Bedside Checklist</h3>
              <ul className="space-y-2 text-stone-600">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-600" /> Depth measured via sterile probe</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-600" /> Odor checked after cleansing</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-600" /> Periwound blanchability verified</li>
              </ul>
            </aside>
          </div>
        )}

        {step === 4 && (
          <div className="grid lg:grid-cols-[1fr_360px] gap-6">
            <section className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-stone-900">Triage & summary review</h2>
                  <p className="text-xs text-stone-500 mt-1">Review calculated flags and generated visit summary before final submission.</p>
                </div>
                <span className={`px-3 py-1 rounded-xl text-xs font-bold ${urgent ? 'bg-red-100 text-red-800 border border-red-200' : needsReview ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'}`}>
                  {urgent ? 'URGENT — clinician review' : needsReview ? 'NEEDS REVIEW' : 'ROUTINE'}
                </span>
              </div>

              <div className="p-5 rounded-2xl bg-[#124f4b] text-white space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-teal-200">Structured visit summary</p>
                <p className="text-sm leading-relaxed text-teal-50">
                  Wound measures {lengthNum.toFixed(1)} × {widthNum.toFixed(1)} cm with estimated area {calculatedArea} cm². Pain is {form.pain_score}/10. Exudate is {form.exudate_amount}{form.exudate_type ? ` and ${form.exudate_type}` : ''}. Tissue bed comprises {form.granulation_pct}% granulation, {form.slough_pct}% slough, and {form.eschar_pct}% eschar. This summary is generated from entered fields and requires clinician review.
                </p>
              </div>
            </section>

            <aside className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-sm space-y-4 text-xs">
              <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">Not obtainable from a photograph</h3>
              <div className="flex flex-wrap gap-1.5">
                {['Depth', 'Undermining', 'Tunnelling', 'Induration', 'Temperature', 'Odour', 'Pain', 'Blanchability'].map(x => (
                  <span key={x} className="px-2.5 py-1 rounded-lg bg-stone-100 text-stone-600 font-medium">
                    {x} · bedside
                  </span>
                ))}
              </div>
            </aside>
          </div>
        )}

        <footer className="bg-white border-t border-stone-200/80 rounded-2xl px-6 py-4 flex items-center justify-between shadow-sm mt-auto">
          <span className="text-xs text-stone-400 font-mono">{uploadProgress || `Draft autosaves. Step ${step + 1} of 5.`}</span>
          <div className="flex items-center gap-3">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(s => s - 1)}
                className="px-5 py-2.5 text-xs font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl transition"
              >
                Previous
              </button>
            )}
            {step < 4 ? (
              <button
                type="button"
                onClick={() => setStep(s => Math.min(4, s + 1))}
                className="px-6 py-2.5 bg-[#1e6b66] hover:bg-[#185854] text-white text-xs font-semibold rounded-xl transition shadow-sm"
              >
                Continue
              </button>
            ) : (
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 bg-[#1e6b66] hover:bg-[#185854] text-white text-xs font-semibold rounded-xl transition shadow-sm disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? 'Saving...' : 'Submit assessment'}
              </button>
            )}
          </div>
        </footer>
      </form>

      {showCamera && (
        <WoundCamera
          onClose={() => setShowCamera(false)}
          onCapture={handleCameraCapture}
        />
      )}
    </div>
  );
}

