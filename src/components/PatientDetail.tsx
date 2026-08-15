import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { logAudit } from '../lib/audit';
import {
  ArrowLeft, Plus, MapPin, Calendar, Activity, TrendingDown,
  TrendingUp, Minus, AlertTriangle, FileText, Heart, Stethoscope, User,
  CheckCircle2, XCircle, Eye, Edit,
} from 'lucide-react';
import AssessmentForm from './AssessmentForm';
import PatientForm from './PatientForm';
import WoundForm, { parseWoundLocation } from './WoundForm';
import WoundDashboard from './WoundDashboard';
import AssessmentComparison from './AssessmentComparison';

interface Props {
  patientId: string;
  organizationId: string | null;
  onBack: () => void;
}

type Tab = 'wounds' | 'assessments' | 'clinical';

const WOUND_TYPES: Record<string, string> = {
  diabetic_foot_ulcer: 'Diabetic Foot Ulcer', pressure_injury: 'Pressure Injury',
  venous_leg_ulcer: 'Venous Leg Ulcer', arterial_ulcer: 'Arterial Ulcer',
  surgical_wound: 'Surgical Wound', traumatic_wound: 'Traumatic Wound',
  skin_tear: 'Skin Tear', other: 'Other',
};

function age(dob: string | null) {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / 31557600000);
}
function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function AreaTrend({ assessments }: { assessments: any[] }) {
  if (assessments.length < 2) return <Minus className="w-3.5 h-3.5 text-slate-400" />;
  const sorted = [...assessments].sort((a, b) => a.assessment_date.localeCompare(b.assessment_date));
  const prev = sorted[sorted.length - 2]?.area_cm2 ?? 0;
  const last = sorted[sorted.length - 1]?.area_cm2 ?? 0;
  if (last < prev) return <TrendingDown className="w-3.5 h-3.5 text-emerald-600" />;
  if (last > prev) return <TrendingUp className="w-3.5 h-3.5 text-red-500" />;
  return <Minus className="w-3.5 h-3.5 text-slate-400" />;
}

function MiniSparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const h = 28, w = 80;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - (v / max) * (h - 4)}`).join(' ');
  return (
    <svg width={w} height={h} className="flex-shrink-0">
      <polyline points={pts} fill="none" stroke="#0d9488" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function ConditionBadge({ label, active }: { label: string; active: boolean }) {
  if (!active) return null;
  return (
    <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
      {label}
    </span>
  );
}

export default function PatientDetail({ patientId, organizationId, onBack }: Props) {
  const [patient, setPatient] = useState<any>(null);
  const [wounds, setWounds] = useState<any[]>([]);
  const [assessmentsByWound, setAssessmentsByWound] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('wounds');
  const [expandedWound, setExpandedWound] = useState<string | null>(null);
  const [showNewWound, setShowNewWound] = useState(false);
  const [editingWound, setEditingWound] = useState<any>(null);
  const [assessmentWoundId, setAssessmentWoundId] = useState<string | null>(null);
  const [reviewingAssessment, setReviewingAssessment] = useState<any>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewSaving, setReviewSaving] = useState(false);
  const [imagesByAssessment, setImagesByAssessment] = useState<Record<string, any[]>>({});
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [showEditPatient, setShowEditPatient] = useState(false);
  const [comparingWound, setComparingWound] = useState<any>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: p, error: pe } = await supabase.from('patients').select('*').eq('id', patientId).single();
      if (pe) throw pe;
      setPatient(p);

      const { data: w, error: we } = await supabase.from('wounds').select('*').eq('patient_id', patientId).order('created_at', { ascending: false });
      if (we) throw we;
      setWounds(w || []);

      if (w && w.length > 0) {
        const ids = w.map((x: any) => x.id);
        const { data: a, error: ae } = await supabase.from('wound_assessments').select('*').in('wound_id', ids).order('assessment_date', { ascending: true });
        if (ae) throw ae;
        const grouped: Record<string, any[]> = {};
        (a || []).forEach((r: any) => { (grouped[r.wound_id] ||= []).push(r); });
        setAssessmentsByWound(grouped);

        const assessmentIds = (a || []).map((x: any) => x.id);
        if (assessmentIds.length > 0) {
          const { data: imgs } = await supabase.from('wound_images').select('*').in('assessment_id', assessmentIds);
          const imgGrouped: Record<string, any[]> = {};
          (imgs || []).forEach((img: any) => { (imgGrouped[img.assessment_id] ||= []).push(img); });
          setImagesByAssessment(imgGrouped);
        }
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load patient');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { logAudit('patient.view', 'patient', patientId, organizationId); }, [patientId, organizationId]);


  async function handleReview(newStatus: 'approved' | 'draft') {
    if (!reviewingAssessment) return;
    setReviewSaving(true);
    const { error } = await supabase.from('wound_assessments').update({
      status: newStatus,
      reviewed_by: (await supabase.auth.getUser()).data.user?.id,
      reviewed_at: new Date().toISOString(),
      review_notes: reviewNotes,
    }).eq('id', reviewingAssessment.id);
    setReviewSaving(false);
    if (!error) {
      await logAudit('assessment.review', 'wound_assessment', reviewingAssessment.id, organizationId, { status: newStatus });
      setReviewingAssessment(null);
      fetchData();
    }
  }

  async function loadImageUrl(storagePath: string) {
    const { data } = await supabase.storage.from('wound-images').createSignedUrl(storagePath, 300);
    if (data?.signedUrl) setLightboxUrl(data.signedUrl);
  }

  const allAssessments = Object.values(assessmentsByWound).flat().sort((a, b) => b.assessment_date.localeCompare(a.assessment_date));
  const activeWounds = wounds.filter(w => w.status === 'active');
  const hasHighRisk = patient && (patient.pad || patient.neuropathy || patient.dialysis || patient.immunosuppression);
  const lastAssessment = allAssessments[0]?.assessment_date ?? null;
  const nextReview = lastAssessment ? new Date(new Date(lastAssessment).getTime() + 7 * 86400000).toISOString().slice(0, 10) : null;

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-8 h-8 border-[3px] border-teal-200 border-t-teal-600 rounded-full animate-spin" />
    </div>
  );

  if (error && !patient) return (
    <div className="min-h-screen bg-slate-50 p-6">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-teal-700 mb-4"><ArrowLeft className="w-4 h-4" /> Back</button>
      <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>
    </div>
  );

  if (!patient) return null;

  const p = patient;
  const patientAge = age(p.dob);
  const conditions = [
    { label: 'Diabetes', active: p.diabetes },
    { label: `Type ${p.diabetes_type}`, active: !!p.diabetes_type && p.diabetes },
    { label: 'PAD', active: p.pad },
    { label: 'Neuropathy', active: p.neuropathy },
    { label: 'Hypertension', active: p.hypertension },
    { label: 'CKD', active: p.kidney_disease },
    { label: 'Dialysis', active: p.dialysis },
    { label: 'CVD', active: p.cardiovascular_disease },
    { label: 'Immunosuppressed', active: p.immunosuppression },
    { label: 'Smoker', active: p.smoking },
  ];

  const tabs: { key: Tab; label: string; icon: typeof FileText }[] = [
    { key: 'wounds', label: 'Wounds', icon: Activity },
    { key: 'assessments', label: 'Assessments', icon: FileText },
    { key: 'clinical', label: 'Clinical', icon: Stethoscope },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-teal-700 transition-colors mb-3">
            <ArrowLeft className="w-4 h-4" /> Back to Patients
          </button>
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-full bg-teal-600 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-slate-900">{p.full_name}</h1>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500 mt-0.5">
                  {p.mrn && <span>MRN: <span className="font-medium text-slate-700">{p.mrn}</span></span>}
                  {patientAge != null && <span>{patientAge}y</span>}
                  {p.sex && <span className="capitalize">{p.sex}</span>}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {conditions.map(c => <ConditionBadge key={c.label} {...c} />)}
                  {hasHighRisk && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
                      <AlertTriangle className="w-3 h-3" /> High Risk
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-2 self-start">
              <button onClick={() => setShowEditPatient(true)} className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors shadow-sm">
                <Edit className="w-4 h-4 text-slate-500" /> Edit Profile
              </button>
              <button onClick={() => setShowNewWound(true)} className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 active:bg-teal-800 transition-colors shadow-sm">
                <Plus className="w-4 h-4" /> New Wound
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 space-y-5">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Active Wounds', value: activeWounds.length, icon: Activity, color: 'text-teal-600' },
            { label: 'High Risk', value: hasHighRisk ? 'Yes' : 'No', icon: AlertTriangle, color: hasHighRisk ? 'text-red-500' : 'text-emerald-600' },
            { label: 'Last Assessment', value: fmtDate(lastAssessment), icon: Calendar, color: 'text-slate-700' },
            { label: 'Next Review', value: fmtDate(nextReview), icon: Calendar, color: 'text-blue-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 px-4 py-3">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">
                <s.icon className="w-3.5 h-3.5" /> {s.label}
              </div>
              <div className={`text-base font-semibold ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white rounded-lg border border-slate-200 p-1">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium rounded-md transition-colors flex-1 justify-center ${tab === t.key ? 'bg-teal-50 text-teal-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {/* Wounds Tab */}
        {tab === 'wounds' && (
          <div className="space-y-3">
            {wounds.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 py-12 text-center">
                <Activity className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No wounds recorded yet</p>
              </div>
            ) : wounds.map(w => {
              const wa = assessmentsByWound[w.id] || [];
              const lastA = wa[wa.length - 1];
              const expanded = expandedWound === w.id;
              return (
                <div key={w.id} className="bg-white rounded-xl border border-slate-200 hover:border-teal-200 transition-all">
                  <button onClick={() => setExpandedWound(expanded ? null : w.id)} className="w-full px-4 py-3.5 flex items-center gap-3 text-left">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${w.status === 'active' ? 'bg-teal-500' : 'bg-slate-300'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900 truncate">
                          {parseWoundLocation(w.location_description).description || 'Unnamed wound'}
                        </span>
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize">{w.wound_side}</span>
                        {parseWoundLocation(w.location_description).classification && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-250 capitalize">
                            {parseWoundLocation(w.location_description).classification}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                        <span>{WOUND_TYPES[w.wound_type] || w.wound_type}</span>
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{fmtDate(w.date_first_observed)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {lastA && <span className="text-xs font-medium text-slate-700">{Number(lastA.area_cm2).toFixed(1)} cm²</span>}
                      <MiniSparkline values={wa.map((a: any) => Number(a.area_cm2 ?? 0))} />
                      <AreaTrend assessments={wa} />
                    </div>
                  </button>
                  {expanded && (
                    <WoundDashboard
                      wound={w}
                      assessments={wa}
                      imagesByAssessment={imagesByAssessment}
                      onNewAssessment={() => setAssessmentWoundId(w.id)}
                      onEditWound={() => setEditingWound(w)}
                      onCompare={() => setComparingWound(w)}
                      onReviewAssessment={(a) => { setReviewingAssessment(a); setReviewNotes(''); }}
                      onLoadImageUrl={loadImageUrl}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Assessments Tab */}
        {tab === 'assessments' && (
          <div className="bg-white rounded-xl border border-slate-200">
            {allAssessments.length === 0 ? (
              <div className="py-12 text-center">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">No assessments recorded</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                <div className="hidden sm:grid grid-cols-[1fr_0.8fr_0.6fr_0.5fr_0.5fr_0.4fr] gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
                  {['Date', 'Wound', 'Area', 'Tissue', 'Status', 'Action'].map(h => (
                    <span key={h} className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{h}</span>
                  ))}
                </div>
                <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
                  {allAssessments.map(a => {
                    const w = wounds.find(w => w.id === a.wound_id);
                    return (
                      <div key={a.id} className="sm:grid sm:grid-cols-[1fr_0.8fr_0.6fr_0.5fr_0.5fr_0.4fr] gap-2 px-4 py-3 hover:bg-slate-50 text-sm">
                        <span className="text-slate-700">{fmtDate(a.assessment_date)}</span>
                        <span className="text-slate-600 truncate">{w ? parseWoundLocation(w.location_description).description : '—'}</span>
                        <span className="font-medium text-slate-800">{Number(a.area_cm2).toFixed(1)} cm²</span>
                        <span className="text-xs text-slate-500">G{a.granulation_pct}% S{a.slough_pct}%</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium w-fit ${
                          a.status === 'approved' ? 'bg-emerald-50 text-emerald-700' :
                          a.status === 'pending_review' ? 'bg-amber-50 text-amber-700' :
                          'bg-slate-100 text-slate-500'
                        }`}>{a.status === 'pending_review' ? 'Pending' : a.status}</span>
                        <div>
                          {a.status === 'pending_review' && (
                            <button onClick={() => { setReviewingAssessment(a); setReviewNotes(''); }}
                              className="text-xs text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1">
                              <Eye className="w-3 h-3" /> Review
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Clinical Tab */}
        {tab === 'clinical' && (
          <div className="space-y-4">
            {[
              { title: 'Demographics', icon: User, fields: [
                ['Full Name', p.full_name], ['MRN', p.mrn], ['DOB', fmtDate(p.dob)],
                ['Sex', p.sex], ['Nationality', p.nationality], ['Language', p.preferred_language],
                ['Phone', p.phone], ['Email', p.email], ['Address', [p.address, p.city].filter(Boolean).join(', ') || '—'],
              ]},
              { title: 'Biometrics', icon: Heart, fields: [
                ['Height', p.height_cm ? `${p.height_cm} cm` : '—'], ['Weight', p.weight_kg ? `${p.weight_kg} kg` : '—'],
                ['BMI', p.height_cm && p.weight_kg ? (Number(p.weight_kg) / (Number(p.height_cm) / 100) ** 2).toFixed(1) : '—'],
                ['Mobility', p.mobility], ['Nutrition', p.nutrition_status || '—'],
              ]},
              { title: 'Diabetes', icon: Activity, fields: [
                ['Diabetes', p.diabetes ? 'Yes' : 'No'], ['Type', p.diabetes_type || '—'],
                ['HbA1c', p.hba1c ? `${p.hba1c}%` : '—'], ['Neuropathy', p.neuropathy ? 'Yes' : 'No'],
              ]},
              { title: 'Vascular & Comorbidities', icon: Heart, fields: [
                ['PAD', p.pad ? 'Yes' : 'No'], ['Hypertension', p.hypertension ? 'Yes' : 'No'],
                ['CVD', p.cardiovascular_disease ? 'Yes' : 'No'], ['Kidney Disease', p.kidney_disease ? 'Yes' : 'No'],
                ['Dialysis', p.dialysis ? 'Yes' : 'No'], ['Immunosuppression', p.immunosuppression ? 'Yes' : 'No'],
              ]},
              { title: 'History', icon: Stethoscope, fields: [
                ['Previous Wounds', p.previous_wounds ? 'Yes' : 'No'], ['Amputations', p.previous_amputations || '—'],
                ['Medications', p.medications || '—'], ['Allergies', p.allergies || '—'],
                ['Smoking', p.smoking ? 'Yes' : 'No'], ['Anticoagulants', p.anticoagulants ? 'Yes' : 'No'],
              ]},
            ].map(section => (
              <div key={section.title} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <section.icon className="w-4 h-4 text-teal-600" />
                  <h3 className="text-sm font-semibold text-slate-800">{section.title}</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2.5">
                  {section.fields.map(([label, value]) => (
                    <div key={String(label)}>
                      <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">{label}</div>
                      <div className="text-sm text-slate-800 mt-0.5">{value || '—'}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="Wound photograph" className="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl" />
        </div>
      )}

      {/* Review Modal */}
      {reviewingAssessment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setReviewingAssessment(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-base font-semibold text-slate-900 mb-1">Clinician Review</h2>
            <p className="text-xs text-slate-500 mb-4">Assessment from {fmtDate(reviewingAssessment.assessment_date)}</p>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                <div className="text-[11px] text-slate-500">Area</div>
                <div className="text-sm font-semibold text-slate-800">{Number(reviewingAssessment.area_cm2).toFixed(1)} cm²</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                <div className="text-[11px] text-slate-500">Pain</div>
                <div className="text-sm font-semibold text-slate-800">{reviewingAssessment.pain_score}/10</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                <div className="text-[11px] text-slate-500">Tissue</div>
                <div className="text-sm font-semibold text-slate-800">G{reviewingAssessment.granulation_pct}%</div>
              </div>
            </div>
            {reviewingAssessment.clinical_notes && (
              <div className="mb-4">
                <div className="text-xs font-medium text-slate-500 mb-1">Clinical Notes</div>
                <p className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3">{reviewingAssessment.clinical_notes}</p>
              </div>
            )}
            {reviewingAssessment.signs_requiring_review && (
              <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="text-xs font-medium text-amber-700 mb-1">Signs Requiring Review</div>
                <p className="text-sm text-amber-800">{reviewingAssessment.signs_requiring_review}</p>
              </div>
            )}
            <div className="mb-4">
              <label className="block text-xs font-medium text-slate-600 mb-1">Review Notes</label>
              <textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} rows={3} placeholder="Add review notes..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 outline-none resize-none" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setReviewingAssessment(null)} className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
              <button onClick={() => handleReview('draft')} disabled={reviewSaving}
                className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50">
                <XCircle className="w-4 h-4" /> Request Revision
              </button>
              <button onClick={() => handleReview('approved')} disabled={reviewSaving}
                className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors shadow-sm disabled:opacity-50">
                <CheckCircle2 className="w-4 h-4" /> Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assessment Form */}
      {assessmentWoundId && (
        <AssessmentForm
          woundId={assessmentWoundId}
          organizationId={organizationId}
          patientId={patientId}
          onClose={() => setAssessmentWoundId(null)}
          onSaved={() => { setAssessmentWoundId(null); fetchData(); }}
        />
      )}

      {/* New Wound Drawer */}
      {showNewWound && (
        <WoundForm
          patientId={patientId}
          organizationId={organizationId}
          onClose={() => setShowNewWound(false)}
          onSaved={() => {
            setShowNewWound(false);
            fetchData();
          }}
        />
      )}

      {/* Edit Wound Drawer */}
      {editingWound && (
        <WoundForm
          wound={editingWound}
          patientId={patientId}
          organizationId={organizationId}
          onClose={() => setEditingWound(null)}
          onSaved={() => {
            setEditingWound(null);
            fetchData();
          }}
        />
      )}
      {/* Edit Patient Drawer */}
      {showEditPatient && (
        <PatientForm
          patient={p}
          organizationId={organizationId}
          onClose={() => setShowEditPatient(false)}
          onSaved={() => {
            setShowEditPatient(false);
            fetchData();
          }}
        />
      )}

      {/* Assessment Comparison Workspace Overlay */}
      {comparingWound && (
        <AssessmentComparison
          wound={comparingWound}
          assessments={assessmentsByWound[comparingWound.id] || []}
          onClose={() => setComparingWound(null)}
        />
      )}
    </div>
  );
}
