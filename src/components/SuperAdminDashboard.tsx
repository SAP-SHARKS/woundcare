import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Building2, Users, Activity, Heart, ArrowRight } from 'lucide-react';

interface Props {
  onNavigate: (screen: any) => void;
}

export default function SuperAdminDashboard({ onNavigate }: Props) {
  const [stats, setStats] = useState({ orgs: 0, users: 0, patients: 0 });
  const [recentOrgs, setRecentOrgs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [orgRes, userRes, patientRes] = await Promise.all([
      supabase.from('organizations').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('patients').select('*', { count: 'exact', head: true }),
    ]);
    setStats({
      orgs: orgRes.count ?? 0,
      users: userRes.count ?? 0,
      patients: patientRes.count ?? 0,
    });

    const { data: orgs } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    setRecentOrgs(orgs ?? []);
    setLoading(false);
  }

  const cards = [
    { label: 'Organizations', value: stats.orgs, icon: Building2, color: 'bg-teal-50 text-teal-600' },
    { label: 'Total Users', value: stats.users, icon: Users, color: 'bg-blue-50 text-blue-600' },
    { label: 'Active Patients', value: stats.patients, icon: Heart, color: 'bg-rose-50 text-rose-600' },
    { label: 'System Health', value: 'Operational', icon: Activity, color: 'bg-emerald-50 text-emerald-600', isText: true },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Platform Overview</h1>
        <p className="text-sm text-slate-500 mt-1">System-wide statistics and management</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(card => (
          <div key={card.label} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{card.label}</span>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${card.color}`}>
                <card.icon className="w-[18px] h-[18px]" />
              </div>
            </div>
            <p className="text-2xl font-semibold text-slate-900">
              {card.isText ? card.value : card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Recent Organizations</h2>
          <button
            onClick={() => onNavigate({ name: 'organizations' })}
            className="text-xs text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"
          >
            View all <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
        {recentOrgs.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No organizations yet</p>
            <button
              onClick={() => onNavigate({ name: 'organizations' })}
              className="mt-3 text-sm text-teal-600 hover:text-teal-700 font-medium"
            >
              Create your first organization
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentOrgs.map(org => (
              <div key={org.id} className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Building2 className="w-4.5 h-4.5 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{org.name}</p>
                    <p className="text-xs text-slate-400">{org.org_type?.replace(/_/g, ' ')}</p>
                  </div>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  org.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}>
                  {org.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
