import { useState, useEffect } from 'react';
import { Bell, AlertTriangle, CheckCircle2, Clock, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Alert {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'new' | 'acknowledged' | 'resolved';
  created_at: string;
  organization_id: string;
}

type StatusFilter = 'all' | 'new' | 'acknowledged' | 'resolved';

const severityConfig = {
  low: { color: 'bg-green-100 text-green-700', border: 'border-l-green-500' },
  medium: { color: 'bg-amber-100 text-amber-700', border: 'border-l-amber-500' },
  high: { color: 'bg-red-100 text-red-700', border: 'border-l-red-500' },
  critical: { color: 'bg-red-200 text-red-800', border: 'border-l-red-600' },
};

const statusIcons = {
  new: <Bell className="w-4 h-4 text-blue-500" />,
  acknowledged: <Clock className="w-4 h-4 text-amber-500" />,
  resolved: <CheckCircle2 className="w-4 h-4 text-green-500" />,
};

export default function AlertsView({ organizationId }: { organizationId: string | null }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    if (organizationId) fetchAlerts();
  }, [organizationId]);

  async function fetchAlerts() {
    setLoading(true);
    const { data } = await supabase
      .from('alerts')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });
    setAlerts(data || []);
    setLoading(false);
  }

  async function updateStatus(id: string, status: 'acknowledged' | 'resolved') {
    await supabase.from('alerts').update({ status }).eq('id', id);
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
  }

  const filtered = filter === 'all' ? alerts : alerts.filter((a) => a.status === filter);
  const tabs: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'new', label: 'New' },
    { key: 'acknowledged', label: 'Acknowledged' },
    { key: 'resolved', label: 'Resolved' },
  ];

  if (!organizationId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <Bell className="w-12 h-12 mb-3" />
        <p>Select an organization to view alerts</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-teal-600" />
          <h2 className="text-xl font-semibold text-slate-800">Alerts</h2>
          <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded-full">
            {filtered.length}
          </span>
        </div>
        <Filter className="w-5 h-5 text-slate-400" />
      </div>

      <div className="flex gap-2 border-b border-slate-200 pb-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              filter === t.key
                ? 'bg-teal-50 text-teal-700 border-b-2 border-teal-600'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <CheckCircle2 className="w-12 h-12 mb-3" />
          <p className="font-medium">No alerts found</p>
          <p className="text-sm mt-1">Everything looks good!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((alert) => {
            const sev = severityConfig[alert.severity];
            return (
              <div
                key={alert.id}
                className={`bg-white rounded-xl border border-slate-200 border-l-4 ${sev.border} p-4 shadow-sm hover:shadow-md transition-shadow`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${sev.color}`}>
                        {alert.severity}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        {statusIcons[alert.status]} {alert.status}
                      </span>
                    </div>
                    <h3 className="font-semibold text-slate-800 truncate">{alert.title}</h3>
                    {alert.description && (
                      <p className="text-sm text-slate-500 mt-1 line-clamp-2">{alert.description}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-2">
                      {new Date(alert.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4 shrink-0">
                    {alert.status === 'new' && (
                      <button
                        onClick={() => updateStatus(alert.id, 'acknowledged')}
                        className="px-3 py-1.5 text-xs font-medium bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors"
                      >
                        Acknowledge
                      </button>
                    )}
                    {alert.status !== 'resolved' && (
                      <button
                        onClick={() => updateStatus(alert.id, 'resolved')}
                        className="px-3 py-1.5 text-xs font-medium bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
                      >
                        Resolve
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
