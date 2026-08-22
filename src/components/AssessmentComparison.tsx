import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, ArrowRightLeft, Calendar, Image as ImageIcon } from 'lucide-react';
import { parseWoundLocation } from './WoundForm';

interface Assessment {
  id: string;
  assessment_date: string;
  area_cm2: number;
  length_cm: number;
  width_cm: number;
  depth_cm: number;
  granulation_pct: number;
  slough_pct: number;
  eschar_pct: number;
  epithelial_pct: number;
  pain_score: number;
  exudate_amount: string;
  exudate_type: string;
  wound_edge: string;
  periwound: string;
  clinical_notes?: string;
  status: string;
}

interface Props {
  wound: any;
  assessments: Assessment[];
  onClose: () => void;
}

export default function AssessmentComparison({ wound, assessments, onClose }: Props) {
  const sorted = [...assessments].sort((a, b) => b.assessment_date.localeCompare(a.assessment_date));
  
  // Left and Right selection states (defaults to last two assessments)
  const [leftId, setLeftId] = useState<string>(sorted[sorted.length - 1]?.id || '');
  const [rightId, setRightId] = useState<string>(sorted[0]?.id || '');
  
  const [leftImage, setLeftImage] = useState<string | null>(null);
  const [rightImage, setRightImage] = useState<string | null>(null);

  const leftAsmt = assessments.find(a => a.id === leftId);
  const rightAsmt = assessments.find(a => a.id === rightId);

  // Fetch images for left and right assessments
  useEffect(() => {
    async function loadImages() {
      if (leftId) {
        const { data } = await supabase.from('wound_images').select('storage_path').eq('assessment_id', leftId).limit(1);
        if (data && data[0]) {
          const { data: signed } = await supabase.storage.from('wound-images').createSignedUrl(data[0].storage_path, 600);
          setLeftImage(signed?.signedUrl || null);
        } else {
          setLeftImage(null);
        }
      }
      if (rightId) {
        const { data } = await supabase.from('wound_images').select('storage_path').eq('assessment_id', rightId).limit(1);
        if (data && data[0]) {
          const { data: signed } = await supabase.storage.from('wound-images').createSignedUrl(data[0].storage_path, 600);
          setRightImage(signed?.signedUrl || null);
        } else {
          setRightImage(null);
        }
      }
    }
    loadImages();
  }, [leftId, rightId]);

  const parsedWound = parseWoundLocation(wound.location_description);

  const localFmtDate = (d: string | null) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900 text-slate-100">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center">
            <ArrowRightLeft className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-50">Side-by-Side Assessment Workspace</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Comparing visits for wound: {parsedWound.description || 'Unnamed wound'} ({wound.wound_side})
            </p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-100 transition">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Selector Row */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-3 flex flex-wrap gap-6 items-center">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-400">Baseline Assessment (Left):</span>
          <select
            value={leftId}
            onChange={e => setLeftId(e.target.value)}
            className="bg-slate-950 border border-slate-850 rounded-md text-xs px-2.5 py-1.5 focus:outline-none focus:border-teal-500"
          >
            {sorted.map(a => (
              <option key={a.id} value={a.id}>
                {localFmtDate(a.assessment_date)} ({a.area_cm2.toFixed(1)} cm²)
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-400">Follow-up Assessment (Right):</span>
          <select
            value={rightId}
            onChange={e => setRightId(e.target.value)}
            className="bg-slate-950 border border-slate-850 rounded-md text-xs px-2.5 py-1.5 focus:outline-none focus:border-teal-500"
          >
            {sorted.map(a => (
              <option key={a.id} value={a.id}>
                {localFmtDate(a.assessment_date)} ({a.area_cm2.toFixed(1)} cm²)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Comparison Grid */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-6">
        <div className="flex md:grid md:grid-cols-2 gap-4 sm:gap-6 h-[55vh] overflow-x-auto md:overflow-visible snap-x snap-mandatory touch-pan-x">
          {/* Left Panel */}
          <div className="min-w-[90%] md:min-w-0 snap-center bg-slate-950/80 rounded-xl border border-slate-850 overflow-hidden flex flex-col h-full">
            <div className="px-4 py-3 bg-slate-950 border-b border-slate-850 flex items-center justify-between text-xs font-bold text-slate-300">
              <span>VISIT A: {leftAsmt ? localFmtDate(leftAsmt.assessment_date) : 'N/A'}</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400">{leftAsmt?.status}</span>
            </div>
            <div className="flex-1 flex items-center justify-center p-4 relative bg-black/40">
              {leftImage ? (
                <img src={leftImage} alt="Wound A" className="max-h-full max-w-full rounded object-contain" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-slate-500">
                  <ImageIcon className="w-10 h-10 stroke-1" />
                  <span className="text-xs">No photograph available</span>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel */}
          <div className="min-w-[90%] md:min-w-0 snap-center bg-slate-950/80 rounded-xl border border-slate-850 overflow-hidden flex flex-col h-full">
            <div className="px-4 py-3 bg-slate-950 border-b border-slate-850 flex items-center justify-between text-xs font-bold text-slate-300">
              <span>VISIT B: {rightAsmt ? localFmtDate(rightAsmt.assessment_date) : 'N/A'}</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400">{rightAsmt?.status}</span>
            </div>
            <div className="flex-1 flex items-center justify-center p-4 relative bg-black/40">
              {rightImage ? (
                <img src={rightImage} alt="Wound B" className="max-h-full max-w-full rounded object-contain" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-slate-500">
                  <ImageIcon className="w-10 h-10 stroke-1" />
                  <span className="text-xs">No photograph available</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-950/50 rounded-xl border border-slate-850/80 p-5 text-sm">
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-450 border-b border-slate-850 pb-2">Measurements Comparison</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-850">
                <span className="text-[10px] font-bold text-slate-500 block uppercase">Surface Area</span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-slate-300">{leftAsmt?.area_cm2.toFixed(1) ?? '—'}</span>
                  <span className="text-slate-500 font-semibold text-xs">vs</span>
                  <span className="text-sm font-semibold text-teal-400">{rightAsmt?.area_cm2.toFixed(1) ?? '—'}</span>
                </div>
                {leftAsmt && rightAsmt && (
                  <div className={`text-[10px] font-bold mt-1.5 ${
                    rightAsmt.area_cm2 <= leftAsmt.area_cm2 ? 'text-emerald-500' : 'text-red-400'
                  }`}>
                    {rightAsmt.area_cm2 <= leftAsmt.area_cm2 ? 'Down' : 'Up'} {Math.round(Math.abs((rightAsmt.area_cm2 - leftAsmt.area_cm2) / (leftAsmt.area_cm2 || 1)) * 100)}%
                  </div>
                )}
              </div>

              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-850">
                <span className="text-[10px] font-bold text-slate-500 block uppercase">Dimensions</span>
                <div className="mt-1 text-xs font-medium text-slate-350">
                  <div>{leftAsmt ? `${leftAsmt.length_cm}x${leftAsmt.width_cm}x${leftAsmt.depth_cm} cm` : '—'}</div>
                  <div className="text-[9px] text-slate-550 my-0.5">VS</div>
                  <div className="text-teal-450">{rightAsmt ? `${rightAsmt.length_cm}x${rightAsmt.width_cm}x${rightAsmt.depth_cm} cm` : '—'}</div>
                </div>
              </div>

              <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-850">
                <span className="text-[10px] font-bold text-slate-500 block uppercase">Pain Score</span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-slate-300">{leftAsmt?.pain_score ?? '—'}/10</span>
                  <span className="text-slate-500 font-semibold text-xs">vs</span>
                  <span className="text-sm font-semibold text-teal-400">{rightAsmt?.pain_score ?? '—'}/10</span>
                </div>
              </div>
            </div>

            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-450 border-b border-slate-850 pb-2 pt-2">Anatomy Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-900">
                <span className="text-[10px] font-bold text-slate-500 block uppercase">Wound Edge</span>
                <div className="mt-1 flex justify-between text-xs text-slate-300">
                  <span className="capitalize">{leftAsmt?.wound_edge || 'Not documented'}</span>
                  <span className="text-slate-500">→</span>
                  <span className="text-teal-400 capitalize font-medium">{rightAsmt?.wound_edge || 'Not documented'}</span>
                </div>
              </div>

              <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-900">
                <span className="text-[10px] font-bold text-slate-500 block uppercase">Periwound Skin</span>
                <div className="mt-1 flex justify-between text-xs text-slate-300">
                  <span className="capitalize">{leftAsmt?.periwound || 'Not documented'}</span>
                  <span className="text-slate-500">→</span>
                  <span className="text-teal-400 capitalize font-medium">{rightAsmt?.periwound || 'Not documented'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-455 border-b border-slate-850 pb-2">Tissue Bed Breakdown</h3>
            <div className="space-y-3 bg-slate-900/60 p-4 rounded-lg border border-slate-850">
              {[
                { label: 'Granulation', key: 'granulation_pct', barColor: 'bg-emerald-500' },
                { label: 'Slough', key: 'slough_pct', barColor: 'bg-amber-400' },
                { label: 'Necrotic/Eschar', key: 'eschar_pct', barColor: 'bg-slate-600' },
                { label: 'Epithelial', key: 'epithelial_pct', barColor: 'bg-rose-400' }
              ].map(item => {
                const lPct = leftAsmt ? (leftAsmt as any)[item.key] : 0;
                const rPct = rightAsmt ? (rightAsmt as any)[item.key] : 0;
                return (
                  <div key={item.key} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400 font-medium">{item.label}</span>
                      <span className="text-slate-300 font-semibold">{lPct}% <span className="text-slate-550 font-normal">→</span> <span className="text-teal-400">{rPct}%</span></span>
                    </div>
                    {/* Double progress bar */}
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden flex gap-0.5">
                      <div style={{ width: `${lPct}%` }} className={`${item.barColor} opacity-50`} />
                      <div style={{ width: `${rPct}%` }} className={item.barColor} />
                    </div>
                  </div>
                );
              })}
            </div>

            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-455 border-b border-slate-850 pb-2 pt-2">Clinical Notes & Observations</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-900 text-xs">
                <span className="text-[10px] font-bold text-slate-500 block uppercase mb-1">Clinical Notes (Visit A)</span>
                <p className="text-slate-350 italic max-h-24 overflow-y-auto leading-relaxed">
                  {leftAsmt?.clinical_notes || 'No clinical notes registered.'}
                </p>
              </div>

              <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-900 text-xs">
                <span className="text-[10px] font-bold text-slate-500 block uppercase mb-1">Clinical Notes (Visit B)</span>
                <p className="text-slate-350 italic max-h-24 overflow-y-auto leading-relaxed">
                  {rightAsmt?.clinical_notes || 'No clinical notes registered.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
