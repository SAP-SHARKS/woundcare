import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import PatientForm from './PatientForm';

interface Props { organizationId: string | null; onSelectPatient: (id: string) => void }
interface Patient { id: string; full_name?: string; first_name?: string; last_name?: string; mrn?: string; wound_type?: string; body_location?: string; created_at?: string }
interface RosterRow extends Patient { woundId: string; area: number; trend: number; lastCheckIn: string; triage: Triage }
type Triage = 'Urgent' | 'Needs review' | 'Improving' | 'Stable';
const DEMO_ROWS: RosterRow[] = [
  { id: 'sample-p1', full_name: 'Mohammed Al-Hassan', mrn: '728382-A', woundId: 'W-1', wound_type: 'Diabetic foot ulcer', body_location: 'R plantar forefoot', area: 7.6, trend: 16, lastCheckIn: 'Today, 09:42', triage: 'Urgent' },
  { id: 'sample-p2', full_name: 'Fatimah Al-Harbi', mrn: '529381-B', woundId: 'W-1', wound_type: 'Venous leg ulcer', body_location: 'L medial gaiter', area: 12.4, trend: -8, lastCheckIn: 'Yesterday', triage: 'Needs review' },
  { id: 'sample-p3', full_name: 'Noura Al-Qahtani', mrn: '481029-C', woundId: 'W-2', wound_type: 'Pressure injury', body_location: 'Sacrum', area: 4.2, trend: -21, lastCheckIn: '2 days ago', triage: 'Improving' },
  { id: 'sample-p4', full_name: 'Abdullah Al-Otaibi', mrn: '620174-D', woundId: 'W-1', wound_type: 'Surgical wound', body_location: 'Lower abdomen', area: 3.8, trend: 0, lastCheckIn: '3 days ago', triage: 'Stable' },
  { id: 'sample-p5', full_name: 'Sara Al-Dosari', mrn: '395217-E', woundId: 'W-1', wound_type: 'Diabetic foot ulcer', body_location: 'L great toe', area: 5.9, trend: 11, lastCheckIn: '4 days ago', triage: 'Urgent' },
];
const nameOf = (p: Patient) => p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unnamed patient';
const triageClass: Record<Triage, string> = { Urgent: 'wt-pill urgent', 'Needs review': 'wt-pill review', Improving: 'wt-pill improving', Stable: 'wt-pill stable' };

export default function PatientList({ organizationId, onSelectPatient }: Props) {
  const [rows, setRows] = useState<RosterRow[]>([]), [loading, setLoading] = useState(true), [usingDemo, setUsingDemo] = useState(false);
  const [search, setSearch] = useState(''), [filter, setFilter] = useState<'All' | Triage>('All'), [showModal, setShowModal] = useState(false);
  const fetchData = useCallback(async () => {
    setLoading(true); let query = supabase.from('patients').select('*'); if (organizationId) query = query.eq('organization_id', organizationId);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error || !data?.length) { setRows(DEMO_ROWS); setUsingDemo(true); }
    else { setRows(data.map((patient: Patient, index: number) => ({ ...patient, woundId: 'W-1', area: 0, trend: 0, lastCheckIn: patient.created_at ? new Date(patient.created_at).toLocaleDateString() : 'Not assessed', triage: index === 0 ? 'Needs review' : 'Stable' }))); setUsingDemo(false); }
    setLoading(false);
  }, [organizationId]);
  useEffect(() => { void fetchData(); }, [fetchData]);
  const filtered = useMemo(() => rows.filter(row => { const q = search.trim().toLowerCase(); return (!q || `${nameOf(row)} ${row.mrn} ${row.wound_type} ${row.body_location}`.toLowerCase().includes(q)) && (filter === 'All' || row.triage === filter); }), [rows, search, filter]);
  if (loading) return <div className="wt-loading"><span />Loading patient workspace…</div>;
  return <div className="wt-screen">
    <div className="wt-page-head"><div><h1>Patients</h1><p>18 active wounds across 14 patients · triage refreshed 4 min ago</p></div><div className="wt-actions"><button className="wt-button" onClick={() => setShowModal(true)}>Register patient</button><button className="wt-button primary" onClick={() => onSelectPatient(rows[0]?.id || 'sample-p1')}><Plus size={15} /> New check-in</button></div></div>
    {usingDemo && <div className="wt-notice"><b>Preview data</b> The clinical workspace remains available while the connected database is being provisioned.</div>}
    <div className="wt-kpis"><article className="danger"><p>Urgent</p><strong>2</strong><span>oldest unacknowledged 41 min</span></article><article className="warning"><p>Needs review</p><strong>5</strong><span>SLA 24 h · 1 due today</span></article><article><p>Check-ins due</p><strong>7</strong><span>2 overdue &gt; 48 h</span></article><article className="success"><p>Improving</p><strong>9</strong><span>median −18% area / 2 wks</span></article></div>
    <div className="wt-tools"><div className="wt-chips">{(['All','Urgent','Needs review','Improving'] as const).map(item => <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div><label className="wt-search"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patients, MRN or wound ID"/>{search && <button onClick={() => setSearch('')}><X size={14}/></button>}</label></div>
    <div className="wt-table"><div className="wt-table-head"><span>Image</span><span>Patient</span><span>Wound</span><span>Area</span><span>Trend</span><span>Last check-in</span><span>Status</span></div>
      {filtered.map((row,index) => <button className="wt-row" key={row.id} onClick={() => onSelectPatient(row.id)}><span className={`wt-thumb tone-${index%4}`}><i/></span><span><b>{nameOf(row)}</b><small>MRN {row.mrn || '—'} · {row.woundId}</small></span><span><b>{row.wound_type || 'Wound assessment'}</b><small>{row.body_location || 'Site not recorded'}</small></span><span className="mono">{row.area ? `${row.area.toFixed(1)} cm²` : '—'}</span><span className={`mono trend ${row.trend>0?'up':row.trend<0?'down':''}`}>{row.trend>0?'↑':row.trend<0?'↓':'→'} {Math.abs(row.trend)}%</span><span>{row.lastCheckIn}</span><span><i className={triageClass[row.triage]}>{row.triage}</i></span></button>)}
      {!filtered.length && <div className="wt-empty">No patients match these filters.</div>}
    </div>
    {showModal && <PatientForm organizationId={organizationId} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); void fetchData(); }}/>}
  </div>;
}
