import { useState } from 'react';
import { Sparkles, Eye, Info, CheckCircle2, XCircle, AlertTriangle, Edit3 } from 'lucide-react';

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
}

interface Props {
  patient: any;
  assessment: Assessment;
  onClose: () => void;
  onApprove: (notes: string) => void;
  onReject: () => void;
  onFlag: () => void;
}

export default function AIAnalysisReview({
  patient,
  assessment,
  onClose,
  onApprove,
  onReject,
  onFlag
}: Props) {
  const [showOverlay, setShowOverlay] = useState(true);
  const [reviewNotes, setReviewNotes] = useState('');
  const [editingMeasurements, setEditingMeasurements] = useState(false);
  
  // Editable measurement values
  const [length, setLength] = useState(assessment.length_cm);
  const [width, setWidth] = useState(assessment.width_cm);
  const [depth, setDepth] = useState(assessment.depth_cm);

  const area = length * width;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-900 text-slate-100 overflow-y-auto">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-teal-500/10 text-teal-400 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-50">AI-Assisted Analysis Review Workspace</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Reviewing machine-generated observations for patient: {patient.full_name} (MRN: {patient.mrn})
            </p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-100 transition">
          <XCircle className="w-5 h-5" />
        </button>
      </div>

      {/* Main Alert Banner */}
      <div className="bg-amber-950/40 border-b border-amber-900/60 px-6 py-3 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-amber-250 leading-relaxed">
          <span className="font-bold">Awaiting Clinician Verification:</span> The segmentations, tissue composition, and dimensions displayed below are automated observations. They must be validated or edited by a licensed clinician before committing to the patient's EHR chart.
        </div>
      </div>

      {/* Workspace split */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden min-h-0">
        {/* Left Side: Images Workspace (7 cols) */}
        <div className="lg:col-span-7 flex flex-col bg-slate-950 h-full border-r border-slate-850">
          <div className="px-5 py-3 border-b border-slate-900 flex items-center justify-between bg-slate-950">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-450 uppercase tracking-wider">Clinical Evidence</span>
              <span className="text-[10px] text-slate-500 bg-slate-900 px-2 py-0.5 rounded border border-slate-850">
                Calibration Marker: Detected
              </span>
            </div>
            
            {/* Segmentation Toggle */}
            <div className="flex items-center gap-1.5 bg-slate-900 rounded-lg p-0.5 border border-slate-800">
              <button
                type="button"
                onClick={() => setShowOverlay(false)}
                className={`text-[10px] font-semibold px-2.5 py-1 rounded transition-colors ${
                  !showOverlay ? 'bg-slate-800 text-slate-100' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Original Photo
              </button>
              <button
                type="button"
                onClick={() => setShowOverlay(true)}
                className={`text-[10px] font-semibold px-2.5 py-1 rounded transition-colors flex items-center gap-1 ${
                  showOverlay ? 'bg-teal-650 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Eye className="w-3 h-3" /> Tissue Segmentation
              </button>
            </div>
          </div>

          {/* Photograph Display with Simulated Segmentation Overlay */}
          <div className="flex-1 flex items-center justify-center p-3 sm:p-6 relative bg-black/50">
            {/* The base image */}
            <img
              src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&q=80&w=600"
              alt="Wound site"
              className="max-h-full max-w-full rounded-lg object-contain"
            />
            
            {/* Simulated overlay (drawn as semi-transparent colored polygons/regions over the wound site) */}
            {showOverlay && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-6">
                <div className="relative w-full max-w-[300px] aspect-square">
                  {/* Granulation Area (Reddish/Pink overlay) */}
                  <div className="absolute top-[35%] left-[25%] w-[120px] h-[90px] bg-red-500/35 border-2 border-red-500 rounded-full flex items-center justify-center text-[10px] text-white font-bold backdrop-blur-[1px]">
                    Granulation (64%)
                  </div>
                  {/* Slough Area (Yellowish overlay) */}
                  <div className="absolute top-[48%] left-[45%] w-[80px] h-[60px] bg-amber-400/30 border border-amber-400 rounded-full flex items-center justify-center text-[10px] text-white font-bold backdrop-blur-[1px]">
                    Slough (28%)
                  </div>
                  {/* Necrotic tissue (Dark overlay) */}
                  <div className="absolute top-[28%] left-[48%] w-[40px] h-[35px] bg-slate-900/60 border border-slate-700 rounded-full flex items-center justify-center text-[9px] text-white font-bold">
                    Necrotic (8%)
                  </div>

                  {/* AI measurement line overlays */}
                  <div className="absolute top-[40%] left-[20%] right-[30%] h-0.5 bg-cyan-400/80 border-t border-b border-black/40">
                    <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-bold text-cyan-300 bg-slate-950/80 px-1 rounded">
                      L: 2.6 cm
                    </span>
                  </div>
                  <div className="absolute top-[20%] bottom-[40%] left-[50%] w-0.5 bg-cyan-400/80 border-l border-r border-black/40">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-cyan-300 bg-slate-950/80 px-1 rounded">
                      W: 1.9 cm
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quality controls */}
          <div className="px-4 sm:px-5 py-3 border-t border-slate-900 bg-slate-950/80 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-xs text-slate-400">
            <div>
              <span className="text-[10px] text-slate-500 block uppercase">Image Focus</span>
              <span className="text-slate-200 font-semibold mt-0.5 block">92% (High / Sharp)</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase">Lighting Quality</span>
              <span className="text-slate-200 font-semibold mt-0.5 block">Good (420 lux)</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase">Camera Angle Deviation</span>
              <span className="text-slate-200 font-semibold mt-0.5 block">1.8° (Optimal)</span>
            </div>
          </div>
        </div>

        {/* Right Side: AI Findings Triage Panel (5 cols) */}
        <div className="lg:col-span-5 flex flex-col h-full bg-slate-900 overflow-y-auto">
          {/* Section 1: Dimensions Verification */}
          <div className="p-5 border-b border-slate-850 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">AI Dimensions Findings</span>
              <button
                type="button"
                onClick={() => setEditingMeasurements(!editingMeasurements)}
                className="text-xs font-bold text-teal-400 hover:text-teal-350 transition-colors flex items-center gap-1"
              >
                <Edit3 className="w-3.5 h-3.5" /> {editingMeasurements ? 'Lock Values' : 'Edit Dimensions'}
              </button>
            </div>

            {editingMeasurements ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950/50 p-4 rounded-xl border border-slate-850">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Length (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={length}
                    onChange={e => setLength(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs focus:border-teal-500 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Width (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={width}
                    onChange={e => setWidth(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs focus:border-teal-500 text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Depth (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={depth}
                    onChange={e => setDepth(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs focus:border-teal-500 text-slate-100"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850/80">
                  <span className="text-[10px] text-slate-500 block uppercase">Calculated Area</span>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-slate-100">{area.toFixed(1)}</span>
                    <span className="text-slate-450 text-xs">cm²</span>
                  </div>
                  <div className="text-[10px] text-emerald-400 font-semibold mt-1">
                    Down 23% from last visit (5.3 cm²)
                  </div>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-850/80">
                  <span className="text-[10px] text-slate-500 block uppercase">AI Measured Bounds</span>
                  <div className="mt-1 space-y-0.5 text-xs text-slate-300 font-semibold">
                    <div>Length: {length} cm</div>
                    <div>Width: {width} cm</div>
                    <div>Depth: {depth} cm</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Tissue bed percentages */}
          <div className="p-5 border-b border-slate-850 space-y-3.5">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Tissue Bed Composition</span>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-850/80 space-y-3">
              {[
                { label: 'Granulation', value: assessment.granulation_pct, barColor: 'bg-emerald-500', desc: 'Proliferating tissue with healthy vascular structure' },
                { label: 'Slough', value: assessment.slough_pct, barColor: 'bg-amber-400', desc: 'Moist inflammatory debris requiring selective debridement' },
                { label: 'Necrotic / Eschar', value: assessment.eschar_pct, barColor: 'bg-slate-700', desc: 'Devitalized dry leathery clinical tissue' },
                { label: 'Epithelial', value: assessment.epithelial_pct, barColor: 'bg-rose-300', desc: 'Migrating skin borders signaling closure' }
              ].map(item => (
                <div key={item.label} className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-350">{item.label}</span>
                    <span className="font-extrabold text-slate-200">{item.value}%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div style={{ width: `${item.value}%` }} className={item.barColor} />
                  </div>
                  <span className="text-[9.5px] text-slate-500 block leading-relaxed">{item.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: AI clinical note & Explainability */}
          <div className="p-5 border-b border-slate-850 space-y-4">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-teal-400" /> AI-Generated Narrative Draft
              </span>
              <span className="text-[10px] text-slate-500 block">This note will be added to clinician notes upon approval</span>
            </div>
            
            <div className="bg-slate-950/60 p-4 border border-slate-850 rounded-xl text-xs text-slate-350 leading-relaxed italic">
              "Diabetic foot ulcer located on the Left Plantar Forefoot measures {area.toFixed(1)} cm² in surface area (decreased by 23% from baseline). Wound bed displays predominant granulation tissue (64%), with moderate slough (28%) and focal areas of necrotic eschar (8%). Margin edges are calloused but attached. No active clinical signs of localized secondary infection present."
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Explainability / Why was this flagged?</span>
              <div className="bg-slate-950/40 p-3 rounded-lg border border-slate-900 text-xs text-slate-400 flex items-start gap-2 leading-relaxed">
                <Info className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                <span>
                  The ulcer shows stable volume reduction. However, the system flagged a local <span className="font-semibold text-amber-500">8% necrotic tissue index</span>, triggering an alert to check if mechanical debridement is indicated at today's visit.
                </span>
              </div>
            </div>
          </div>

          {/* Section 4: Actions & Review Input */}
          <div className="p-5 bg-slate-950 border-t border-slate-850 sticky bottom-0 mt-auto space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">Reviewer Notes (Optional)</label>
              <textarea
                rows={2}
                value={reviewNotes}
                onChange={e => setReviewNotes(e.target.value)}
                placeholder="Add signature verification details or correction remarks here..."
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 placeholder:text-slate-550 focus:outline-none focus:border-teal-500 resize-none transition"
              />
            </div>

            <div className="flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                onClick={onReject}
                className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-red-400 hover:bg-red-950/20 rounded-lg transition"
              >
                <XCircle className="w-3.5 h-3.5" /> Reject AI Observation
              </button>
              
              <button
                type="button"
                onClick={onFlag}
                className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-amber-400 hover:bg-amber-950/20 rounded-lg transition"
              >
                <AlertTriangle className="w-3.5 h-3.5" /> Forward to Specialist
              </button>

              <button
                type="button"
                onClick={() => onApprove(reviewNotes)}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-teal-650 hover:bg-teal-700 text-white text-xs font-bold rounded-lg transition shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4" /> Approve & Sign Off
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
