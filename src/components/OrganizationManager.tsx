import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Building2, Plus, CreditCard as Edit3, Search, X, MapPin, Phone, Mail, ChevronRight } from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  legal_name: string;
  org_type: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  region: string;
  country: string;
  status: string;
  created_at: string;
}

const EMPTY_FORM = {
  name: '', legal_name: '', org_type: 'wound_clinic', phone: '', email: '',
  address: '', city: '', region: '', country: 'Saudi Arabia',
};

const ORG_TYPES = [
  { value: 'wound_clinic', label: 'Wound Clinic' },
  { value: 'hospital', label: 'Hospital' },
  { value: 'outpatient_clinic', label: 'Outpatient Clinic' },
  { value: 'home_healthcare', label: 'Home Healthcare' },
  { value: 'long_term_care', label: 'Long-Term Care' },
  { value: 'physician_practice', label: 'Physician Practice' },
];

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  inactive: 'bg-slate-100 text-slate-500',
};

export default function OrganizationManager() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<{ open: boolean; editId: string | null }>({ open: false, editId: null });
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadOrgs(); }, []);

  async function loadOrgs() {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false });
    if (err) { setError(err.message); } else { setOrgs(data ?? []); }
    setLoading(false);
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setModal({ open: true, editId: null });
  }

  function openEdit(org: Organization) {
    setForm({
      name: org.name, legal_name: org.legal_name ?? '', org_type: org.org_type,
      phone: org.phone ?? '', email: org.email ?? '', address: org.address ?? '',
      city: org.city ?? '', region: org.region ?? '', country: org.country ?? '',
    });
    setModal({ open: true, editId: org.id });
  }

  function closeModal() { setModal({ open: false, editId: null }); }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    setError('');
    const payload = { ...form, name: form.name.trim(), legal_name: form.legal_name.trim() };
    let err;
    if (modal.editId) {
      ({ error: err } = await supabase.from('organizations').update(payload).eq('id', modal.editId));
    } else {
      const { data: newOrg, error: insertErr } = await supabase.from('organizations').insert(payload).select('id').single();
      err = insertErr;
      if (newOrg && !err) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('organization_memberships').insert({
            organization_id: newOrg.id,
            user_id: user.id,
            role: 'clinic_admin',
            status: 'active',
          });
          await supabase.from('profiles').update({ organization_id: newOrg.id }).eq('id', user.id);
        }
      }
    }
    setSaving(false);
    if (err) { setError(err.message); return; }
    closeModal();
    loadOrgs();
  }

  async function handleDeactivate(id: string) {
    const { error: err } = await supabase.from('organizations').update({ status: 'inactive' }).eq('id', id);
    if (err) { setError(err.message); return; }
    loadOrgs();
  }

  const filtered = orgs.filter(o => {
    const q = search.toLowerCase();
    return !q || o.name.toLowerCase().includes(q) || o.city?.toLowerCase().includes(q)
      || o.org_type.toLowerCase().includes(q);
  });

  const typeLabel = (t: string) => ORG_TYPES.find(o => o.value === t)?.label ?? t.replace(/_/g, ' ');

  function set(field: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }));
  }

  // --- Loading ---
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
      </div>
    );
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white text-slate-900 placeholder:text-slate-400';
  const labelCls = 'block text-xs font-medium text-slate-600 mb-1';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Organizations</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage clinics, hospitals, and care facilities</p>
        </div>
        <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /> Create Organization
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg flex items-center justify-between">
          {error}
          <button onClick={() => setError('')}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="text" placeholder="Search by name, city, or type…" value={search} onChange={e => setSearch(e.target.value)}
          className="w-full sm:w-80 pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent" />
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 py-16 text-center">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600">{search ? 'No organizations match your search' : 'No organizations yet'}</p>
          {!search && <button onClick={openCreate} className="mt-3 text-sm text-teal-600 hover:text-teal-700 font-medium">Create your first organization</button>}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Organization</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Location</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(org => (
                  <tr key={org.id} onClick={() => openEdit(org)} className="hover:bg-slate-50 transition-colors cursor-pointer">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
                          <Building2 className="w-[18px] h-[18px] text-teal-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate">{org.name}</p>
                          {org.email && <p className="text-xs text-slate-400 truncate">{org.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{typeLabel(org.org_type)}</td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {[org.city, org.country].filter(Boolean).join(', ') || '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_BADGE[org.status] ?? STATUS_BADGE.inactive}`}>
                        {org.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {org.status === 'active' && (
                        <button onClick={e => { e.stopPropagation(); handleDeactivate(org.id); }}
                          className="text-xs text-slate-400 hover:text-red-600 font-medium mr-3 transition-colors">Deactivate</button>
                      )}
                      <Edit3 className="w-4 h-4 text-slate-400 inline-block" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map(org => (
              <div key={org.id} onClick={() => openEdit(org)} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-sm transition-shadow cursor-pointer">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
                      <Building2 className="w-[18px] h-[18px] text-teal-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{org.name}</p>
                      <p className="text-xs text-slate-500">{typeLabel(org.org_type)}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 mt-1" />
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-2 pl-[46px]">
                  {org.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{org.city}</span>}
                  {org.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{org.phone}</span>}
                  {org.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{org.email}</span>}
                </div>
                <div className="flex items-center justify-between mt-3 pl-[46px]">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_BADGE[org.status] ?? STATUS_BADGE.inactive}`}>
                    {org.status}
                  </span>
                  {org.status === 'active' && (
                    <button onClick={e => { e.stopPropagation(); handleDeactivate(org.id); }}
                      className="text-xs text-slate-400 hover:text-red-600 font-medium transition-colors">Deactivate</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={closeModal}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">{modal.editId ? 'Edit Organization' : 'Create Organization'}</h2>
              <button onClick={closeModal} className="p-1 hover:bg-slate-100 rounded-lg transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Name *</label>
                  <input value={form.name} onChange={set('name')} placeholder="e.g. Riyadh Wound Center" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Legal Name</label>
                  <input value={form.legal_name} onChange={set('legal_name')} placeholder="Registered legal name" className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Organization Type *</label>
                <select value={form.org_type} onChange={set('org_type')} className={inputCls}>
                  {ORG_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Phone</label>
                  <input value={form.phone} onChange={set('phone')} placeholder="+966…" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input type="email" value={form.email} onChange={set('email')} placeholder="contact@clinic.com" className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Address</label>
                <input value={form.address} onChange={set('address')} placeholder="Street address" className={inputCls} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className={labelCls}>City</label>
                  <input value={form.city} onChange={set('city')} placeholder="City" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Region</label>
                  <input value={form.region} onChange={set('region')} placeholder="Region / State" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Country</label>
                  <input value={form.country} onChange={set('country')} placeholder="Country" className={inputCls} />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
              <button onClick={closeModal} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.name.trim()}
                className="px-5 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors shadow-sm">
                {saving ? 'Saving…' : modal.editId ? 'Save Changes' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}