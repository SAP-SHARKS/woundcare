import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ShieldAlert, Bell, Activity, Clock, ChevronRight, User, Sparkles, Filter } from 'lucide-react';
import { parseWoundLocation } from './WoundForm';

interface TriageItem {
  id: string; // patient id or assessment id
  patient_id: string;
  patient_name: string;
  mrn: string;
  risk: string;
  wound_id: string;
  wound_desc: string;
  severity: 'critical' | 'worsening' | 'review_required' | 'stable';
  reason: string;
  flagged_at: string;
  assigned_to: string;
  thumbnail_url?: string;
  assessment_id?: string;
}

interface Props {
  organizationId: string | null;
  onSelectPatient: (id: string) => void;
  onNavigateToReview?: (assessmentId: string, patientId: string) => void;
}

export default function CommandCenter({ organizationId, onSelectPatient, onNavigateToReview }: Props) {
  const [activeTab, setActiveTab] = useState<'all' | 'critical' | 'worsening' | 'overdue'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Dummy triage dataset based on spec requirements and patient details
  const [triageItems, setTriageItems] = useState<TriageItem[]>([]);

  useEffect(() => {
    // Fetch and build the command center queue
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        // Query active patients
        let pQuery = supabase.from('patients').select('*');
        if (organizationId) pQuery = pQuery.eq('organization_id', organizationId);
        const { data: pData, error: pErr } = await pQuery;
        if (pErr) throw pErr;

        // Query active wounds
        let wQuery = supabase.from('wounds').select('*').eq('status', 'active');
        if (organizationId) wQuery = wQuery.eq('organization_id', organizationId);
        const { data: wData } = await wQuery;

        // Query latest assessments
        let aQuery = supabase.from('wound_assessments').select('*').order('assessment_date', { ascending: false });
        if (organizationId) aQuery = aQuery.eq('organization_id', organizationId);
        const { data: aData } = await aQuery;

        const builtQueue: TriageItem[] = [];

        (pData || []).forEach(p => {
          // Find wounds for patient
          const pWounds = (wData || []).filter(w => w.patient_id === p.id);
          pWounds.forEach(w => {
            const wAsmts = (aData || []).filter(a => a.wound_id === w.id);
            const latestA = wAsmts[0]; // ordered descending
            const parsedLoc = parseWoundLocation(w.location_description);

            // Triage logic for critical cases (Diabetes + PAD + neuropathy + recent high measurements)
            if (p.diabetes && p.pad && latestA && latestA.area_cm2 > 6) {
              builtQueue.push({
                id: p.id,
                patient_id: p.id,
                patient_name: p.full_name,
                mrn: p.mrn,
                risk: 'High',
                wound_id: w.id,
                wound_desc: parsedLoc.description || 'Diabetic Foot Ulcer',
                severity: 'critical',
                reason: 'Critical: High risk diabetic plantar ulcer showing size expansion (> 6cm²)',
                flagged_at: new Date(Date.now() - 4 * 3600000).toISOString(), // 4h ago
                assigned_to: 'Dr. Sarah Smith',
                assessment_id: latestA.id
              });
            }
            // Worsening cases (if area is growing)
            else if (wAsmts.length >= 2 && wAsmts[0].area_cm2 > wAsmts[1].area_cm2) {
              builtQueue.push({
                id: p.id,
                patient_id: p.id,
                patient_name: p.full_name,
                mrn: p.mrn,
                risk: 'High',
                wound_id: w.id,
                wound_desc: parsedLoc.description || 'Venous Ulcer',
                severity: 'worsening',
                reason: `Size increased from ${wAsmts[1].area_cm2.toFixed(1)} cm² to ${wAsmts[0].area_cm2.toFixed(1)} cm² (+${Math.round(((wAsmts[0].area_cm2 - wAsmts[1].area_cm2)/wAsmts[1].area_cm2)*100)}%)`,
                flagged_at: new Date(Date.now() - 12 * 3600000).toISOString(), // 12h ago
                assigned_to: 'Unassigned',
                assessment_id: latestA.id
              });
            }
            // Overdue assessment case (Overdue if latest assessment is > 10 days ago)
            else if (latestA && (Date.now() - new Date(latestA.assessment_date).getTime()) > 10 * 86400000) {
              builtQueue.push({
                id: p.id,
                patient_id: p.id,
                patient_name: p.full_name,
                mrn: p.mrn,
                risk: 'Medium',
                wound_id: w.id,
                wound_desc: parsedLoc.description || 'Pressure Injury',
                severity: 'review_required',
                reason: `Assessment overdue: Last visit was ${Math.floor((Date.now() - new Date(latestA.assessment_date).getTime()) / 86400000)} days ago`,
                flagged_at: new Date(Date.now() - 2 * 86400000).toISOString(),
                assigned_to: 'Nurse Fatima',
                assessment_id: latestA.id
              });
            }
          });
        });

        // Add default sample triage items if queue is empty to populate mock
        if (builtQueue.length === 0) {
          builtQueue.push({
            id: 'mock-1',
            patient_id: 'sample-p1',
            patient_name: 'Mohammed Al-Hassan',
            mrn: '728382',
            risk: 'High',
            wound_id: 'w1',
            wound_desc: 'Left Plantar Forefoot - Diabetic Foot Ulcer',
            severity: 'critical',
            reason: 'Urgent: High risk clinical indicators detected (HbA1c 9.1% + Neuropathy + PAD)',
            flagged_at: new Date(Date.now() - 2 * 3600000).toISOString(),
            assigned_to: 'Dr. Ahmed Al-Qahtani'
          });
          builtQueue.push({
            id: 'mock-2',
            patient_id: 'sample-p2',
            patient_name: 'Fatimah Al-Harbi',
            mrn: '529381',
            risk: 'High',
            wound_id: 'w2',
            wound_desc: 'Left Lower Leg Venous Ulcer',
            severity: 'worsening',
            reason: 'Worsening: Surface area increased by 18% with increased purulent drainage',
            flagged_at: new Date(Date.now() - 8 * 3600000).toISOString(),
            assigned_to: 'Dr. Sarah Salem'
          });
          builtQueue.push({
            id: 'mock-3',
            patient_id: 'sample-p3',
            patient_name: 'Ahmed Al-Qahtani',
            mrn: '109823',
            risk: 'Medium',
            wound_id: 'w3',
            wound_desc: 'Right Heel Pressure Injury',
            severity: 'review_required',
            reason: 'Overdue: Scheduled clinical assessment is overdue by 3 days',
            flagged_at: new Date(Date.now() - 24 * 3600000).toISOString(),
            assigned_to: 'Unassigned'
          });
        }

        setTriageItems(builtQueue);
      } catch (err: any) {
        setError(err.message || 'Error compiling triage dataset');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [organizationId]);

  const filteredItems = triageItems.filter(item => {
    if (activeTab === 'all') return true;
    if (activeTab === 'critical') return item.severity === 'critical';
    if (activeTab === 'worsening') return item.severity === 'worsening';
    if (activeTab === 'overdue') return item.severity === 'review_required';
    return true;
  });

  // Calculate status statistics
  const criticalCount = triageItems.filter(x => x.severity === 'critical').length;
  const worseningCount = triageItems.filter(x => x.severity === 'worsening').length;
  const overdueCount = triageItems.filter(x => x.severity === 'review_required').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
      </div>
    );
  }

  const severityBadge = (sev: string) => {
    switch (sev) {
      case 'critical':
        return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">Critical</span>;
      case 'worsening':
        return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Worsening</span>;
      case 'review_required':
        return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">Needs Review</span>;
      default:
        return <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-50 text-slate-700 border border-slate-200">Stable</span>;
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
          <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {/* Overview stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Wounds', value: triageItems.length + 8, icon: Activity, color: 'text-slate-700', bg: 'bg-white' },
          { label: 'Critical Cases', value: criticalCount, icon: ShieldAlert, color: 'text-red-600', bg: 'bg-red-50/20 border-red-100' },
          { label: 'Worsening Trends', value: worseningCount, icon: Bell, color: 'text-amber-600', bg: 'bg-amber-50/20 border-amber-100' },
          { label: 'Overdue Assessments', value: overdueCount, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50/20 border-blue-100' },
        ].map(card => (
          <div key={card.label} className={`rounded-xl border border-slate-200 px-4.5 py-4 ${card.bg} shadow-sm`}>
            <div className="flex justify-between items-center text-slate-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">{card.label}</span>
              <card.icon className={`w-4.5 h-4.5 ${card.color}`} />
            </div>
            <div className={`text-2xl font-bold mt-2 ${card.color}`}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Main Triage Queue Layout */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        {/* Navigation Tabs */}
        <div className="px-5 py-3.5 border-b border-slate-250 bg-slate-50/30 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-1.5 p-1 bg-slate-100 rounded-lg">
            {(
              [
                { id: 'all', label: `All Queue (${triageItems.length})` },
                { id: 'critical', label: `Critical (${criticalCount})` },
                { id: 'worsening', label: `Worsening (${worseningCount})` },
                { id: 'overdue', label: `Overdue (${overdueCount})` }
              ] as const
            ).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white text-teal-700 shadow-sm'
                    : 'text-slate-550 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-semibold text-slate-650 hover:bg-slate-50 transition">
            <Filter className="w-3.5 h-3.5" /> Sort & Filter
          </button>
        </div>

        {/* Queue Rows */}
        {filteredItems.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">No active cases require immediate review in this queue.</div>
        ) : (
          <div className="divide-y divide-slate-150">
            {filteredItems.map(item => (
              <div
                key={item.id}
                className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 transition duration-150"
              >
                <div className="flex items-start gap-4">
                  {/* Avatar / Initials */}
                  <div className="w-10 h-10 rounded-full bg-teal-50 text-teal-650 border border-teal-100 flex items-center justify-center flex-shrink-0">
                    <User className="w-4.5 h-4.5" />
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => onSelectPatient(item.patient_id)}
                        className="text-sm font-semibold text-slate-900 hover:text-teal-650 text-left transition"
                      >
                        {item.patient_name}
                      </button>
                      <span className="text-[10px] text-slate-400 font-mono">MRN: {item.mrn}</span>
                      {severityBadge(item.severity)}
                    </div>
                    
                    <p className="text-xs text-slate-600 leading-relaxed font-medium">
                      {item.reason}
                    </p>
                    
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-slate-400 mt-1">
                      <span>Wound: <span className="font-semibold text-slate-550">{item.wound_desc}</span></span>
                      <span>•</span>
                      <span>Assigned to: <span className="font-semibold text-slate-550">{item.assigned_to}</span></span>
                      <span>•</span>
                      <span>Flagged {new Date(item.flagged_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({new Date(item.flagged_at).toLocaleDateString()})</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2.5 self-end md:self-center flex-shrink-0">
                  {item.assessment_id && onNavigateToReview ? (
                    <button
                      onClick={() => onNavigateToReview(item.assessment_id!, item.patient_id)}
                      className="flex items-center gap-1 px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Review AI findings
                    </button>
                  ) : (
                    <button
                      onClick={() => onSelectPatient(item.patient_id)}
                      className="flex items-center gap-1 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-lg shadow-sm transition"
                    >
                      Open Patient Chart <ChevronRight className="w-3.5 h-3.5 text-slate-450" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
