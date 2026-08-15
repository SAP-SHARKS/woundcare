import { useState, useEffect } from 'react';
import { Shield, Clock, Search, User, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AuditEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
  user_id: string;
  organization_id: string;
  profiles?: { display_name: string } | null;
}

export default function AuditLogView({ organizationId }: { organizationId: string | null }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (organizationId) fetchLogs();
  }, [organizationId]);

  async function fetchLogs() {
    setLoading(true);
    const { data } = await supabase
      .from('audit_logs')
      .select('*, profiles(display_name)')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(100);
    setEntries(data || []);
    setLoading(false);
  }

  const filtered = search
    ? entries.filter((e) => e.action.toLowerCase().includes(search.toLowerCase()))
    : entries;

  if (!organizationId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <Shield className="w-12 h-12 mb-3" />
        <p>Select an organization to view audit logs</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-teal-600" />
          <h2 className="text-xl font-semibold text-slate-800">Audit Log</h2>
          <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded-full">
            {filtered.length}
          </span>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by action..."
          className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <FileText className="w-12 h-12 mb-3" />
          <p className="font-medium">No audit entries found</p>
          <p className="text-sm mt-1">{search ? 'Try a different filter' : 'Activity will appear here'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Timestamp</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">User</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Action</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Entity</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Entity ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="flex items-center gap-1.5 text-slate-600 font-mono text-xs">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {new Date(entry.created_at).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="flex items-center gap-1.5 text-slate-700">
                        <User className="w-3 h-3 text-slate-400" />
                        {entry.profiles?.display_name || 'System'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 text-xs font-medium bg-teal-50 text-teal-700 rounded-full">
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="flex items-center gap-1.5 text-slate-600">
                        <FileText className="w-3 h-3 text-slate-400" />
                        {entry.entity_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-slate-400">
                      {entry.entity_id?.slice(0, 8)}...
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
