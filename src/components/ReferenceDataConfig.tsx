import { useState } from 'react';
import { Layers, Plus, Power, MoveUp, MoveDown, Check, X, ShieldAlert } from 'lucide-react';

interface RefItem {
  id: string;
  code: string;
  display_name: string;
  status: 'active' | 'inactive';
}

interface RefCategory {
  id: string;
  label: string;
  description: string;
  items: RefItem[];
}

const INITIAL_CATEGORIES: RefCategory[] = [
  {
    id: 'wound_types',
    label: 'Wound Types',
    description: 'General etiology class classifications used to stage clinical wounds.',
    items: [
      { id: 'wt-1', code: 'diabetic_foot_ulcer', display_name: 'Diabetic Foot Ulcer (DFU)', status: 'active' },
      { id: 'wt-2', code: 'pressure_injury', display_name: 'Pressure Injury (PI)', status: 'active' },
      { id: 'wt-3', code: 'venous_leg_ulcer', display_name: 'Venous Leg Ulcer (VLU)', status: 'active' },
      { id: 'wt-4', code: 'arterial_ulcer', display_name: 'Arterial Ulcer', status: 'active' },
      { id: 'wt-5', code: 'surgical_wound', display_name: 'Surgical Wound', status: 'active' },
      { id: 'wt-6', code: 'traumatic_wound', display_name: 'Traumatic Wound', status: 'active' }
    ]
  },
  {
    id: 'anatomical_locations',
    label: 'Anatomical Locations',
    description: 'Specific anatomical regions where ulcer episodes may occur.',
    items: [
      { id: 'al-1', code: 'plantar_forefoot', display_name: 'Plantar Forefoot', status: 'active' },
      { id: 'al-2', code: 'lateral_heel', display_name: 'Lateral Heel', status: 'active' },
      { id: 'al-3', code: 'medial_malleolus', display_name: 'Medial Malleolus', status: 'active' },
      { id: 'al-4', code: 'sacrum', display_name: 'Sacrum / Coccyx', status: 'active' },
      { id: 'al-5', code: 'great_toe', display_name: 'Great Toe / Hallux', status: 'active' }
    ]
  },
  {
    id: 'exudate_types',
    label: 'Exudate / Drainage Types',
    description: 'Descriptions of wound drainage character noticed during visits.',
    items: [
      { id: 'et-1', code: 'serous', display_name: 'Serous (Clear, thin, watery)', status: 'active' },
      { id: 'et-2', code: 'sanguineous', display_name: 'Sanguineous (Fresh blood, red)', status: 'active' },
      { id: 'et-3', code: 'serosanguineous', display_name: 'Serosanguineous (Thin, watery, pale red)', status: 'active' },
      { id: 'et-4', code: 'purulent', display_name: 'Purulent (Thick, yellow/green, sign of infection)', status: 'active' }
    ]
  },
  {
    id: 'periwound_findings',
    label: 'Periwound Findings',
    description: 'Observed skin status surrounding the outer borders of the wound.',
    items: [
      { id: 'pf-1', code: 'normal', display_name: 'Intact / Healthy', status: 'active' },
      { id: 'pf-2', code: 'erythema', display_name: 'Erythema (Redness)', status: 'active' },
      { id: 'pf-3', code: 'maceration', display_name: 'Maceration (Water-logged white tissue)', status: 'active' },
      { id: 'pf-4', code: 'edema', display_name: 'Edema (Swelling)', status: 'active' },
      { id: 'pf-5', code: 'callused', display_name: 'Callused margins', status: 'active' }
    ]
  }
];

export default function ReferenceDataConfig() {
  const [categories, setCategories] = useState<RefCategory[]>(INITIAL_CATEGORIES);
  const [selectedCatId, setSelectedCatId] = useState('wound_types');
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Add item form states
  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('');

  const activeCategory = categories.find(c => c.id === selectedCatId) || categories[0];

  const handleToggleStatus = (itemId: string) => {
    setCategories(prev =>
      prev.map(cat =>
        cat.id === selectedCatId
          ? {
              ...cat,
              items: cat.items.map(item =>
                item.id === itemId
                  ? { ...item, status: item.status === 'active' ? 'inactive' : 'active' }
                  : item
              )
            }
          : cat
      )
    );
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const list = [...activeCategory.items];
    if (direction === 'up' && index > 0) {
      const temp = list[index];
      list[index] = list[index - 1];
      list[index - 1] = temp;
    } else if (direction === 'down' && index < list.length - 1) {
      const temp = list[index];
      list[index] = list[index + 1];
      list[index + 1] = temp;
    }
    
    setCategories(prev => prev.map(cat => cat.id === selectedCatId ? { ...cat, items: list } : cat));
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !displayName.trim()) return;

    const newItem: RefItem = {
      id: `${activeCategory.id}-${Date.now()}`,
      code: code.trim().toLowerCase().replace(/\s+/g, '_'),
      display_name: displayName.trim(),
      status: 'active'
    };

    setCategories(prev =>
      prev.map(cat =>
        cat.id === selectedCatId
          ? { ...cat, items: [...cat.items, newItem] }
          : cat
      )
    );

    setCode('');
    setDisplayName('');
    setShowAddForm(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Left Sidebar Menu */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
        <div className="px-4.5 py-4 border-b border-slate-250 bg-slate-50/50 flex items-center gap-2">
          <Layers className="w-4 h-4 text-teal-650" />
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Ref Categories</span>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCatId(cat.id);
                setShowAddForm(false);
              }}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold transition ${
                selectedCatId === cat.id
                  ? 'bg-teal-50 text-teal-700'
                  : 'text-slate-650 hover:bg-slate-50'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Right Content Area (3 cols) */}
      <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col justify-between min-h-[500px]">
        <div>
          {/* Active Category Header */}
          <div className="px-5 py-4 border-b border-slate-250 flex items-start justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">{activeCategory.label} Configuration</h2>
              <p className="text-xs text-slate-500 mt-1">{activeCategory.description}</p>
            </div>
            {!showAddForm && (
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white text-xs font-bold rounded-lg hover:bg-teal-700 transition shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" /> Add Code Value
              </button>
            )}
          </div>

          {/* Add Code Value Form */}
          {showAddForm && (
            <form onSubmit={handleAddItem} className="p-5 bg-slate-50 border-b border-slate-200 space-y-3.5 animate-slide-in">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Add Reference Code Definition</span>
                <button type="button" onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-slate-650">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-slate-600 mb-1">Internal Code Name (slug)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. pressure_injury_stage_1"
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-600 mb-1">Clinical Display Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Pressure Injury - Stage I"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1 px-3.5 py-1.5 bg-teal-600 text-white text-xs font-semibold rounded-lg hover:bg-teal-700 transition"
                >
                  <Check className="w-3.5 h-3.5" /> Save Item
                </button>
              </div>
            </form>
          )}

          {/* Reference Items Table List */}
          <div className="divide-y divide-slate-100">
            {activeCategory.items.map((item, idx) => (
              <div
                key={item.id}
                className={`px-5 py-3.5 flex items-center justify-between gap-4 transition ${
                  item.status === 'inactive' ? 'bg-slate-50/40 opacity-60' : 'hover:bg-slate-50/30'
                }`}
              >
                <div>
                  <span className="font-semibold text-slate-850 text-xs block">{item.display_name}</span>
                  <span className="text-[10px] text-slate-450 font-mono block mt-0.5">Code Slug: {item.code}</span>
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                  {/* Status Indicator */}
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase ${
                    item.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}>
                    {item.status}
                  </span>

                  {/* Ordering arrows */}
                  <div className="flex items-center bg-slate-50 border border-slate-150 rounded overflow-hidden">
                    <button
                      type="button"
                      onClick={() => handleMove(idx, 'up')}
                      disabled={idx === 0}
                      className="p-1 hover:bg-slate-200/50 disabled:opacity-30 border-r border-slate-150 transition"
                      title="Move Up"
                    >
                      <MoveUp className="w-3 h-3 text-slate-550" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(idx, 'down')}
                      disabled={idx === activeCategory.items.length - 1}
                      className="p-1 hover:bg-slate-200/50 disabled:opacity-30 transition"
                      title="Move Down"
                    >
                      <MoveDown className="w-3 h-3 text-slate-550" />
                    </button>
                  </div>

                  {/* Deactivation Toggle Status */}
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(item.id)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded border text-[10px] font-semibold transition ${
                      item.status === 'active'
                        ? 'border-red-150 text-red-650 hover:bg-red-50/20'
                        : 'border-emerald-150 text-emerald-650 hover:bg-emerald-50/20'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                    {item.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Audit footer note */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/40 text-[10px] text-slate-450 flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
          Note: To ensure historical audit trace compliance, reference values are set to inactive instead of deletion.
        </div>
      </div>
    </div>
  );
}
