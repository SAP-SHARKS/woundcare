import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { isUuid, requireUuid } from '../lib/validation';
import { X, Save, ShieldAlert, Heart, User, ClipboardList } from 'lucide-react';

interface Patient {
  id?: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  mrn: string;
  dob: string | null;
  sex: string;
  phone: string;
  email: string;
  nationality: string;
  preferred_language: string;
  address: string;
  city: string;
  height_cm: number | '';
  weight_kg: number | '';
  diabetes: boolean;
  diabetes_type: string;
  hba1c: number | '';
  pad: boolean;
  neuropathy: boolean;
  hypertension: boolean;
  kidney_disease: boolean;
  dialysis: boolean;
  cardiovascular_disease: boolean;
  immunosuppression: boolean;
  mobility: string;
  nutrition_status: string;
  previous_wounds: boolean;
  previous_amputations: string;
  medications: string;
  allergies: string;
  status?: string;
}

interface Props {
  patient?: Patient | null; // If provided, we are editing. If null, creating.
  organizationId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

type TabType = 'demographics' | 'clinical' | 'history';

const EMPTY_PATIENT: Patient = {
  first_name: '',
  last_name: '',
  mrn: '',
  dob: '',
  sex: '',
  phone: '',
  email: '',
  nationality: '',
  preferred_language: 'Arabic',
  address: '',
  city: '',
  height_cm: '',
  weight_kg: '',
  diabetes: false,
  diabetes_type: '',
  hba1c: '',
  pad: false,
  neuropathy: false,
  hypertension: false,
  kidney_disease: false,
  dialysis: false,
  cardiovascular_disease: false,
  immunosuppression: false,
  mobility: 'ambulatory',
  nutrition_status: '',
  previous_wounds: false,
  previous_amputations: '',
  medications: '',
  allergies: '',
  status: 'active'
};

export default function PatientForm({ patient, organizationId, onClose, onSaved }: Props) {
  const [form, setForm] = useState<Patient>(EMPTY_PATIENT);
  const [activeTab, setActiveTab] = useState<TabType>('demographics');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (patient) {
      setForm({
        ...EMPTY_PATIENT,
        ...patient,
        dob: patient.dob ? new Date(patient.dob).toISOString().slice(0, 10) : ''
      });
    } else {
      setForm(EMPTY_PATIENT);
    }
  }, [patient]);

  const setField = (key: keyof Patient, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError('First name and last name are required.');
      return;
    }
    setSaving(true);
    setError(null);
    if (patient?.id?.startsWith('sample-')) { onSaved(); setSaving(false); return; }

    try { requireUuid(organizationId, 'Clinic'); }
    catch (validationError) { setError(validationError instanceof Error ? validationError.message : 'A valid clinic is required.'); setSaving(false); return; }

    const full_name = `${form.first_name.trim()} ${form.last_name.trim()}`;
    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      full_name,
      mrn: form.mrn.trim(),
      dob: form.dob || null,
      sex: form.sex || null,
      phone: form.phone.trim(),
      email: form.email.trim(),
      nationality: form.nationality.trim(),
      preferred_language: form.preferred_language.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      height_cm: form.height_cm === '' ? null : Number(form.height_cm),
      weight_kg: form.weight_kg === '' ? null : Number(form.weight_kg),
      diabetes: form.diabetes,
      diabetes_type: form.diabetes ? form.diabetes_type : '',
      hba1c: form.diabetes && form.hba1c !== '' ? Number(form.hba1c) : null,
      pad: form.pad,
      neuropathy: form.neuropathy,
      hypertension: form.hypertension,
      kidney_disease: form.kidney_disease,
      dialysis: form.dialysis,
      cardiovascular_disease: form.cardiovascular_disease,
      immunosuppression: form.immunosuppression,
      mobility: form.mobility,
      nutrition_status: form.nutrition_status.trim(),
      previous_wounds: form.previous_wounds,
      previous_amputations: form.previous_amputations.trim(),
      medications: form.medications.trim(),
      allergies: form.allergies.trim(),
      status: form.status || 'active',
      organization_id: organizationId
    };

    try {
      if (patient?.id && !isUuid(patient.id)) throw new Error('This patient is a preview record and cannot be written to Supabase.');
      if (patient?.id) {
        // Edit mode
        const { error: err } = await supabase
          .from('patients')
          .update(payload)
          .eq('id', patient.id);
        if (err) throw err;
      } else {
        // Create mode
        const patient_id_code = form.mrn.trim() || `P-${Date.now()}`;
        const { error: err } = await supabase
          .from('patients')
          .insert({
            ...payload,
            patient_id_code
          });
        if (err) throw err;
      }
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to save patient record');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <form onSubmit={handleSave} className="relative w-full max-w-xl h-full bg-white shadow-2xl flex flex-col z-10 animate-slide-in">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">
              {patient ? 'Edit Patient Record' : 'Add New Patient'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {patient ? `Editing chart for MRN: ${patient.mrn || 'N/A'}` : 'Create a new clinical chart profile'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-slate-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex px-3 sm:px-6 border-b border-slate-100 bg-slate-50/50 overflow-x-auto snap-x touch-pan-x">
          {(
            [
              { key: 'demographics', label: 'Demographics', icon: User },
              { key: 'clinical', label: 'Clinical Factors', icon: Heart },
              { key: 'history', label: 'Medical History', icon: ClipboardList }
            ] as const
          ).map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`shrink-0 snap-start flex items-center gap-1.5 px-4 py-3 text-xs font-semibold border-b-2 transition-all ${ 
                activeTab === tab.key
                  ? 'border-teal-600 text-teal-700 font-bold bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
              <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Demographics Tab */}
          {activeTab === 'demographics' && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Basic Info</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={form.first_name}
                    onChange={e => setField('first_name', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={form.last_name}
                    onChange={e => setField('last_name', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">MRN</label>
                  <input
                    type="text"
                    placeholder="Medical record number"
                    value={form.mrn}
                    onChange={e => setField('mrn', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Sex</label>
                  <select
                    value={form.sex || ''}
                    onChange={e => setField('sex', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
                  >
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    value={form.dob || ''}
                    onChange={e => setField('dob', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Preferred Language</label>
                  <input
                    type="text"
                    value={form.preferred_language}
                    onChange={e => setField('preferred_language', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Nationality</label>
                  <input
                    type="text"
                    value={form.nationality}
                    onChange={e => setField('nationality', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={e => setField('status', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="discharged">Discharged</option>
                  </select>
                </div>
              </div>

              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 pt-3 mb-2">Contact Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => setField('phone', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setField('email', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-600 mb-1">Address</label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={e => setField('address', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">City</label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={e => setField('city', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Clinical Factors Tab */}
          {activeTab === 'clinical' && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Physiological Factors</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Height (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 175.5"
                    value={form.height_cm}
                    onChange={e => setField('height_cm', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 72.0"
                    value={form.weight_kg}
                    onChange={e => setField('weight_kg', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Mobility Status</label>
                  <select
                    value={form.mobility}
                    onChange={e => setField('mobility', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
                  >
                    <option value="ambulatory">Ambulatory</option>
                    <option value="assisted">Assisted</option>
                    <option value="wheelchair">Wheelchair Dependent</option>
                    <option value="bedbound">Bedbound</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Nutrition Status</label>
                  <input
                    type="text"
                    placeholder="e.g. Good, Poor, Malnourished"
                    value={form.nutrition_status}
                    onChange={e => setField('nutrition_status', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition"
                  />
                </div>
              </div>

              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 pt-3 mb-2">Comorbidities & Clinical Risks</h3>
              
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-slate-800">Diabetes Mellitus</span>
                    <span className="text-[10px] text-slate-400">Has diagnosed diabetes</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.diabetes}
                    onChange={e => setField('diabetes', e.target.checked)}
                    className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 focus:ring-2 border-slate-300"
                  />
                </div>

                {form.diabetes && (
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Diabetes Type</label>
                      <select
                        value={form.diabetes_type}
                        onChange={e => setField('diabetes_type', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-xs text-slate-850 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                      >
                        <option value="">Select Type</option>
                        <option value="Type I">Type I</option>
                        <option value="Type II">Type II</option>
                        <option value="Gestational">Gestational</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Latest HbA1c (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="e.g. 7.5"
                        value={form.hba1c}
                        onChange={e => setField('hba1c', e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-xs text-slate-850 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                {[
                  { key: 'pad', label: 'Peripheral Arterial Disease (PAD)' },
                  { key: 'neuropathy', label: 'Neuropathy' },
                  { key: 'hypertension', label: 'Hypertension' },
                  { key: 'kidney_disease', label: 'Chronic Kidney Disease' },
                  { key: 'dialysis', label: 'On Dialysis' },
                  { key: 'cardiovascular_disease', label: 'Cardiovascular Disease (CVD)' },
                  { key: 'immunosuppression', label: 'Immunosuppressed' }
                ].map(item => (
                  <label key={item.key} className="flex items-center justify-between p-2.5 bg-white border border-slate-100 rounded-lg hover:bg-slate-50 transition cursor-pointer select-none">
                    <span className="text-xs text-slate-700">{item.label}</span>
                    <input
                      type="checkbox"
                      checked={!!(form as any)[item.key]}
                      onChange={e => setField(item.key as any, e.target.checked)}
                      className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 focus:ring-2 border-slate-300"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Medical History Tab */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Previous Incidences</h3>
              
              <label className="flex items-center justify-between p-3.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50/50 transition cursor-pointer select-none">
                <div>
                  <span className="text-xs font-semibold text-slate-800 block">History of Previous Wounds / Ulcers</span>
                  <span className="text-[10px] text-slate-400">Has suffered prior ulcers in similar anatomy</span>
                </div>
                <input
                  type="checkbox"
                  checked={form.previous_wounds}
                  onChange={e => setField('previous_wounds', e.target.checked)}
                  className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 focus:ring-2 border-slate-300"
                />
              </label>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Previous Amputations</label>
                <textarea
                  rows={2}
                  placeholder="Details of any past amputations (e.g. Left first toe amputation in 2024)"
                  value={form.previous_amputations}
                  onChange={e => setField('previous_amputations', e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition resize-none"
                />
              </div>

              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 pt-3 mb-2">Medications & Sensitivity</h3>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Current Medications</label>
                <textarea
                  rows={3}
                  placeholder="List active medications (e.g. Metformin, Aspirin, Lisinopril)"
                  value={form.medications}
                  onChange={e => setField('medications', e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Known Allergies / Sensitivities</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Penicillin, Latex"
                  value={form.allergies}
                  onChange={e => setField('allergies', e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-4 border-t border-slate-100 flex flex-wrap items-center justify-end gap-3 bg-slate-50">
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
            {saving ? 'Saving...' : 'Save Patient Chart'}
          </button>
        </div>
      </form>
    </div>
  );
}
