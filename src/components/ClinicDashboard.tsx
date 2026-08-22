import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  Users, Heart, AlertTriangle, TrendingUp, TrendingDown, Minus,
  Clock, ClipboardCheck, Activity, Eye
} from 'lucide-react';

interface Props {
  organizationId: string | null;
  onNavigate: (screen: any) => void;
}

interface Patient { id: string; full_name: string; }
interface Wound {
  id: string; patient_id: string; location_description: string;
  wound_type: string; status: string;
}
interface Assessment {
  id: string; wound_id: string; organization_id: string;
  assessment_date: string; area_cm2: number | null;
  status: string; created_at: string;
}
type Category = 'improving' | 'stable' | 'worsening' | 'overdue';
interface WoundInfo {
  wound: Wound;
  patient: Patient;
  category: Category;
  latestAssessment: Assessment | null;
  areaChange: number | null;
}

const CATEGORY_META: Record<Category, { label: string; color: string; bg: string; icon: typeof TrendingDown }> = {
  improving:  { label: 'Improving',          color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: TrendingDown },
  stable:     { label: 'Stable',             color: 'text-amber-700',   bg: 'bg-amber-50 border-amber-200',    icon: Minus },
  worsening:  { label: 'Worsening',          color: 'text-red-700',     bg: 'bg-red-50 border-red-200',        icon: TrendingUp },
  overdue:    { label: 'Overdue Assessment',  color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200',      icon: Clock },
};

export default function ClinicDashboard({ organizationId, onNavigate }: Props) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [wounds, setWounds] = useState<Wound[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!organizationId) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      const [pRes, wRes, aRes] = await Promise.all([
        supabase.from('patients').select('id, full_name').eq('organization_id', organizationId),
        supabase.from('wounds').select('id, patient_id, location_description, wound_type, status').eq('organization_id', organizationId),
        supabase.from('wound_assessments').select('id, wound_id, organization_id, assessment_date, area_cm2, status, created_at').eq('organization_id', organizationId).order('assessment_date', { ascending: false }),
      ]);
      setPatients(pRes.data ?? []);
      setWounds(wRes.data ?? []);
      setAssessments(aRes.data ?? []);
      setLoading(false);
    })();
  }, [organizationId]);

  const { woundInfos, stats, recentAssessments } = useMemo(() => {
    const patientMap = new Map(patients.map(p => [p.id, p]));
    const assessmentsByWound = new Map<string, Assessment[]>();
    for (const a of assessments) {
      const list = assessmentsByWound.get(a.wound_id) ?? [];
      list.push(a);
      assessmentsByWound.set(a.wound_id, list);
    }

    const now = Date.now();
    const DAY14 = 14 * 86_400_000;
    const infos: WoundInfo[] = [];

    for (const w of wounds) {
      if (w.status !== 'active') continue;
      const patient = patientMap.get(w.patient_id);
      if (!patient) continue;
      const woundAssessments = assessmentsByWound.get(w.id) ?? [];
      const latest = woundAssessments[0] ?? null;
      const prev = woundAssessments[1] ?? null;

      let category: Category = 'stable';
      let areaChange: number | null = null;

      if (!latest || now - new Date(latest.assessment_date).getTime() > DAY14) {
        category = 'overdue';
      } else if (latest && prev && latest.area_cm2 != null && prev.area_cm2 != null && prev.area_cm2 > 0) {
        areaChange = ((latest.area_cm2 - prev.area_cm2) / prev.area_cm2) * 100;
        category = areaChange < -5 ? 'improving' : areaChange > 5 ? 'worsening' : 'stable';
      }

      infos.push({ wound: w, patient, category, latestAssessment: latest, areaChange });
    }

    const pendingReview = assessments.filter(a => a.status === 'pending_review').length;
    const highRisk = infos.filter(i => i.category === 'worsening' || i.category === 'overdue').length;

    return {
      woundInfos: infos,
      stats: {
        activePatients: patients.length,
        activeWounds: infos.length,
        pendingReview,
        highRisk,
      },
      recentAssessments: assessments.slice(0, 8),
    };
  }, [patients, wounds, assessments]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!organizationId) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <Activity className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-500">No organization assigned. Contact your administrator.</p>
      </div>
    );
  }

  const summaryCards = [
    { label: 'Active Patients', value: stats.activePatients, icon: Users,          accent: 'bg-teal-50 text-teal-600', target: { name: 'patients' } },
    { label: 'Active Wounds',   value: stats.activeWounds,   icon: Heart,          accent: 'bg-rose-50 text-rose-600', target: { name: 'patients' } },
    { label: 'Need Review',     value: stats.pendingReview,  icon: ClipboardCheck, accent: 'bg-amber-50 text-amber-600', target: { name: 'command_center' } },
    { label: 'High Risk',       value: stats.highRisk,       icon: AlertTriangle,  accent: 'bg-red-50 text-red-600', target: { name: 'command_center' } },
  ];

  const urgent = woundInfos.filter(i => i.category === 'worsening');
  const woundMap = new Map(wounds.map(w => [w.id, w]));
  const patientMap = new Map(patients.map(p => [p.id, p]));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Clinic Command Center</h1>
        <p className="text-sm text-slate-500 mt-1">Real-time wound care overview</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map(c => (
          <button type="button" onClick={() => onNavigate(c.target)} key={c.label} className="w-full text-left bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md hover:border-teal-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{c.label}</span>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${c.accent}`}>
                <c.icon className="w-[18px] h-[18px]" />
              </div>
            </div>
            <p className="text-2xl font-semibold text-slate-900">{c.value}</p>
          </button>
        ))}
      </div>

      {/* Urgent attention */}
      {urgent.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-red-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <h2 className="text-sm font-semibold text-red-800">Urgent Attention — Worsening Wounds</h2>
          </div>
          <div className="divide-y divide-red-100">
            {urgent.slice(0, 5).map(info => (
              <div key={info.wound.id} className="px-5 py-3 flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 truncate">{info.patient.full_name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {info.wound.location_description} · {info.wound.wound_type}
                    {info.areaChange != null && (
                      <span className="ml-2 text-red-600 font-medium">↑ {Math.abs(info.areaChange).toFixed(1)}% area</span>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => onNavigate({ name: 'patient_detail', patientId: info.wound.patient_id })}
                  className="ml-4 flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-200 rounded-lg text-xs font-medium text-red-700 hover:bg-red-100 transition-colors flex-shrink-0"
                >
                  <Eye className="w-3.5 h-3.5" /> Review
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category breakdown */}
      <div>
        <h2 className="text-sm font-semibold text-slate-900 mb-3">Wound Categories</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {(['improving', 'stable', 'worsening', 'overdue'] as Category[]).map(cat => {
            const meta = CATEGORY_META[cat];
            const count = woundInfos.filter(i => i.category === cat).length;
            return (
              <div key={cat} className={`rounded-xl border p-4 ${meta.bg}`}>
                <div className="flex items-center gap-2 mb-2">
                  <meta.icon className={`w-4 h-4 ${meta.color}`} />
                  <span className={`text-xs font-semibold uppercase tracking-wider ${meta.color}`}>{meta.label}</span>
                </div>
                <p className={`text-2xl font-bold ${meta.color}`}>{count}</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  {count === 1 ? 'wound' : 'wounds'}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent assessments */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Recent Assessments</h2>
          <span className="text-xs text-slate-400">{assessments.length} total</span>
        </div>
        {recentAssessments.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <ClipboardCheck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No assessments recorded yet</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentAssessments.map(a => {
              const wound = woundMap.get(a.wound_id);
              const patient = wound ? patientMap.get(wound.patient_id) : null;
              const statusStyle =
                a.status === 'pending_review' ? 'bg-amber-50 text-amber-700' :
                a.status === 'reviewed' ? 'bg-emerald-50 text-emerald-700' :
                'bg-slate-100 text-slate-600';
              return (
                <div key={a.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {patient?.full_name ?? 'Unknown'}{wound ? ` — ${wound.location_description}` : ''}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {new Date(a.assessment_date).toLocaleDateString()}
                      {a.area_cm2 != null && ` · ${a.area_cm2} cm²`}
                    </p>
                  </div>
                  <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${statusStyle}`}>
                    {a.status.replace(/_/g, ' ')}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
