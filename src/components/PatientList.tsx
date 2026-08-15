import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Users, Plus, Search, ChevronRight, X, Calendar, AlertTriangle } from 'lucide-react';
import PatientForm from './PatientForm';

interface Props {
  organizationId: string | null;
  onSelectPatient: (id: string) => void;
}

interface Patient {
  id: string; full_name: string; first_name: string; last_name: string;
  mrn: string; dob: string | null; phone: string; email: string;
  sex: string; status: string; wound_type: string; onset_date: string;
  organization_id: string;
}

const RISK: Record<string, { label: string; cls: string }> = {
  high:   { label: 'High',   cls: 'bg-red-50 text-red-700 border-red-200' },
  medium: { label: 'Medium', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  low:    { label: 'Low',    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};
const STAT: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  inactive: 'bg-slate-100 text-slate-500 border-slate-200',
  discharged: 'bg-blue-50 text-blue-600 border-blue-200',
};

const dname = (p: Patient) => (p.first_name && p.last_name) ? `${p.first_name} ${p.last_name}` : p.first_name || p.full_name || '—';
const age = (dob: string | null) => dob ? Math.floor((Date.now() - new Date(dob).getTime()) / 31_557_600_000) : null;
const risk = (wc: number) => wc >= 3 ? 'high' : wc >= 1 ? 'medium' : 'low';

export default function PatientList({ organizationId, onSelectPatient }: Props) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [woundCounts, setWoundCounts] = useState<Map<string, number>>(new Map());
  const [latestAssessments, setLatestAssessments] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      let pQuery = supabase.from('patients').select('*');
      if (organizationId) pQuery = pQuery.eq('organization_id', organizationId);
      const { data: pData, error: pErr } = await pQuery.order('created_at', { ascending: false });
      if (pErr) throw pErr;
      setPatients(pData ?? []);

      let wQuery = supabase.from('wounds').select('id, patient_id, status');
      if (organizationId) wQuery = wQuery.eq('organization_id', organizationId);
      const { data: wData } = await wQuery;
      const cMap = new Map<string, number>();
      const w2p = new Map<string, string>();
      (wData ?? []).forEach((w: any) => {
        w2p.set(w.id, w.patient_id);
        if (w.status === 'active') cMap.set(w.patient_id, (cMap.get(w.patient_id) ?? 0) + 1);
      });
      setWoundCounts(cMap);

      let aQuery = supabase.from('wound_assessments').select('wound_id, assessment_date');
      if (organizationId) aQuery = aQuery.eq('organization_id', organizationId);
      const { data: aData } = await aQuery.order('assessment_date', { ascending: false });
      const aMap = new Map<string, string>();
      (aData ?? []).forEach((a: any) => {
        const pid = w2p.get(a.wound_id);
        if (pid && !aMap.has(pid)) aMap.set(pid, a.assessment_date);
      });
      setLatestAssessments(aMap);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load patients');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [organizationId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return patients;
    const q = search.toLowerCase();
    return patients.filter(p =>
      dname(p).toLowerCase().includes(q) || (p.mrn ?? '').toLowerCase().includes(q) ||
      (p.phone ?? '').toLowerCase().includes(q) || (p.email ?? '').toLowerCase().includes(q)
    );
  }, [patients, search]);


  /* ── Loading ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
      </div>
    );
  }

  /* ── Error ── */
  if (error && patients.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-red-200 p-12 text-center">
        <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="text-sm text-red-600 font-medium">{error}</p>
        <button onClick={fetchData} className="mt-4 px-4 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 transition-colors">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, MRN, phone, email…"
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 transition"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-slate-100 rounded">
              <X className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 active:bg-teal-800 transition-colors shadow-sm flex-shrink-0">
          <Plus className="w-4 h-4" /> Add Patient
        </button>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* Empty */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">{search ? 'No patients match your search.' : 'No patients yet. Add your first patient to get started.'}</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Patient Name', 'MRN', 'DOB / Age', 'Active Wounds', 'Last Assessment', 'Risk', 'Status', ''].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(p => {
                  const wc = woundCounts.get(p.id) ?? 0;
                  const la = latestAssessments.get(p.id);
                  const r = risk(wc), rm = RISK[r];
                  const ss = STAT[p.status ?? 'active'] ?? STAT.active;
                  const a = age(p.dob);
                  return (
                    <tr key={p.id} onClick={() => onSelectPatient(p.id)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors group">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-slate-900 group-hover:text-teal-700 transition-colors">{dname(p)}</p>
                        {p.email && <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[200px]">{p.email}</p>}
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 font-mono text-xs">{p.mrn || '—'}</td>
                      <td className="px-5 py-3.5 text-slate-600">
                        {p.dob ? (
                          <span className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {new Date(p.dob).toLocaleDateString()}{a != null && <span className="text-slate-400">({a}y)</span>}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${wc > 0 ? 'text-teal-700' : 'text-slate-400'}`}>
                          {wc}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-600 text-xs">
                        {la ? new Date(la).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-block text-[11px] font-medium px-2.5 py-1 rounded-full border ${rm.cls}`}>{rm.label}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-block text-[11px] font-medium px-2.5 py-1 rounded-full border capitalize ${ss}`}>{p.status ?? 'active'}</span>
                      </td>
                      <td className="px-3 py-3.5">
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-teal-500 transition-colors" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map(p => {
              const wc = woundCounts.get(p.id) ?? 0;
              const la = latestAssessments.get(p.id);
              const r = risk(wc), rm = RISK[r];
              const ss = STAT[p.status ?? 'active'] ?? STAT.active;
              const a = age(p.dob);
              return (
                <button key={p.id} onClick={() => onSelectPatient(p.id)}
                  className="w-full bg-white border border-slate-200 rounded-xl p-4 text-left hover:shadow-sm hover:border-teal-200 transition-all">
                  <div className="flex items-start justify-between mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 truncate">{dname(p)}</p>
                      {p.mrn && <p className="text-xs text-slate-400 font-mono mt-0.5">{p.mrn}</p>}
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0 mt-0.5" />
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {p.dob && <span className="text-[11px] text-slate-500 bg-slate-50 px-2 py-0.5 rounded">{a != null ? `${a}y` : ''} {p.sex || ''}</span>}
                    <span className="text-[11px] text-teal-700 bg-teal-50 px-2 py-0.5 rounded">{wc} wound{wc !== 1 ? 's' : ''}</span>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${rm.cls}`}>{rm.label}</span>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border capitalize ${ss}`}>{p.status ?? 'active'}</span>
                  </div>
                  {la && <p className="text-[11px] text-slate-400 mt-2">Last assessed {new Date(la).toLocaleDateString()}</p>}
                </button>
              );
            })}
          </div>
        </>
      )}

      <p className="text-xs text-slate-400 text-right">{filtered.length} patient{filtered.length !== 1 ? 's' : ''}</p>

      {/* ── Add Patient Drawer ── */}
      {showModal && (
        <PatientForm
          organizationId={organizationId}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}
