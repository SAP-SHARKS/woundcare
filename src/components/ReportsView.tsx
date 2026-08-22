import { useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend } from 'recharts';
import { Download, Calendar, Activity, Sparkles, TrendingUp, UserCheck } from 'lucide-react';

const HEALING_DATA = [
  { month: 'Jan', healingRate: 65, avgDaysToHeal: 42 },
  { month: 'Feb', healingRate: 68, avgDaysToHeal: 40 },
  { month: 'Mar', healingRate: 72, avgDaysToHeal: 38 },
  { month: 'Apr', healingRate: 70, avgDaysToHeal: 39 },
  { month: 'May', healingRate: 76, avgDaysToHeal: 35 },
  { month: 'Jun', healingRate: 81, avgDaysToHeal: 32 }
];

const AGREEMENT_DATA = [
  { category: 'DFU Area', agreement: 94, clinicianCount: 120, aiCount: 122 },
  { category: 'Venous Area', agreement: 91, clinicianCount: 95, aiCount: 98 },
  { category: 'Granulation %', agreement: 88, clinicianCount: 215, aiCount: 210 },
  { category: 'Slough %', agreement: 85, clinicianCount: 215, aiCount: 220 },
  { category: 'Necrotic %', agreement: 96, clinicianCount: 215, aiCount: 216 }
];

interface Props {
  organizationId: string | null;
}

export default function ReportsView({ organizationId: _organizationId }: Props) {
  const [reportType, setReportType] = useState<'clinical' | 'operational' | 'governance'>('clinical');
  const [dateRange, setDateRange] = useState('30');
  
  const handleExport = (format: 'pdf' | 'csv') => {
    alert(`Exporting report in ${format.toUpperCase()} format...`);
  };

  return (
    <div className="space-y-6">
      {/* Filters and Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-slate-200 p-4 rounded-xl shadow-sm">
        <div className="flex gap-1.5 p-1 bg-slate-100 rounded-lg">
          <button
            onClick={() => setReportType('clinical')}
            className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
              reportType === 'clinical' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-550 hover:text-slate-800'
            }`}
          >
            Clinical Reports
          </button>
          <button
            onClick={() => setReportType('operational')}
            className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
              reportType === 'operational' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-550 hover:text-slate-800'
            }`}
          >
            Operational Performance
          </button>
          <button
            onClick={() => setReportType('governance')}
            className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
              reportType === 'governance' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-550 hover:text-slate-800'
            }`}
          >
            AI Governance / Audit
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-600">
            <Calendar className="w-3.5 h-3.5 text-slate-450" />
            <select
              value={dateRange}
              onChange={e => setDateRange(e.target.value)}
              className="bg-transparent outline-none cursor-pointer font-medium text-slate-700"
            >
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
              <option value="365">Last Year</option>
            </select>
          </div>

          <button
            onClick={() => handleExport('csv')}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 bg-white rounded-lg text-xs font-semibold text-slate-650 hover:bg-slate-50 transition shadow-sm"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
      </div>

      {/* Render selected report dashboard */}
      {reportType === 'clinical' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Chart */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between shadow-sm">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Healing Success Rate (%)</span>
              <p className="text-xs text-slate-500 mt-0.5">Average proportion of wounds fully closed within target duration (12 weeks)</p>
            </div>
            
            <div className="w-full h-64 mt-4 text-[10px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={HEALING_DATA} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorHealing" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0d9488" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#0d9488" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip />
                  <Area type="monotone" dataKey="healingRate" name="Healing Success" stroke="#0d9488" strokeWidth={2} fillOpacity={1} fill="url(#colorHealing)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Right side stats list */}
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="bg-white rounded-xl border border-slate-200 p-4.5 shadow-sm space-y-4">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Clinical Metrics</span>
              
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-teal-50 text-teal-650 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-4.5 h-4.5" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Average Days to Healing</span>
                  <span className="text-base font-bold text-slate-800">35.4 Days</span>
                </div>
                <span className="ml-auto text-xs text-emerald-600 font-semibold">-12% vs last quarter</span>
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                <div className="w-8 h-8 rounded bg-rose-50 text-rose-650 flex items-center justify-center flex-shrink-0">
                  <Activity className="w-4.5 h-4.5" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Active High Risk Census</span>
                  <span className="text-base font-bold text-slate-800">22 Patients</span>
                </div>
                <span className="ml-auto text-xs text-slate-400 font-medium">Stable</span>
              </div>
            </div>

            {/* Wounds by type */}
            <div className="bg-white rounded-xl border border-slate-200 p-4.5 shadow-sm space-y-3">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Active Wounds by Type</span>
              <div className="space-y-2.5">
                {[
                  { name: 'Diabetic Foot Ulcer', count: 18, pct: 45, color: 'bg-teal-600' },
                  { name: 'Pressure Injury', count: 12, pct: 30, color: 'bg-blue-500' },
                  { name: 'Venous Leg Ulcer', count: 8, pct: 20, color: 'bg-amber-500' },
                  { name: 'Surgical / Other', count: 2, pct: 5, color: 'bg-slate-400' }
                ].map(item => (
                  <div key={item.name} className="space-y-1 text-xs">
                    <div className="flex justify-between font-medium">
                      <span className="text-slate-650">{item.name}</span>
                      <span className="text-slate-850 font-semibold">{item.count} ({item.pct}%)</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div style={{ width: `${item.pct}%` }} className={item.color} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {reportType === 'operational' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Metrics */}
          {[
            { title: 'Assessment Compliance', val: '94.2%', desc: 'Assessments logged within 24h window', trend: '+1.5% improvement' },
            { title: 'Clinician Workload', val: '14.2', desc: 'Average active patient charts per nurse', trend: '-8% reduction (good)' },
            { title: 'Response Time', val: '2.4 Hours', desc: 'Average time for specialist review approval', trend: '-45m faster response' }
          ].map(op => (
            <div key={op.title} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{op.title}</span>
              <div className="text-3xl font-extrabold text-slate-900">{op.val}</div>
              <p className="text-xs text-slate-500 leading-normal">{op.desc}</p>
              <div className="text-[10px] text-emerald-600 font-bold mt-2">{op.trend}</div>
            </div>
          ))}

          {/* Compliance breakdown */}
          <div className="md:col-span-3 bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-sm touch-pan-x">
            <div className="px-5 py-3 border-b border-slate-250 bg-slate-50/50 text-xs font-bold text-slate-700 uppercase tracking-wider">
              Staff Assessment Compliance Log
            </div>
            <table className="w-full min-w-[680px] text-xs text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                  <th className="px-5 py-3">Clinician Name</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Assessments Logged</th>
                  <th className="px-5 py-3">Completed On-Time</th>
                  <th className="px-5 py-3">Compliance %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-650">
                {[
                  { name: 'Nurse Fatima Al-Harbi', role: 'Nurse', count: 48, ontime: 46, pct: '95.8%' },
                  { name: 'Dr. Ahmed Al-Qahtani', role: 'Wound Specialist', count: 32, ontime: 30, pct: '93.7%' },
                  { name: 'Nurse Sarah Salem', role: 'Nurse', count: 24, ontime: 21, pct: '87.5%' }
                ].map(row => (
                  <tr key={row.name} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3 font-semibold text-slate-800">{row.name}</td>
                    <td className="px-5 py-3">{row.role}</td>
                    <td className="px-5 py-3">{row.count}</td>
                    <td className="px-5 py-3">{row.ontime}</td>
                    <td className="px-5 py-3 font-bold text-teal-650">{row.pct}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {reportType === 'governance' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* AI vs Clinician Agreement Bar Chart */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between shadow-sm">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">AI vs Clinician Agreement rate (%)</span>
              <p className="text-xs text-slate-500 mt-0.5">Statistical overlap rate of automated tissue bounding boxes against final signed clinician edits</p>
            </div>
            
            <div className="w-full h-64 mt-4 text-[10px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={AGREEMENT_DATA} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="category" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="agreement" name="Agreement Rate (%)" fill="#0d9488" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Audit Metrics List */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Governance Audits</span>
            
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/50 flex items-start gap-2.5">
                <UserCheck className="w-4.5 h-4.5 text-teal-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-semibold text-slate-800 block">Clinician Override Index</span>
                  <span className="text-[10px] text-slate-500 leading-normal block mt-0.5">
                    Clinicians modified AI-generated dimensions in <span className="font-bold text-slate-800">12.5%</span> of visits. Modified tissue composition in <span className="font-bold text-slate-800">8.4%</span> of cases.
                  </span>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/50 flex items-start gap-2.5">
                <Sparkles className="w-4.5 h-4.5 text-cyan-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-semibold text-slate-800 block">AI Confidence Score</span>
                  <span className="text-[10px] text-slate-500 leading-normal block mt-0.5">
                    Model average classification confidence across all clinical assessments is <span className="font-bold text-slate-800">94.8%</span>.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
