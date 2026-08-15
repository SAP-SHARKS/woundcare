import { useState } from 'react';
import { ToggleLeft, ToggleRight, Trash2, Plus, Edit2, Play, Sparkles, X, Check } from 'lucide-react';

interface Rule {
  id: string;
  name: string;
  variable: string;
  operator: string;
  threshold: number;
  unit: string;
  severity: 'critical' | 'worsening' | 'medium' | 'low';
  action: string;
  scope: 'global' | 'clinic';
  status: 'enabled' | 'disabled';
  version: string;
}

const INITIAL_RULES: Rule[] = [
  {
    id: 'rule-1',
    name: 'Diabetic Ulcer Area Expansion',
    variable: 'Wound area change',
    operator: 'greater than',
    threshold: 20,
    unit: '%',
    severity: 'critical',
    action: 'Create urgent clinical alert',
    scope: 'global',
    status: 'enabled',
    version: '1.2'
  },
  {
    id: 'rule-2',
    name: 'Necrotic Tissue Warning',
    variable: 'Necrotic eschar tissue',
    operator: 'greater than or equal to',
    threshold: 5,
    unit: '%',
    severity: 'worsening',
    action: 'Flag for wound specialist review',
    scope: 'global',
    status: 'enabled',
    version: '2.0'
  },
  {
    id: 'rule-3',
    name: 'Elderly Patient Assessment Frequency',
    variable: 'Patient age',
    operator: 'greater than',
    threshold: 75,
    unit: 'years',
    severity: 'medium',
    action: 'Reduce assessment schedule to 5 days',
    scope: 'clinic',
    status: 'enabled',
    version: '1.0'
  },
  {
    id: 'rule-4',
    name: 'Amputation Risk Flag',
    variable: 'Previous amputations',
    operator: 'equals',
    threshold: 1, // boolean flag represented
    unit: 'true',
    severity: 'critical',
    action: 'Auto-assign Doctor review task',
    scope: 'global',
    status: 'enabled',
    version: '1.1'
  }
];

export default function RuleManager() {
  const [rules, setRules] = useState<Rule[]>(INITIAL_RULES);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  // Rule Editor Builder states
  const [name, setName] = useState('');
  const [variable, setVariable] = useState('Wound area change');
  const [operator, setOperator] = useState('greater than');
  const [threshold, setThreshold] = useState(15);
  const [unit, setUnit] = useState('%');
  const [severity, setSeverity] = useState<'critical' | 'worsening' | 'medium' | 'low'>('medium');
  const [action, setAction] = useState('Create clinical alert');
  const [scope, setScope] = useState<'global' | 'clinic'>('global');
  const [status, setStatus] = useState<'enabled' | 'disabled'>('enabled');

  const handleToggleStatus = (id: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, status: r.status === 'enabled' ? 'disabled' : 'enabled' } : r));
  };

  const handleOpenEditor = (rule: Rule | null) => {
    if (rule) {
      setEditingRule(rule);
      setName(rule.name);
      setVariable(rule.variable);
      setOperator(rule.operator);
      setThreshold(rule.threshold);
      setUnit(rule.unit);
      setSeverity(rule.severity);
      setAction(rule.action);
      setScope(rule.scope);
      setStatus(rule.status);
    } else {
      setEditingRule(null);
      setName('New Triage Threshold Rule');
      setVariable('Wound area change');
      setOperator('greater than');
      setThreshold(15);
      setUnit('%');
      setSeverity('medium');
      setAction('Create clinical alert');
      setScope('global');
      setStatus('enabled');
    }
    setShowEditor(true);
  };

  const handleSaveRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRule) {
      setRules(prev => prev.map(r => r.id === editingRule.id ? {
        ...r,
        name, variable, operator, threshold, unit, severity, action, scope, status
      } : r));
    } else {
      const newRule: Rule = {
        id: `rule-${Date.now()}`,
        name, variable, operator, threshold, unit, severity, action, scope, status,
        version: '1.0'
      };
      setRules(prev => [...prev, newRule]);
    }
    setShowEditor(false);
  };

  const handleDeleteRule = (id: string) => {
    if (confirm("Are you sure you want to delete this configuration rule?")) {
      setRules(prev => prev.filter(r => r.id !== id));
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'critical': return <span className="px-2.5 py-0.5 rounded bg-red-50 text-red-750 font-bold border border-red-200">Critical</span>;
      case 'worsening': return <span className="px-2.5 py-0.5 rounded bg-amber-50 text-amber-750 font-bold border border-amber-200">Worsening</span>;
      case 'medium': return <span className="px-2.5 py-0.5 rounded bg-blue-50 text-blue-750 font-bold border border-blue-200">Medium</span>;
      default: return <span className="px-2.5 py-0.5 rounded bg-slate-50 text-slate-700 font-medium border border-slate-200">Low</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Clinical Triage Rules Engine</h2>
          <p className="text-xs text-slate-500 mt-0.5">Configure triggering thresholds for automated clinical alerts and reviewer tags</p>
        </div>
        <button
          onClick={() => handleOpenEditor(null)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-teal-600 text-white text-xs font-bold rounded-lg hover:bg-teal-700 transition shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add Rule
        </button>
      </div>

      {/* Rules table list */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-250 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="px-5 py-3">Rule Name / Description</th>
                <th className="px-5 py-3">Parameter Variable</th>
                <th className="px-5 py-3">Condition Logic</th>
                <th className="px-5 py-3">Severity Effect</th>
                <th className="px-5 py-3">Scope</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-650">
              {rules.map(rule => (
                <tr key={rule.id} className="hover:bg-slate-50/50">
                  <td className="px-5 py-4">
                    <span className="font-semibold text-slate-800 block">{rule.name}</span>
                    <span className="text-[10px] text-slate-450 block mt-0.5">Version {rule.version} • {rule.action}</span>
                  </td>
                  <td className="px-5 py-4 font-medium text-slate-700">{rule.variable}</td>
                  <td className="px-5 py-4 font-mono text-[11px] text-slate-600">
                    IF {rule.operator} {rule.threshold} {rule.unit}
                  </td>
                  <td className="px-5 py-4">{getSeverityBadge(rule.severity)}</td>
                  <td className="px-5 py-4 capitalize font-semibold">{rule.scope}</td>
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(rule.id)}
                      className={`text-slate-400 hover:text-slate-600 transition ${
                        rule.status === 'enabled' ? 'text-teal-600 hover:text-teal-700' : ''
                      }`}
                    >
                      {rule.status === 'enabled' ? (
                        <ToggleRight className="w-8 h-8 text-teal-650" />
                      ) : (
                        <ToggleLeft className="w-8 h-8 text-slate-300" />
                      )}
                    </button>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenEditor(rule)}
                        className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-teal-600 transition"
                        title="Edit Rule"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-red-650 transition"
                        title="Delete Rule"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Screen 20: Rule Editor Modal Drawer */}
      {showEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-end">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowEditor(false)} />

          {/* Drawer Panel */}
          <form onSubmit={handleSaveRule} className="relative w-full max-w-lg h-full bg-white shadow-2xl flex flex-col z-10 animate-slide-in">
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-teal-50 text-teal-600 flex items-center justify-center">
                  <Play className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    {editingRule ? 'Edit Configuration Rule' : 'Create Configuration Rule'}
                  </h2>
                  <p className="text-[11px] text-slate-400 mt-0.5">Define custom criteria to automate triage flags</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowEditor(false)} className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-slate-600 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Rule Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Rule Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-650 mb-1.5">Rule Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Excessive Granulation Loss Trigger"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
                />
              </div>

              {/* Conditional Builder (IF Block) */}
              <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">IF Condition (Trigger Variable)</span>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Variable Select</label>
                    <select
                      value={variable}
                      onChange={e => setVariable(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-xs text-slate-700 focus:ring-2 focus:ring-teal-500/20"
                    >
                      <option value="Wound area change">Wound area change</option>
                      <option value="Necrotic eschar tissue">Necrotic eschar tissue (%)</option>
                      <option value="Patient age">Patient age</option>
                      <option value="Assessment compliance delay">Assessment compliance delay</option>
                      <option value="Previous amputations">Previous amputations</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-1">Comparison Operator</label>
                      <select
                        value={operator}
                        onChange={e => setOperator(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-xs text-slate-700 focus:ring-2 focus:ring-teal-500/20"
                      >
                        <option value="greater than">Greater than (&gt;)</option>
                        <option value="greater than or equal to">Greater than or equal (&ge;)</option>
                        <option value="less than">Less than (&lt;)</option>
                        <option value="equals">Equals (=)</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-1">Threshold</label>
                        <input
                          type="number"
                          value={threshold}
                          onChange={e => setThreshold(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-xs text-slate-700 focus:ring-2 focus:ring-teal-500/20"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-1">Unit</label>
                        <input
                          type="text"
                          value={unit}
                          onChange={e => setUnit(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-xs text-slate-700 focus:ring-2 focus:ring-teal-500/20"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Builder (THEN Block) */}
              <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">THEN Action (Outcome Effect)</span>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Severity Flag</label>
                    <select
                      value={severity}
                      onChange={e => setSeverity(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-xs text-slate-700 focus:ring-2 focus:ring-teal-500/20"
                    >
                      <option value="critical">Critical</option>
                      <option value="worsening">Worsening</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">Target Action</label>
                    <input
                      type="text"
                      value={action}
                      onChange={e => setAction(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-xs text-slate-700 focus:ring-2 focus:ring-teal-500/20"
                    />
                  </div>
                </div>
              </div>

              {/* Scoping details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-650 mb-1.5">Rule Scope</label>
                  <select
                    value={scope}
                    onChange={e => setScope(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
                  >
                    <option value="global">Global (All clinics)</option>
                    <option value="clinic">Clinic Specific</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-650 mb-1.5">Initial Status</label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
                  >
                    <option value="enabled">Active / Enabled</option>
                    <option value="disabled">Paused / Disabled</option>
                  </select>
                </div>
              </div>

              {/* Screen 20: Natural Language Rule Preview Sentence */}
              <div className="bg-teal-50 border border-teal-100 rounded-xl p-4 space-y-2">
                <span className="text-[11px] font-bold text-teal-700 uppercase tracking-wider block flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> Rule Logic Preview (English Summary)
                </span>
                <p className="text-xs text-teal-900 leading-relaxed font-semibold italic">
                  "IF [{variable}] [{operator}] [{threshold} {unit}] THEN trigger [{severity}] status severity and [{action}]."
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50">
              <button
                type="button"
                onClick={() => setShowEditor(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-150 hover:text-slate-800 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4.5 py-2.5 bg-teal-650 text-white text-xs font-semibold rounded-lg hover:bg-teal-700 transition shadow-sm"
              >
                <Check className="w-4 h-4" /> Save Configuration
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
