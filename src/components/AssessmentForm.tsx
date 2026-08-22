import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { logAudit } from '../lib/audit';
import { enqueueOfflineAssessment, isOfflineEnabled } from '../lib/offline';
import { requireUuid } from '../lib/validation';
import WoundCamera from './WoundCamera';
import WoundAIAnalysisPanel from './WoundAIAnalysisPanel';
import type { WoundAIResult } from '../lib/woundAnalysis';
import { AlertTriangle, Camera } from 'lucide-react';

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
  const [notice, setNotice] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [qualityResult, setQualityResult] = useState<WoundAIResult | null>(null);
  const [aiSuggestionsApplied, setAiSuggestionsApplied] = useState(false);
  const [skinTone, setSkinTone] = useState('not recorded');
  const [moistureBalance, setMoistureBalance] = useState('');
  const [treatmentDressing, setTreatmentDressing] = useState('');
  const [treatmentProcedure, setTreatmentProcedure] = useState('');
  const [painRecorded, setPainRecorded] = useState(false);

  const [form, setForm] = useState({
    assessment_date: new Date().toISOString().split('T')[0],
    length_cm: '',
    width_cm: '',
    depth_cm: '',
    granulation_pct: 0,
    slough_pct: 0,
    eschar_pct: 0,
    epithelial_pct: 0,
    granulation_quality: '',
    eschar_state: '',
    exudate_amount: '',
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

  function toggleCsv(key: 'wound_edge' | 'periwound' | 'signs_requiring_review', value: string) {
    const current = form[key].split(',').map(item => item.trim()).filter(Boolean);
    set(key, current.includes(value) ? current.filter(item => item !== value).join(', ') : [...current, value].join(', '));
  }

  function handleCameraCapture(imageDataUrl: string) {
    setShowCamera(false);
    fetch(imageDataUrl)
      .then(res => res.blob())
      .then(blob => {
        const file = new File([blob], `wound-capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
        const preview = URL.createObjectURL(file);
        setPhotos(prev => [...prev, { file, preview }]);
        setQualityResult(null);
        setAiSuggestionsApplied(false);
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
    setQualityResult(null);
    setAiSuggestionsApplied(false);
  }

  function removePhoto(index: number) {
    setPhotos(prev => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
    setQualityResult(null);
    setAiSuggestionsApplied(false);
  }

  function applyAIResult(result: WoundAIResult) {
    const measurement = result.survey?.measurement;
    const tissue = result.survey?.tissue;
    const hasScale = Boolean(measurement?.scaleAvailable);
    const allowedEdges = new Set(WOUND_EDGES.filter(Boolean));
    const allowedPeriwound = new Set(PERIWOUND.filter(Boolean));
    const edges = Array.isArray(result.survey?.edges?.findings) ? result.survey.edges.findings.filter((value: string) => allowedEdges.has(value)) : [];
    const periwound = Array.isArray(result.survey?.periwound?.findings) ? result.survey.periwound.findings.filter((value: string) => allowedPeriwound.has(value)) : [];
    const moisture = result.survey?.moisture?.state;
    setForm(prev => ({
      ...prev,
      length_cm: hasScale && measurement?.lengthCm != null ? String(measurement.lengthCm) : '',
      width_cm: hasScale && measurement?.widthCm != null ? String(measurement.widthCm) : '',
      granulation_pct: tissue?.granulation ?? prev.granulation_pct,
      slough_pct: tissue?.slough ?? prev.slough_pct,
      eschar_pct: tissue?.eschar ?? prev.eschar_pct,
      epithelial_pct: tissue?.epithelial ?? prev.epithelial_pct,
      granulation_quality: tissue?.granulationQuality || prev.granulation_quality,
      eschar_state: tissue?.escharState || prev.eschar_state,
      exposed_structures: Array.isArray(tissue?.exposedStructures) ? tissue.exposedStructures.join(', ') : prev.exposed_structures,
      wound_edge: edges.length ? edges.join(', ') : prev.wound_edge,
      periwound: periwound.length ? periwound.join(', ') : prev.periwound,
    }));
    if (['desiccated', 'moist', 'wet', 'saturated'].includes(moisture)) setMoistureBalance(moisture);
    setAiSuggestionsApplied(true);
    setError('');
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
    if (step < 4) {
      setStep(current => Math.min(4, current + 1));
      return;
    }
    setError('');
    setNotice('');
    if (!isTissueValid) {
      setError(`Tissue percentages total ${totalTissue}%. Confirm values totaling 100% before submission.`);
      setStep(2);
      return;
    }
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
      wound_edge: form.wound_edge || null, periwound: form.periwound || null, pain_score: painRecorded ? form.pain_score : null, odor: form.odor,
      tunneling: form.tunneling, undermining: form.undermining, exposed_structures: form.exposed_structures,
      signs_requiring_review: form.signs_requiring_review,
      clinical_notes: [form.clinical_notes, `Structured context: skin tone ${skinTone}; moisture ${moistureBalance || 'not recorded'}; dressing ${treatmentDressing || 'not recorded'}; procedure ${treatmentProcedure || 'not recorded'}.`].filter(Boolean).join('\\n'),
      status: 'pending_review'
    };

    if (patientId?.startsWith('sample-') || woundId.startsWith('sample-')) {
      setNotice('Preview assessment saved locally for this session. Select a real patient record to save an assessment to Supabase.');
      setSaving(false);
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
    ['Measurements', 'AI-assisted review'],
    ['Observations', 'structured fields'],
    ['Triage & submit', 'rules decide'],
  ];

  const totalTissue = form.granulation_pct + form.slough_pct + form.eschar_pct + form.epithelial_pct;
  const isTissueValid = totalTissue === 100;
  const parsedLength = parseFloat(form.length_cm);
  const parsedWidth = parseFloat(form.width_cm);
  const hasDimensions = Number.isFinite(parsedLength) && Number.isFinite(parsedWidth);
  const lengthNum = hasDimensions ? parsedLength : 0;
  const widthNum = hasDimensions ? parsedWidth : 0;
  const calculatedArea = hasDimensions ? (lengthNum * widthNum).toFixed(1) : '—';

  const urgent = (form.exudate_type === 'purulent' && form.odor) || (painRecorded && form.pain_score >= 8);
  const needsReview = urgent || (painRecorded && form.pain_score >= 6) || Boolean(form.signs_requiring_review.trim());
  const qualityGrade = qualityResult?.survey?.imageQuality?.grade as string | undefined;
  const markerDetected = Boolean(qualityResult?.survey?.imageQuality?.scaleReference);
  const qualityStatus = !qualityResult ? (photos.length ? 'Awaiting analysis' : 'Awaiting capture')
    : qualityGrade === 'D' ? 'Rejected'
    : qualityGrade === 'C' ? 'Review'
    : markerDetected ? 'Passed'
    : 'Usable — no scale';
  const qualityTone = qualityStatus === 'Passed' ? 'success' : qualityStatus === 'Rejected' ? 'danger' : qualityResult ? 'warning' : 'neutral';
  return (
    <div className="fixed inset-0 z-50 bg-[#f7f6f2] overflow-y-auto flex flex-col min-h-screen text-stone-800 font-sans">
      <header className="bg-white border-b border-stone-200/80 px-4 sm:px-10 py-4 flex items-center justify-between gap-3 sticky top-0 z-20 shadow-sm">
        <div>
          <p className="text-[11px] font-mono tracking-wider text-stone-500 uppercase">NEW WOUND CHECK-IN</p>
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

      <div className="bg-white border-b border-stone-200/80 px-4 sm:px-10 py-3 sticky top-[73px] z-10">
        <div className="max-w-7xl mx-auto flex sm:grid sm:grid-cols-5 gap-3 sm:gap-4 overflow-x-auto sm:overflow-visible snap-x touch-pan-x">
          {steps.map(([title, subtitle], index) => (
            <button
              key={title}
              type="button"
              onClick={() => index < step && setStep(index)}
              className={`min-w-[145px] sm:min-w-0 snap-start text-left pb-1.5 border-b-2 transition-all ${ 
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

      <form onSubmit={handleSubmit} className="max-w-7xl mx-auto w-full min-w-0 p-3 sm:p-8 flex-1 flex flex-col justify-between space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-4 py-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" /> {error}
          </div>
        )}
        {notice && (
          <div role="status" className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl px-4 py-3">
            {notice}
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
                  <button type="button" onClick={() => setShowCamera(true)} aria-label="Open standard camera to capture a wound photograph" className="group flex-1 w-full flex flex-col items-center justify-center text-center p-6 space-y-3 text-stone-400 rounded-xl cursor-pointer hover:bg-stone-900/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 transition">
                    <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-stone-700 grid place-items-center bg-stone-900/50 group-hover:border-teal-400 group-hover:bg-teal-950/30 transition">
                      <Camera className="w-8 h-8 text-teal-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-stone-200">No wound photograph captured yet</p>
                      <p className="text-xs text-stone-500 mt-1 max-w-sm group-hover:text-stone-400">Tap here to open the standard camera. Keep the 20mm checker calibration marker coplanar with the wound.</p>
                    </div>
                  </button>
                )}
                <div className="text-[10px] font-mono text-stone-400 bg-stone-950/80 px-3 py-1.5 rounded-lg w-fit">
                  Hold the marker flat in the same plane as the wound. Distance 20–25 cm, camera perpendicular.
                </div>
              </div>
              <WoundAIAnalysisPanel
                file={photos[photos.length - 1]?.file}
                organizationId={organizationId}
                woundId={woundId}
                patientId={patientId}
                bodySite={woundLabel}
                exudate={form.exudate_amount}
                onResult={result => { setQualityResult(result); setAiSuggestionsApplied(false); }}
                onApply={applyAIResult}
              />
            </section>

            <aside className="space-y-4">
              <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-stone-900">Quality gate</h3>
                  <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${qualityTone === 'success' ? 'bg-emerald-100 text-emerald-800' : qualityTone === 'danger' ? 'bg-red-100 text-red-800' : qualityTone === 'warning' ? 'bg-amber-100 text-amber-800' : 'bg-stone-100 text-stone-600'}`}>
                    {qualityStatus}
                  </span>
                </div>
                <QualityGateRows result={qualityResult} />
                <p className="pt-3 border-t border-stone-200 text-[11px] leading-5 text-stone-500">Bad input is flagged before suggestions are applied. Distance and angle remain unmeasured unless a validated sensor or calibration pipeline supplies them.</p>
              </div>

              <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`w-8 h-8 rounded-lg text-white font-bold text-sm flex items-center justify-center ${qualityTone === 'success' ? 'bg-emerald-600' : qualityTone === 'danger' ? 'bg-red-600' : qualityResult ? 'bg-amber-600' : 'bg-stone-400'}`}>{qualityGrade || '—'}</span>
                  <div>
                    <h4 className="text-xs font-bold text-stone-900">Capture grade {qualityResult?.survey?.imageQuality?.grade || 'pending'}</h4>
                    <p className="text-[10px] text-stone-500">{qualityResult ? (qualityResult.survey?.imageQuality?.limitations?.join(' · ') || 'No quality limitation reported') : 'Run image analysis to assess the captured frame'}</p>
                  </div>
                </div>
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/80 text-[11px] text-stone-600 leading-relaxed">
                  Scale rule: without a visible marker coplanar with the wound, centimetre measurements are withheld.
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
                <p className="text-xs text-stone-500 mt-1">AI suggestions are separate until you apply them. Confirmed fields below drive the graphs, summary, and saved clinical record.</p>
              </div>

              {qualityResult && (
                <div className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${aiSuggestionsApplied ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                  <div>
                    <p className={`text-xs font-bold ${aiSuggestionsApplied ? 'text-emerald-900' : 'text-amber-900'}`}>{aiSuggestionsApplied ? 'AI suggestions applied for clinician review' : 'AI result has not been applied to the confirmed record'}</p>
                    <p className="mt-1 text-[11px] text-stone-600">AI tissue: {qualityResult.survey?.tissue?.granulation ?? '—'}% granulation, {qualityResult.survey?.tissue?.slough ?? '—'}% slough, {qualityResult.survey?.tissue?.eschar ?? '—'}% eschar. {qualityResult.survey?.measurement?.scaleAvailable ? `Calibrated size: ${qualityResult.survey.measurement.lengthCm} × ${qualityResult.survey.measurement.widthCm} cm.` : 'Centimetre measurements withheld because no usable scale marker was detected.'}</p>
                  </div>
                  {!aiSuggestionsApplied && <button type="button" onClick={() => applyAIResult(qualityResult)} className="shrink-0 px-3 py-2 rounded-lg bg-[#1e6b66] text-white text-xs font-bold">Apply AI suggestions</button>}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">LENGTH (cm)</span>
                  <input
                    type="number" step="0.1"
                    value={form.length_cm}
                    onChange={e => set('length_cm', e.target.value)}
                    placeholder="Not recorded"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-sm font-mono font-bold text-stone-900 focus:outline-none"
                  />
                  <span className="block text-[9.5px] text-stone-500 font-medium mt-1">{aiSuggestionsApplied && markerDetected ? 'AI-assisted · clinician editable' : form.length_cm ? 'clinician entry' : 'not recorded'}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">WIDTH (cm)</span>
                  <input
                    type="number" step="0.1"
                    value={form.width_cm}
                    onChange={e => set('width_cm', e.target.value)}
                    placeholder="Not recorded"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-sm font-mono font-bold text-stone-900 focus:outline-none"
                  />
                  <span className="block text-[9.5px] text-stone-500 font-medium mt-1">{aiSuggestionsApplied && markerDetected ? 'AI-assisted · clinician editable' : form.width_cm ? 'clinician entry' : 'not recorded'}</span>
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
                <span className="block text-xs font-bold text-stone-500 uppercase tracking-wide">WOUND BED — must total 100%</span>

                <div className="space-y-3">
                  {([
                    ['granulation_pct', 'Granulation', '#cf6d5c'],
                    ['slough_pct', 'Slough', '#d9bd80'],
                    ['eschar_pct', 'Eschar', '#4a433e'],
                    ['epithelial_pct', 'Epithelial', '#e5a795'],
                  ] as const).map(([key, label, color]) => (
                    <div key={key} className="grid grid-cols-[90px_minmax(0,1fr)_40px] sm:grid-cols-[240px_minmax(180px,1fr)_64px] items-center gap-2 sm:gap-5">
                      <span className="flex items-center gap-3 text-sm font-medium text-stone-800"><span className="w-3 h-3 rounded-[4px] shrink-0" style={{ backgroundColor: color }}/>{label}</span>
                      <input aria-label={`${label} percentage`} type="range" min="0" max="100" step="5" value={form[key]} onChange={e => set(key, parseInt(e.target.value))} className="w-full accent-[#237b76]" />
                      <output className="font-mono text-sm font-bold text-stone-900 text-right">{form[key]}%</output>
                    </div>
                  ))}
                </div>

                <div role="status" className={`font-mono text-xs sm:text-sm font-bold ${isTissueValid ? 'text-emerald-700' : 'text-amber-700'}`}>
                  Total {totalTissue}% — {isTissueValid ? 'valid' : 'must equal 100% before submission'}
                </div>
              </div>

              <div className="space-y-2 pt-5 border-t border-stone-200">
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
                  {photos.length ? <img src={photos[photos.length - 1].preview} alt="Accepted wound capture" className="w-full h-full object-contain" /> : <span className="text-xs text-stone-400">No capture available</span>}
                </div>
                <div className="text-[10px] font-mono text-stone-500 space-y-1">
                  <p>{markerDetected ? 'Calibration marker detected' : 'Calibrated scale not available'}</p>
                  <p>{qualityResult ? `Image quality grade ${qualityGrade || 'not reported'}` : 'Image analysis not run'}</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-sm space-y-2 text-xs">
                <h3 className="text-xs font-bold text-stone-900 uppercase tracking-wider">Previous visit</h3>
                <p className="text-stone-500 leading-5">No verified prior assessment was loaded for this check-in. Trend comparisons will appear only when linked assessment data is available.</p>
              </div>
            </aside>
          </div>
        )}

        {step === 3 && (
          <div className="grid xl:grid-cols-[minmax(0,1fr)_360px] gap-5 items-start">
            <section className="bg-white rounded-2xl border border-stone-200/80 p-5 sm:p-6 shadow-sm space-y-7">
              <div><h2 className="text-base font-bold text-stone-900">Structured observations</h2><p className="text-xs text-stone-500 mt-1">Controlled terminology keeps visits comparable. Free text is for context only.</p></div>
              <div className="grid lg:grid-cols-2 gap-6">
                <ObservationChips label="Exudate amount" options={[['none','None'],['scant','Light'],['moderate','Moderate'],['copious','Heavy']]} selected={[form.exudate_amount]} onToggle={value => set('exudate_amount', value)} />
                <ObservationChips label="Exudate type" options={[['serous','Serous'],['serosanguineous','Serosanguinous'],['sanguineous','Sanguineous'],['purulent','Purulent']]} selected={[form.exudate_type]} onToggle={value => set('exudate_type', value)} />
              </div>
              <div><div className="flex flex-wrap items-baseline gap-3 mb-2"><span className="text-xs font-bold text-stone-500 uppercase">Pain (0–10) · bedside only</span><b className="text-base">{painRecorded ? form.pain_score : 'Not recorded'}</b></div><input aria-label="Pain score" type="range" min="0" max="10" value={form.pain_score} onChange={e => { set('pain_score', parseInt(e.target.value)); setPainRecorded(true); }} className="w-full accent-[#237b76]" /><button type="button" onClick={() => setPainRecorded(false)} className="mt-2 text-[11px] text-stone-500 underline">Clear pain entry</button></div>
              <ObservationChips label="Periwound & infection signs — select all present" options={[['redness_gt_2cm','Redness > 2 cm'],['warmth','Warmth'],['swelling','Swelling'],['maceration','Maceration'],['purulence','Purulence'],['odor','Odor'],['increasing_pain','Increasing pain'],['fever_systemic','Fever / systemic']]} selected={form.signs_requiring_review.split(',').map(x => x.trim())} onToggle={value => { toggleCsv('signs_requiring_review', value); if (value === 'odor') set('odor', !form.odor); }} />
              <ObservationChips label="Skin tone — Fitzpatrick" options={[['I–II','Fitzpatrick I–II'],['III–IV','Fitzpatrick III–IV'],['V–VI','Fitzpatrick V–VI'],['not recorded','Fitzpatrick not recorded']]} selected={[skinTone]} onToggle={setSkinTone} />
              <p className="-mt-5 text-xs leading-5 text-stone-500">Skin tone is recorded because erythema-dependent findings read differently across the Fitzpatrick range.</p>
              <ObservationChips label="Wound edges — select all present" options={WOUND_EDGES.filter(Boolean).map(value => [value, value === 'epibole' ? 'epibole — rolled under' : value] as [string,string])} selected={form.wound_edge.split(',').map(x => x.trim())} onToggle={value => toggleCsv('wound_edge', value)} />
              <p className="-mt-5 text-xs leading-5 text-stone-500">Epibole is recorded explicitly rather than folded into “unattached.”</p>
              <ObservationChips label="Periwound skin — 4 cm margin" options={PERIWOUND.filter(Boolean).map(value => [value,value] as [string,string])} selected={form.periwound.split(',').map(x => x.trim())} onToggle={value => toggleCsv('periwound', value)} />
              <ObservationChips label="Moisture balance" options={['desiccated','moist','wet','saturated'].map(value => [value,value] as [string,string])} selected={[moistureBalance]} onToggle={setMoistureBalance} />
              <div><span className="block text-xs font-bold text-stone-500 uppercase mb-3">Treatment this visit · clinician entered</span><div className="grid sm:grid-cols-2 gap-3"><select value={treatmentDressing} onChange={e => setTreatmentDressing(e.target.value)} className="w-full px-3 py-2.5 bg-white border border-stone-200 rounded-xl text-sm"><option value="">Dressing not recorded</option><option>Foam + silver dressing</option><option>Foam dressing</option><option>Hydrofiber dressing</option><option>Alginate dressing</option><option>Other</option></select><select value={treatmentProcedure} onChange={e => setTreatmentProcedure(e.target.value)} className="w-full px-3 py-2.5 bg-white border border-stone-200 rounded-xl text-sm"><option value="">Procedure not recorded</option><option>No procedure performed</option><option>Sharp debridement performed</option><option>Mechanical debridement</option><option>Offloading applied</option><option>Compression applied</option></select></div></div>
              <div><label className="sr-only">Context note</label><textarea value={form.clinical_notes} onChange={e => set('clinical_notes', e.target.value)} rows={4} placeholder="Context note (optional)…" className="w-full px-3.5 py-3 bg-white border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20" /></div>
            </section>
            <aside className="space-y-4">
              <RulePreview form={{ ...form, pain_recorded: painRecorded }} />
              <InfectionScreen form={form} />
              <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-sm text-xs"><h3 className="text-sm font-bold text-stone-900">Not obtainable from a photograph</h3><p className="text-xs text-stone-500 mt-2 leading-5">These are recorded at bedside or left blank. They are never inferred from the image.</p><div className="mt-4 space-y-2">{[['Depth',Boolean(form.depth_cm)],['Undermining',Boolean(form.undermining)],['Tunnelling',Boolean(form.tunneling)],['Induration',false],['Temperature',form.signs_requiring_review.includes('warmth')],['Odour',form.odor],['Pain',true],['Blanchability',false]].map(([label,recorded]) => <div key={String(label)} className={`flex justify-between gap-3 rounded-lg border px-3 py-2 ${recorded ? 'bg-emerald-50 border-emerald-200' : 'border-stone-200'}`}><span>{label}</span><span className="font-mono text-[10px] text-right">{recorded ? 'recorded at bedside' : 'not obtainable from image'}</span></div>)}</div></div>
              <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-sm"><h3 className="text-sm font-bold">Offline safety</h3><p className="mt-2 text-xs leading-5 text-stone-500">Draft fields remain available during this check-in. If offline mode is enabled, submission is queued when connectivity fails.</p></div>
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
                  {hasDimensions ? `Wound measures ${lengthNum.toFixed(1)} × ${widthNum.toFixed(1)} cm with estimated area ${calculatedArea} cm². ` : 'Calibrated wound dimensions are not recorded. '}{painRecorded ? `Pain is ${form.pain_score}/10. ` : 'Pain is not recorded. '}{form.exudate_amount ? `Exudate is ${form.exudate_amount}${form.exudate_type ? ` and ${form.exudate_type}` : ''}. ` : 'Exudate is not recorded. '}Tissue bed comprises {form.granulation_pct}% granulation, {form.slough_pct}% slough, {form.eschar_pct}% eschar, and {form.epithelial_pct}% epithelial tissue. This summary is generated only from confirmed fields and requires clinician review.
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

        <footer className="bg-white border-t border-stone-200/80 rounded-2xl px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm mt-auto">
          <span className="text-xs text-stone-400 font-mono">{uploadProgress || `Draft autosaves. Step ${step + 1} of 5.`}</span>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
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
                disabled={saving || !isTissueValid}
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

function QualityGateRows({ result }: { result: WoundAIResult | null }) {
  const survey = result?.survey;
  const limitations = (survey?.imageQuality?.limitations || []).map((item: unknown) => String(item).toLowerCase());
  const hasLimitation = (...terms: string[]) => limitations.some((item: string) => terms.some(term => item.includes(term)));
  const gradePassed = Boolean(survey?.imageQuality?.grade && ['A', 'B'].includes(survey.imageQuality.grade));
  const rows = [
    { label: 'Distance 20–25 cm', value: 'requires live sensor', state: 'unknown' },
    { label: 'Perpendicularity ±10°', value: 'requires live sensor', state: 'unknown' },
    { label: 'Calibration marker visible', value: survey ? (survey.imageQuality?.scaleReference ? 'detected' : 'not detected') : '—', state: survey ? (survey.imageQuality?.scaleReference ? 'pass' : 'fail') : 'unknown' },
    { label: 'Sharpness / focus', value: survey ? (hasLimitation('blur', 'focus', 'sharp') ? 'limitation noted' : 'no issue reported') : '—', state: survey ? (hasLimitation('blur', 'focus', 'sharp') ? 'fail' : gradePassed ? 'pass' : 'unknown') : 'unknown' },
    { label: 'Exposure & white balance', value: survey ? (hasLimitation('exposure', 'lighting', 'white balance', 'glare') ? 'limitation noted' : 'no issue reported') : '—', state: survey ? (hasLimitation('exposure', 'lighting', 'white balance', 'glare') ? 'fail' : gradePassed ? 'pass' : 'unknown') : 'unknown' },
  ];
  return <div className="space-y-3">{rows.map(row => <div key={row.label} className="flex items-center justify-between gap-3 text-xs"><span className="flex items-center gap-2 text-stone-700"><span className={`w-5 h-5 rounded-full grid place-items-center text-[11px] font-bold text-white ${row.state === 'pass' ? 'bg-emerald-600' : row.state === 'fail' ? 'bg-red-600' : 'bg-stone-300'}`}>{row.state === 'pass' ? '✓' : row.state === 'fail' ? '!' : '·'}</span>{row.label}</span><span className={`font-mono text-right ${row.state === 'pass' ? 'text-emerald-700' : row.state === 'fail' ? 'text-red-700' : 'text-stone-500'}`}>{row.value}</span></div>)}</div>;
}

function ObservationChips({ label, options, selected, onToggle }: { label: string; options: readonly (readonly [string,string])[]; selected: string[]; onToggle: (value: string) => void }) {
  return <div><span className="block text-xs font-bold text-stone-500 uppercase mb-3">{label}</span><div className="flex flex-wrap gap-2">{options.map(([value,text]) => { const active = selected.includes(value); return <button key={value} type="button" aria-pressed={active} onClick={() => onToggle(value)} className={`px-3 py-2 rounded-xl border text-xs font-semibold capitalize transition ${active ? 'bg-[#e8f3f2] border-[#69aaa5] text-[#17635f]' : 'bg-white border-stone-200 text-stone-700 hover:border-stone-400'}`}>{text}</button>; })}</div></div>;
}

type ObservationFormState = { exudate_amount: string; exudate_type: string; pain_score: number; pain_recorded?: boolean; signs_requiring_review: string; odor: boolean };

function RulePreview({ form }: { form: ObservationFormState }) {
  const purulent = form.exudate_type === 'purulent' || form.signs_requiring_review.includes('purulence');
  const warm = form.signs_requiring_review.includes('warmth');
  const infectionFlag = purulent && warm;
  const rules = [
    [infectionFlag ? 'red' : 'stone', 'Red flag: infection signs', infectionFlag ? 'RF-03 would fire · urgent' : 'RF-03 · not triggered'],
    ['amber', 'Trend: area change', 'TD-01 · compare with previous visit'],
    [form.pain_recorded && form.pain_score >= 6 ? 'amber' : 'stone', 'Symptom: pain', form.pain_recorded ? `SY-02 · pain ${form.pain_score}/10` : 'SY-02 · not recorded'],
    [purulent ? 'amber' : 'stone', 'Exudate: amount & type', form.exudate_amount ? `EX-01 · ${form.exudate_amount} / ${form.exudate_type || 'type not recorded'}` : 'EX-01 · not recorded'],
  ];
  return <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-sm"><h3 className="text-sm font-bold">Live rule preview</h3><div className="mt-4 space-y-4">{rules.map(([tone,title,trace]) => <div key={title} className="flex gap-3"><span className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${tone === 'red' ? 'bg-red-600' : tone === 'amber' ? 'bg-amber-600' : 'bg-stone-300'}`}/><div><p className="text-xs font-semibold text-stone-800">{title}</p><p className="font-mono text-[10px] text-stone-500 mt-0.5">{trace}</p></div></div>)}</div></div>;
}

function InfectionScreen({ form }: { form: ObservationFormState }) {
  const signs = form.signs_requiring_review;
  const rows = [
    ['NERDS','Non-healing','image-assessable',false], ['NERDS','Exudate','bedside only',Boolean(form.exudate_amount && form.exudate_amount !== 'none')],
    ['NERDS','Red friable granulation','image-assessable',false], ['NERDS','Debris','image-assessable',false],
    ['NERDS','Smell','bedside only',form.odor], ['STONEES','Size increasing','image-assessable',false],
    ['STONEES','Temperature','bedside only',signs.includes('warmth')], ['STONEES','Os — probe to bone','bedside only',false],
    ['STONEES','New breakdown','image-assessable',false], ['STONEES','Exudate / erythema','image-assessable',signs.includes('redness_gt_2cm')],
  ] as const;
  return <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-sm"><h3 className="text-sm font-bold">Infection screen</h3>{['NERDS','STONEES'].map(group => <div key={group} className="mt-4"><p className="font-mono text-[10px] tracking-widest text-stone-400">{group}</p><div className="mt-2 space-y-2">{rows.filter(row => row[0] === group).map(([,label,source,present]) => <div key={label} className="grid grid-cols-[10px_1fr_auto] gap-2 items-start text-xs"><span className={`mt-1 w-2 h-2 rounded-full ${present ? 'bg-red-600' : 'bg-stone-300'}`}/><span className="text-stone-700">{label}</span><span className="text-right"><i className={`not-italic px-2 py-1 rounded-md font-mono text-[9px] ${source === 'bedside only' ? 'bg-stone-100 text-stone-500' : 'bg-teal-50 text-teal-700'}`}>{source}</i><b className={`ml-2 ${present ? 'text-red-700' : 'text-stone-500'}`}>{present ? 'present' : 'not identified'}</b></span></div>)}</div></div>)}<p className="mt-4 pt-4 border-t text-[11px] leading-5 text-stone-500">Features associated with infection require clinical correlation. The image alone never asserts infection.</p></div>;
}

