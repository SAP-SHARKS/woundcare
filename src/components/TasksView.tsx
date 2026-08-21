import { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Plus, CheckCircle2, Clock, X, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed';
  due_date: string | null;
  assigned_to: string | null;
  completed_at: string | null;
  organization_id: string;
  created_at: string;
}

type StatusFilter = 'all' | 'pending' | 'in_progress' | 'completed';

const priorityConfig = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-amber-100 text-amber-700',
  urgent: 'bg-red-100 text-red-700',
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
};

export default function TasksView({ organizationId }: { organizationId: string | null }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium' as Task['priority'], due_date: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });
    setTasks(data || []);
    setLoading(false);
  }, [organizationId]);

  useEffect(() => {
    if (organizationId) void fetchTasks();
  }, [organizationId, fetchTasks]);

  async function createTask() {
    if (!form.title.trim() || !organizationId) return;
    setSubmitting(true);
    const { data } = await supabase
      .from('tasks')
      .insert({
        title: form.title.trim(),
        description: form.description.trim(),
        priority: form.priority,
        due_date: form.due_date || null,
        status: 'pending',
        organization_id: organizationId,
      })
      .select()
      .single();
    if (data) setTasks((prev) => [data, ...prev]);
    setForm({ title: '', description: '', priority: 'medium', due_date: '' });
    setShowModal(false);
    setSubmitting(false);
  }

  async function completeTask(id: string) {
    const now = new Date().toISOString();
    await supabase.from('tasks').update({ status: 'completed', completed_at: now }).eq('id', id);
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'completed' as const, completed_at: now } : t)));
  }

  const filtered = filter === 'all' ? tasks : tasks.filter((t) => t.status === filter);
  const tabs: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'completed', label: 'Completed' },
  ];

  if (!organizationId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-400">
        <ClipboardList className="w-12 h-12 mb-3" />
        <p>Select an organization to view tasks</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList className="w-6 h-6 text-teal-600" />
          <h2 className="text-xl font-semibold text-slate-800">Tasks</h2>
          <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded-full">
            {filtered.length}
          </span>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-xl hover:bg-teal-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> Create Task
        </button>
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
          <p className="font-medium">No tasks found</p>
          <p className="text-sm mt-1">Create a new task to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((task) => (
            <div
              key={task.id}
              className={`bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow ${
                task.status === 'completed' ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${priorityConfig[task.priority]}`}>
                      {task.priority}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <Clock className="w-3 h-3" /> {statusLabels[task.status]}
                    </span>
                  </div>
                  <h3 className={`font-semibold text-slate-800 ${task.status === 'completed' ? 'line-through' : ''}`}>
                    {task.title}
                  </h3>
                  {task.description && (
                    <p className="text-sm text-slate-500 mt-1 line-clamp-2">{task.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                    {task.due_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Due: {new Date(task.due_date).toLocaleDateString()}
                      </span>
                    )}
                    {task.assigned_to && <span>Assigned: {task.assigned_to}</span>}
                  </div>
                </div>
                {task.status !== 'completed' && (
                  <button
                    onClick={() => completeTask(task.id)}
                    className="ml-4 shrink-0 flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Complete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-slate-800">Create Task</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Task title"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Task description"
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value as Task['priority'] })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createTask}
                  disabled={!form.title.trim() || submitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Creating...' : 'Create Task'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
