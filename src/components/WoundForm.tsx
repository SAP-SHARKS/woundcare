import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Save, ShieldAlert, Activity } from 'lucide-react';
import { isUuid, requireUuid } from '../lib/validation';

export interface Wound {
  id?: string;
  patient_id: string;
  organization_id: string | null;
  location_description: string;
  wound_side: string;
  wound_type: string;
  date_first_observed: string;
  status: string;
  classification?: string;
  notes?: string;
}

interface Props {
  wound?: Wound | null; // If provided, we are editing. If null, creating.
  patientId: string;
  organizationId: string | null;
  onClose: () => void;
  onSaved: (savedWound?: Wound) => void;
}

const WOUND_TYPES: Record<string, string> = {
  diabetic_foot_ulcer: 'Diabetic Foot Ulcer',
  pressure_injury: 'Pressure Injury',
  venous_leg_ulcer: 'Venous Leg Ulcer',
  arterial_ulcer: 'Arterial Ulcer',
  surgical_wound: 'Surgical Wound',
  traumatic_wound: 'Traumatic Wound',
  skin_tear: 'Skin Tear',
  other: 'Other',
};
const WOUND_SIDES = ['left', 'right', 'midline', 'bilateral', 'unspecified'] as const;
const WOUND_STATUSES = ['active', 'resolved', 'suspended'] as const;

export function parseWoundLocation(locationStr: string) {
  try {
    const parsed = JSON.parse(locationStr);
    if (parsed && typeof parsed === 'object') {
      return {
        description: parsed.description || '',
        classification: parsed.classification || '',
        notes: parsed.notes || ''
      };
    }
  } catch {
    // Return plain string
  }
  return {
    description: locationStr || '',
    classification: '',
    notes: ''
  };
}

export default function WoundForm({ wound, patientId, organizationId, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    location_description: '',
    wound_side: 'left',
    wound_type: 'other',
    date_first_observed: new Date().toISOString().slice(0, 10),
    status: 'active',
    classification: '',
    notes: ''
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (wound) {
      const parsed = parseWoundLocation(wound.location_description);
      setForm({
        location_description: parsed.description,
        wound_side: wound.wound_side || 'left',
        wound_type: wound.wound_type || 'other',
        date_first_observed: wound.date_first_observed ? new Date(wound.date_first_observed).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        status: wound.status || 'active',
        classification: parsed.classification || wound.classification || '',
        notes: parsed.notes || wound.notes || ''
      });
    } else {
      setForm({
        location_description: '',
        wound_side: 'left',
        wound_type: 'other',
        date_first_observed: new Date().toISOString().slice(0, 10),
        status: 'active',
        classification: '',
        notes: ''
      });
    }
  }, [wound]);

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.location_description.trim()) {
      setError('Anatomical location description is required.');
      return;
    }
    setSaving(true);
    setError(null);

    // Serialize details into location_description to bypass static DB column limits
    const serializedLocation = JSON.stringify({
      description: form.location_description.trim(),
      classification: form.classification.trim(),
      notes: form.notes.trim()
    });

    const payload = {
      patient_id: patientId,
      organization_id: organizationId,
      location_description: serializedLocation,
      wound_side: form.wound_side,
      wound_type: form.wound_type,
      date_first_observed: form.date_first_observed,
      status: form.status
    };

    if (patientId.startsWith('sample-')) {
      const previewWound: Wound = { ...payload, id: wound?.id || `sample-w-${crypto.randomUUID()}` };
      onSaved(previewWound);
      setSaving(false);
      return;
    }

    try {
      requireUuid(patientId, 'Patient');
      requireUuid(organizationId, 'Clinic');
      if (wound?.id && !isUuid(wound.id)) throw new Error('This episode is a preview record and cannot be written to Supabase.');
      if (wound?.id) {
        // Edit mode
        const { error: err } = await supabase
          .from('wounds')
          .update(payload)
          .eq('id', wound.id);
        if (err) throw err;
      } else {
        // Create mode
        const { error: err } = await supabase
          .from('wounds')
          .insert(payload);
        if (err) throw err;
      }
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save wound record');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <form onSubmit={handleSave} className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col z-10 animate-scale-in">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-650 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-950">
                {wound ? 'Edit Wound Episode' : 'Create Wound Episode'}
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {wound ? 'Update clinical details for this episode' : 'Track a new wound longitudinally'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-slate-650 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
              <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Anatomical Location Description *</label>
            <input
              type="text"
              required
              placeholder="e.g. Left plantar forefoot, lateral heel"
              value={form.location_description}
              onChange={e => setField('location_description', e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Laterality / Side</label>
              <select
                value={form.wound_side}
                onChange={e => setField('wound_side', e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
              >
                {WOUND_SIDES.map(side => (
                  <option key={side} value={side} className="capitalize">
                    {side === 'unspecified' ? 'Unspecified' : side.charAt(0).toUpperCase() + side.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Wound Type</label>
              <select
                value={form.wound_type}
                onChange={e => setField('wound_type', e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
              >
                {Object.entries(WOUND_TYPES).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Date First Observed</label>
              <input
                type="date"
                value={form.date_first_observed}
                onChange={e => setField('date_first_observed', e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Episode Status</label>
              <select
                value={form.status}
                onChange={e => setField('status', e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
              >
                {WOUND_STATUSES.map(stat => (
                  <option key={stat} value={stat} className="capitalize">{stat}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Classification / Stage</label>
            <input
              type="text"
              placeholder="e.g. Stage II (Pressure Injury), Wagner Grade 3 (DFU)"
              value={form.classification}
              onChange={e => setField('classification', e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Episode Clinical Notes</label>
            <textarea
              rows={3}
              placeholder="Record notes on onset, etiology, or treatment plan for this wound..."
              value={form.notes}
              onChange={e => setField('notes', e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 hover:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-500/30 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-1.5 px-4.5 py-2.5 bg-teal-600 text-white text-xs font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : wound ? 'Save Changes' : 'Create Episode'}
          </button>
        </div>
      </form>
    </div>
  );
}
