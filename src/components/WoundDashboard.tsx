import { useEffect, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { ClipboardPlus, Edit, Eye, Image as ImageIcon, Sparkles, AlertTriangle, ArrowRightLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';

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
  status: string;
  clinical_notes?: string;
  signs_requiring_review?: string;
  exudate_amount?: string;
  exudate_type?: string;
}

interface Props {
  wound: any;
  assessments: Assessment[];
  imagesByAssessment: Record<string, any[]>;
  onNewAssessment: () => void;
  onEditWound: () => void;
  onCompare: () => void;
  onReviewAssessment: (a: Assessment) => void;
  onLoadImageUrl: (storagePath: string) => void;
}

export default function WoundDashboard({
  wound,
  assessments,
  imagesByAssessment,
  onNewAssessment,
  onEditWound,
  onCompare,
  onReviewAssessment,
  onLoadImageUrl
}: Props) {
  const sortedAssessments = [...assessments].sort((a, b) => a.assessment_date.localeCompare(b.assessment_date));
  const latestAssessment = sortedAssessments[sortedAssessments.length - 1];
  const [baselineId, setBaselineId] = useState(sortedAssessments[0]?.id || '');
  const [currentId, setCurrentId] = useState(sortedAssessments[sortedAssessments.length - 1]?.id || '');
  const [signedImages, setSignedImages] = useState<Record<string, string>>({});
  const baseline = sortedAssessments.find(assessment => assessment.id === baselineId);
  const current = sortedAssessments.find(assessment => assessment.id === currentId);

  useEffect(() => {
    setBaselineId(previous => sortedAssessments.some(item => item.id === previous) ? previous : sortedAssessments[0]?.id || '');
    setCurrentId(previous => sortedAssessments.some(item => item.id === previous) ? previous : sortedAssessments[sortedAssessments.length - 1]?.id || '');
  }, [assessments]);

  useEffect(() => {
    let active = true;
    async function loadTimelineImages() {
      const entries = await Promise.all(sortedAssessments.map(async assessment => {
        const image = imagesByAssessment[assessment.id]?.[0];
        if (!image) return [assessment.id, ''] as const;
        if (image.public_url) return [assessment.id, image.public_url] as const;
        const { data } = await supabase.storage.from('wound-images').createSignedUrl(image.storage_path, 900);
        return [assessment.id, data?.signedUrl || ''] as const;
      }));
      if (active) setSignedImages(Object.fromEntries(entries));
    }
    void loadTimelineImages();
    return () => { active = false; };
  }, [assessments, imagesByAssessment]);

  const percentChange = (from?: number, to?: number) => from && to != null ? Math.round(((to - from) / from) * 100) : null;
  const pointChange = (from?: number, to?: number) => from != null && to != null ? to - from : null;

  // Calculate area trend
  let areaChangePct: number | null = null;
  if (sortedAssessments.length >= 2) {
    const prevArea = sortedAssessments[sortedAssessments.length - 2].area_cm2;
    const currArea = latestAssessment.area_cm2;
    if (prevArea > 0) {
      areaChangePct = Math.round(((currArea - prevArea) / prevArea) * 100);
    }
  }

  // Formatting data for chart
  const chartData = sortedAssessments.map(a => ({
    date: new Date(a.assessment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    area: Number(a.area_cm2 || 0)
  }));

  // Tissue colors
  const granulation = latestAssessment?.granulation_pct ?? 0;
  const slough = latestAssessment?.slough_pct ?? 0;
  const eschar = latestAssessment?.eschar_pct ?? 0;
  const epithelial = latestAssessment?.epithelial_pct ?? 0;

  return (
    <div className="min-w-0 border-t border-slate-100 p-3 sm:p-5 space-y-6 bg-slate-50/30">
      {/* Top action row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Longitudinal Clinical Summary</h4>
          {latestAssessment && (
            <p className="text-xs text-slate-500 mt-0.5">
              Based on last assessment on {new Date(latestAssessment.assessment_date).toLocaleDateString()}
            </p>
          )}
        </div>
        <div className="mobile-swipe-row w-full sm:w-auto">
          {sortedAssessments.length >= 2 && (
            <button
              onClick={onCompare}
              className="shrink-0 snap-start flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition shadow-sm whitespace-nowrap"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-slate-500" /> Compare Visits
            </button>
          )}
          <button
            onClick={onEditWound}
            className="shrink-0 snap-start flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition shadow-sm whitespace-nowrap"
          >
            <Edit className="w-3.5 h-3.5 text-slate-550" /> Edit Wound
          </button>
          {wound.status === 'active' && (
            <button
              onClick={onNewAssessment}
              className="shrink-0 snap-start flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-650 text-white text-xs font-semibold rounded-lg hover:bg-teal-700 transition shadow-sm whitespace-nowrap"
            >
              <ClipboardPlus className="w-3.5 h-3.5" /> New Assessment
            </button>
          )}
        </div>
      </div>

      {/* Photo timeline and inline comparison */}
      {sortedAssessments.length > 0 && <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div><h4 className="text-sm font-bold text-slate-900">Photo timeline</h4><p className="text-[11px] text-slate-500 mt-0.5">Choose the baseline and current visits to compare.</p></div>
          <span className="text-[10px] font-mono text-slate-500">Visual comparison · scale only comparable when calibrated</span>
        </div>
        <div className="mobile-swipe-row pb-2" aria-label="Wound photo timeline">
          {sortedAssessments.map((assessment, index) => {
            const previous = sortedAssessments[index - 1];
            const change = percentChange(previous?.area_cm2, assessment.area_cm2);
            const selected = assessment.id === baselineId || assessment.id === currentId;
            return <article key={assessment.id} className={`w-44 shrink-0 snap-start overflow-hidden rounded-xl border ${selected ? 'border-teal-500 ring-1 ring-teal-200' : 'border-slate-200'}`}>
              <button type="button" onClick={() => setCurrentId(assessment.id)} className="relative block h-28 w-full bg-stone-100 text-left">
                {signedImages[assessment.id] ? <img src={signedImages[assessment.id]} alt={`Wound on ${assessment.assessment_date}`} className="h-full w-full object-cover"/> : <span className="grid h-full place-items-center"><ImageIcon className="w-7 h-7 text-stone-300"/></span>}
                {assessment.id === baselineId && <span className="absolute left-2 top-2 rounded bg-stone-800/80 px-2 py-1 text-[9px] font-bold text-white">BASELINE</span>}
                {assessment.id === currentId && <span className="absolute right-2 top-2 rounded bg-teal-700 px-2 py-1 text-[9px] font-bold text-white">CURRENT</span>}
              </button>
              <div className="p-3">
                <p className="text-[10px] font-mono text-slate-500">{new Date(assessment.assessment_date).toLocaleDateString()}</p>
                <div className="mt-1 flex items-end justify-between"><strong className="text-sm text-slate-900">{Number(assessment.area_cm2 || 0).toFixed(1)} cm²</strong><span className={`text-[10px] font-bold ${change == null ? 'text-slate-400' : change <= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{change == null ? 'baseline' : `${change > 0 ? '+' : ''}${change}%`}</span></div>
                <div className="mt-2 flex gap-1"><button type="button" onClick={() => setBaselineId(assessment.id)} className="flex-1 rounded border px-1.5 py-1 text-[9px] font-semibold hover:bg-slate-50">Set baseline</button><button type="button" onClick={() => setCurrentId(assessment.id)} className="flex-1 rounded border px-1.5 py-1 text-[9px] font-semibold hover:bg-slate-50">Compare</button></div>
              </div>
            </article>;
          })}
        </div>

        {baseline && current && <div className="border-t border-slate-100 pt-5 space-y-4">
          <div className="flex md:grid md:grid-cols-2 gap-4 overflow-x-auto md:overflow-visible snap-x snap-mandatory touch-pan-x">
            {[{label:'Baseline',assessment:baseline},{label:'Current',assessment:current}].map(({label,assessment}) => <article key={label} className="min-w-[88%] md:min-w-0 snap-center overflow-hidden rounded-xl border border-slate-200 bg-stone-50">
              <div className="flex items-center justify-between border-b bg-white px-3 py-2"><b className="text-xs">{label}</b><span className="text-[10px] font-mono text-slate-500">{new Date(assessment.assessment_date).toLocaleDateString()}</span></div>
              <div className="h-56 sm:h-72 grid place-items-center bg-stone-100">{signedImages[assessment.id] ? <img src={signedImages[assessment.id]} alt={label} className="h-full w-full object-contain"/> : <div className="text-center text-xs text-stone-400"><ImageIcon className="mx-auto mb-2"/>No photograph stored for this visit</div>}</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 text-xs"><Metric label="Area" value={`${Number(assessment.area_cm2 || 0).toFixed(1)} cm²`}/><Metric label="Dimensions" value={`${assessment.length_cm ?? '—'} × ${assessment.width_cm ?? '—'} cm`}/><Metric label="Granulation" value={`${assessment.granulation_pct ?? 0}%`}/><Metric label="Slough / eschar" value={`${assessment.slough_pct ?? 0}% / ${assessment.eschar_pct ?? 0}%`}/></div>
            </article>)}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
            <Delta label="Area" value={percentChange(baseline.area_cm2,current.area_cm2)} suffix="%" inverse/>
            <Delta label="Granulation" value={pointChange(baseline.granulation_pct,current.granulation_pct)} suffix=" pts"/>
            <Delta label="Slough" value={pointChange(baseline.slough_pct,current.slough_pct)} suffix=" pts" inverse/>
            <Delta label="Eschar" value={pointChange(baseline.eschar_pct,current.eschar_pct)} suffix=" pts" inverse/>
            <Delta label="Pain" value={pointChange(baseline.pain_score,current.pain_score)} suffix=" /10" inverse/>
          </div>
          {(baseline.clinical_notes || current.clinical_notes || current.signs_requiring_review) && <div className="grid md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 p-3"><span className="text-[9px] font-bold uppercase text-slate-400">Baseline clinical note</span><p className="mt-1.5 text-xs leading-5 text-slate-600">{baseline.clinical_notes || 'No clinical note recorded.'}</p></div>
            <div className={`rounded-xl border p-3 ${current.signs_requiring_review ? 'border-amber-200 bg-amber-50' : 'border-slate-200'}`}><span className="text-[9px] font-bold uppercase text-slate-400">Current clinical note</span><p className="mt-1.5 text-xs leading-5 text-slate-600">{current.clinical_notes || 'No clinical note recorded.'}</p>{current.signs_requiring_review && <p className="mt-2 text-xs font-semibold text-amber-800"><AlertTriangle className="mr-1 inline w-3.5 h-3.5"/>{current.signs_requiring_review}</p>}</div>
          </div>}
          <button type="button" onClick={onCompare} className="wt-button"><ArrowRightLeft className="w-3.5 h-3.5"/>Open detailed comparison</button>
        </div>}
      </section>}

      {/* Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Latest Assessment Metrics & Photo */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-start">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Measurements</span>
              {areaChangePct !== null && (
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  areaChangePct <= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-650'
                }`}>
                  {areaChangePct <= 0 ? '' : '+'}{areaChangePct}% change
                </span>
              )}
            </div>
            
            {latestAssessment ? (
              <div className="mt-2.5 space-y-3">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                    {latestAssessment.area_cm2.toFixed(1)}
                  </span>
                  <span className="text-xs font-bold text-slate-400">cm²</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs border-y border-slate-100 py-2">
                  <div>
                    <div className="text-slate-400 font-medium">Length</div>
                    <div className="font-semibold text-slate-800 mt-0.5">{latestAssessment.length_cm} cm</div>
                  </div>
                  <div>
                    <div className="text-slate-400 font-medium">Width</div>
                    <div className="font-semibold text-slate-800 mt-0.5">{latestAssessment.width_cm} cm</div>
                  </div>
                  <div>
                    <div className="text-slate-400 font-medium">Depth</div>
                    <div className="font-semibold text-slate-800 mt-0.5">{latestAssessment.depth_cm} cm</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400 py-6 text-center">No measurements logged yet</div>
            )}
          </div>

          {/* Photo Preview */}
          {latestAssessment && imagesByAssessment[latestAssessment.id]?.length > 0 ? (
            <div className="mt-3.5 bg-slate-50 border border-slate-150 rounded-lg p-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => onLoadImageUrl(imagesByAssessment[latestAssessment.id][0].storage_path)}
                className="w-12 h-12 bg-slate-100 rounded-md border border-slate-200 flex-shrink-0 overflow-hidden flex items-center justify-center group relative hover:border-teal-300 transition"
              >
                <ImageIcon className="w-5 h-5 text-slate-400 group-hover:text-teal-600 transition" />
              </button>
              <div className="min-w-0 flex-1">
                <span className="text-xs font-semibold text-slate-700 block truncate">Latest Photograph</span>
                <span className="text-[10px] text-slate-400">Click icon to expand view</span>
              </div>
            </div>
          ) : (
            <div className="mt-3.5 border border-dashed border-slate-200 rounded-lg py-4 text-center text-xs text-slate-400">
              No photo available
            </div>
          )}
        </div>

        {/* Card 2: Tissue Bed Composition */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2.5">Tissue Bed Composition</span>
            {latestAssessment ? (
              <div className="space-y-3.5">
                {/* Stacked Progress Bar */}
                <div className="h-3.5 w-full rounded-full overflow-hidden flex bg-slate-100 border border-slate-200/50 shadow-inner">
                  <div style={{ width: `${granulation}%` }} className="bg-emerald-500" title={`Granulation: ${granulation}%`} />
                  <div style={{ width: `${slough}%` }} className="bg-amber-400" title={`Slough: ${slough}%`} />
                  <div style={{ width: `${eschar}%` }} className="bg-slate-700" title={`Eschar: ${eschar}%`} />
                  <div style={{ width: `${epithelial}%` }} className="bg-rose-300" title={`Epithelial: ${epithelial}%`} />
                </div>

                {/* Key Indicators */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-slate-500">Granulation:</span>
                    <span className="font-semibold text-slate-800 ml-auto">{granulation}%</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    <span className="text-slate-500">Slough:</span>
                    <span className="font-semibold text-slate-800 ml-auto">{slough}%</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
                    <span className="text-slate-500">Necrotic/Eschar:</span>
                    <span className="font-semibold text-slate-800 ml-auto">{eschar}%</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-300" />
                    <span className="text-slate-500">Epithelial:</span>
                    <span className="font-semibold text-slate-800 ml-auto">{epithelial}%</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400 py-8 text-center">No tissue details logged</div>
            )}
          </div>

          {/* AI Observation Summary */}
          {latestAssessment && (
            <div className="mt-3.5 bg-teal-50/50 border border-teal-100 rounded-lg p-2.5 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5" />
              <div className="text-[11px] text-teal-850">
                <span className="font-bold">Recorded summary:</span> {Number(latestAssessment.area_cm2 || 0).toFixed(1)} cm²; granulation {latestAssessment.granulation_pct ?? 0}%; slough {latestAssessment.slough_pct ?? 0}%; eschar {latestAssessment.eschar_pct ?? 0}%. Clinician confirmation remains authoritative.
              </div>
            </div>
          )}
        </div>

        {/* Card 3: Area Trend Chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Area Trend (cm²)</span>
          {chartData.length >= 2 ? (
            <div className="w-full h-32 text-[10px] mt-1.5">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '8px', color: '#f8fafc' }}
                    labelStyle={{ fontWeight: 'bold', fontSize: '10px' }}
                    itemStyle={{ fontSize: '10px' }}
                  />
                  <Line type="monotone" dataKey="area" stroke="#0d9488" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center border border-dashed border-slate-200 rounded-lg text-xs text-slate-400 py-8">
              At least 2 assessments needed for trend chart
            </div>
          )}
        </div>
      </div>

      {/* Assessment Table/Timeline List */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-slate-50/50 px-4 py-3 border-b border-slate-250 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Assessment Log</span>
          <span className="text-[10px] text-slate-400 font-medium">{sortedAssessments.length} assessment{sortedAssessments.length !== 1 ? 's' : ''} logged</span>
        </div>
        
        {sortedAssessments.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">No assessments completed. Click "New Assessment" to document.</div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
            {[...sortedAssessments].reverse().map(a => {
              const imgs = imagesByAssessment[a.id] || [];
              return (
                <div key={a.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start gap-3">
                    {imgs.length > 0 ? (
                      <button
                        onClick={() => onLoadImageUrl(imgs[0].storage_path)}
                        className="w-10 h-10 rounded bg-slate-100 border border-slate-200 flex-shrink-0 flex items-center justify-center hover:border-teal-350 overflow-hidden"
                      >
                        <ImageIcon className="w-4 h-4 text-slate-400" />
                      </button>
                    ) : (
                      <div className="w-10 h-10 rounded bg-slate-50 border border-slate-100 flex-shrink-0 flex items-center justify-center">
                        <ImageIcon className="w-4 h-4 text-slate-350" />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-800">
                          {new Date(a.assessment_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                          a.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                          a.status === 'pending_review' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {a.status === 'pending_review' ? 'Pending Review' : a.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-x-2.5 text-[10px] text-slate-500 mt-1">
                        <span>Area: <span className="font-semibold text-slate-700">{a.area_cm2.toFixed(1)} cm²</span></span>
                        <span>•</span>
                        <span>Dimensions: <span className="text-slate-700">{a.length_cm} x {a.width_cm} x {a.depth_cm} cm</span></span>
                        {a.pain_score > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-red-500 font-medium">Pain: {a.pain_score}/10</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right hand review controls */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {a.signs_requiring_review && (
                      <span className="flex items-center gap-1 text-[9px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                        <AlertTriangle className="w-3 h-3" /> Flagged
                      </span>
                    )}
                    {a.status === 'pending_review' && (
                      <button
                        onClick={() => onReviewAssessment(a)}
                        className="flex items-center gap-1 px-2.5 py-1 bg-teal-50 text-teal-700 hover:bg-teal-100 text-xs font-semibold rounded-md transition"
                      >
                        <Eye className="w-3.5 h-3.5" /> Review
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><span className="block text-[9px] font-bold uppercase tracking-wide text-slate-400">{label}</span><strong className="mt-1 block text-xs text-slate-800">{value}</strong></div>;
}

function Delta({ label, value, suffix, inverse = false }: { label: string; value: number | null; suffix: string; inverse?: boolean }) {
  const favorable = value != null && (inverse ? value <= 0 : value >= 0);
  return <div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><span className="block text-[9px] font-bold uppercase text-slate-400">{label} change</span><strong className={`mt-1 block text-sm ${value == null ? 'text-slate-500' : favorable ? 'text-emerald-700' : 'text-red-600'}`}>{value == null ? '—' : `${value > 0 ? '+' : ''}${value}${suffix}`}</strong></div>;
}
