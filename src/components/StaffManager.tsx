import { useState, useEffect, useCallback } from 'react';
import { UserPlus, Search, Mail, Shield, X, MoreHorizontal, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface StaffMember {
  membership_id: string;
  user_id: string;
  display_name: string;
  email: string;
  role: string;
  status: string;
  joined_at: string;
}

interface Props { organizationId: string | null }

const ROLE_OPTIONS = ['clinic_admin', 'doctor', 'wound_specialist', 'nurse'] as const;
const ROLE_BADGE: Record<string, { bg: string; text: string }> = {
  doctor: { bg: 'bg-blue-50', text: 'text-blue-700' },
  wound_specialist: { bg: 'bg-purple-50', text: 'text-purple-700' },
  nurse: { bg: 'bg-teal-50', text: 'text-teal-700' },
  clinic_admin: { bg: 'bg-amber-50', text: 'text-amber-700' },
};
const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  active: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  inactive: { bg: 'bg-slate-100', text: 'text-slate-500' },
};

function Badge({ label, colors }: { label: string; colors?: { bg: string; text: string } }) {
  const c = colors ?? { bg: 'bg-slate-100', text: 'text-slate-600' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${c.bg} ${c.text}`}>
      {label.replace('_', ' ')}
    </span>
  );
}

export default function StaffManager({ organizationId }: Props) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [searchEmail, setSearchEmail] = useState('');
  const [searchResult, setSearchResult] = useState<{ id: string; display_name: string; email: string } | null>(null);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'searching' | 'found' | 'not_found'>('idle');
  const [selectedRole, setSelectedRole] = useState<string>('nurse');
  const [saving, setSaving] = useState(false);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);

  const fetchStaff = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase
      .from('organization_memberships')
      .select('id, user_id, role, status, created_at, profiles!organization_memberships_user_id_profiles_fkey(display_name, email)')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });
    if (err) { setError(err.message); }
    else {
      setStaff((data ?? []).map((m: any) => ({
        membership_id: m.id, user_id: m.user_id,
        display_name: m.profiles?.display_name ?? '—', email: m.profiles?.email ?? '—',
        role: m.role, status: m.status, joined_at: m.created_at,
      })));
    }
    setLoading(false);
  }, [organizationId]);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  const handleSearch = async () => {
    if (!searchEmail.trim()) return;
    setSearchStatus('searching');
    setSearchResult(null);
    const { data } = await supabase
      .from('profiles').select('id, display_name, email')
      .ilike('email', searchEmail.trim()).limit(1).maybeSingle();
    if (data) { setSearchResult(data); setSearchStatus('found'); }
    else setSearchStatus('not_found');
  };

  const handleAddStaff = async () => {
    if (!searchResult || !organizationId) return;
    setSaving(true);
    const { error: err } = await supabase.from('organization_memberships').insert({
      organization_id: organizationId, user_id: searchResult.id,
      role: selectedRole, status: 'active',
    });
    setSaving(false);
    if (err) { setError(err.message.includes('duplicate') ? 'This user is already a staff member.' : err.message); }
    else { closeModal(); fetchStaff(); }
  };

  const updateMembership = async (id: string, updates: Record<string, string>) => {
    const { error: err } = await supabase.from('organization_memberships').update(updates).eq('id', id);
    setActionMenuId(null);
    if (err) setError(err.message); else fetchStaff();
  };

  const closeModal = () => {
    setModalOpen(false); setSearchEmail(''); setSearchResult(null);
    setSearchStatus('idle'); setSelectedRole('nurse'); setError('');
  };

  if (!organizationId) {
    return <div className="flex items-center justify-center h-64 text-slate-500">No organization selected.</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Staff Members</h2>
          <p className="text-sm text-slate-500 mt-1">Manage your clinical team</p>
        </div>
        <button onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors shadow-sm">
          <UserPlus className="w-4 h-4" /> Add Staff
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 flex items-center justify-between">
          {error}
          <button onClick={() => setError('')}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : staff.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <Shield className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="font-medium">No staff members yet</p>
            <p className="text-sm mt-1">Add your first team member to get started.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {['Name', 'Email', 'Role', 'Status', 'Joined'].map((h) => (
                  <th key={h} className="text-left px-6 py-3 font-semibold text-slate-600">{h}</th>
                ))}
                <th className="w-12 px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staff.map((m) => (
                <tr key={m.membership_id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">{m.display_name}</td>
                  <td className="px-6 py-4 text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />{m.email}
                    </span>
                  </td>
                  <td className="px-6 py-4"><Badge label={m.role} colors={ROLE_BADGE[m.role]} /></td>
                  <td className="px-6 py-4"><Badge label={m.status} colors={STATUS_BADGE[m.status]} /></td>
                  <td className="px-6 py-4 text-slate-500">{new Date(m.joined_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4 relative">
                    <button onClick={() => setActionMenuId(actionMenuId === m.membership_id ? null : m.membership_id)}
                      className="p-1 rounded-md hover:bg-slate-100 transition-colors">
                      <MoreHorizontal className="w-4 h-4 text-slate-400" />
                    </button>
                    {actionMenuId === m.membership_id && (
                      <div className="absolute right-6 top-12 z-20 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1">
                        <p className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">Change Role</p>
                        {ROLE_OPTIONS.map((r) => (
                          <button key={r} onClick={() => updateMembership(m.membership_id, { role: r })}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between capitalize">
                            {r.replace('_', ' ')}
                            {m.role === r && <Check className="w-3.5 h-3.5 text-teal-600" />}
                          </button>
                        ))}
                        <div className="border-t border-slate-100 my-1" />
                        {m.status === 'active' ? (
                          <button onClick={() => updateMembership(m.membership_id, { status: 'inactive' })}
                            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50">Deactivate</button>
                        ) : (
                          <button onClick={() => updateMembership(m.membership_id, { status: 'active' })}
                            className="w-full text-left px-3 py-2 text-sm text-emerald-600 hover:bg-emerald-50">Reactivate</button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Staff Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Add Staff Member</h3>
              <button onClick={closeModal} className="p-1 hover:bg-slate-100 rounded-md transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Find user by email</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="email" value={searchEmail}
                      onChange={(e) => { setSearchEmail(e.target.value); setSearchStatus('idle'); setSearchResult(null); }}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder="colleague@clinic.com"
                      className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500" />
                  </div>
                  <button onClick={handleSearch} disabled={searchStatus === 'searching'}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50">
                    <Search className="w-4 h-4" /> Search
                  </button>
                </div>
              </div>
              {searchStatus === 'searching' && (
                <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
                  <div className="w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                  Searching…
                </div>
              )}
              {searchStatus === 'not_found' && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-3">
                  No user found with that email. They need to create an account first.
                </div>
              )}
              {searchStatus === 'found' && searchResult && (
                <div className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-3 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-teal-600 flex items-center justify-center text-white text-sm font-semibold">
                      {(searchResult.display_name?.[0] ?? searchResult.email[0]).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{searchResult.display_name || 'Unnamed user'}</p>
                      <p className="text-xs text-slate-500">{searchResult.email}</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Assign role</label>
                    <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 capitalize">
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r} value={r} className="capitalize">{r.replace('_', ' ')}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl">
              <button onClick={closeModal}
                className="px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={handleAddStaff} disabled={!searchResult || saving}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed">
                {saving
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <UserPlus className="w-4 h-4" />}
                Add to Team
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}