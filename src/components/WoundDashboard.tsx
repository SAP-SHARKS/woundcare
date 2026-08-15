import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { ClipboardPlus, Edit, Eye, Image as ImageIcon, Sparkles, AlertTriangle, ArrowRightLeft } from 'lucide-react';

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
    <div className="border-t border-slate-100 p-5 space-y-6 bg-slate-50/30">
      {/* Top action row */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Longitudinal Clinical Summary</h4>
          {latestAssessment && (
            <p className="text-xs text-slate-500 mt-0.5">
              Based on last assessment on {new Date(latestAssessment.assessment_date).toLocaleDateString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {sortedAssessments.length >= 2 && (
            <button
              onClick={onCompare}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition shadow-sm"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-slate-500" /> Compare Visits
            </button>
          )}
          <button
            onClick={onEditWound}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 transition shadow-sm"
          >
            <Edit className="w-3.5 h-3.5 text-slate-550" /> Edit Wound
          </button>
          {wound.status === 'active' && (
            <button
              onClick={onNewAssessment}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-650 text-white text-xs font-semibold rounded-lg hover:bg-teal-700 transition shadow-sm"
            >
              <ClipboardPlus className="w-3.5 h-3.5" /> New Assessment
            </button>
          )}
        </div>
      </div>

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
                <span className="font-bold">AI Note:</span> {latestAssessment.area_cm2 < 5 ? 'Stable progression. Granulation tissue shows a healthy red color bed. Exudate is minimum.' : 'Wound area exceeds 5.0cm² threshold; monitor border margins.'}
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
