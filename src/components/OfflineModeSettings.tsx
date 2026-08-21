import { useEffect, useState } from 'react';
import { CloudOff, Database, LockKeyhole, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { loadOfflineSetting, offlineQueueCount, saveOfflineSetting } from '../lib/offline';

export default function OfflineModeSettings({ organizationId }: { organizationId: string | null }) {
  const [enabled, setEnabled] = useState(false), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const [remoteSaved, setRemoteSaved] = useState(true), [pending, setPending] = useState(0), [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    if (!organizationId) { setLoading(false); return; }
    void loadOfflineSetting(organizationId).then(setEnabled).finally(() => setLoading(false));
    const refresh = () => { setOnline(navigator.onLine); void offlineQueueCount(organizationId).then(setPending); };
    refresh(); window.addEventListener('online', refresh); window.addEventListener('offline', refresh); window.addEventListener('woundtrack:queue-changed', refresh);
    return () => { window.removeEventListener('online', refresh); window.removeEventListener('offline', refresh); window.removeEventListener('woundtrack:queue-changed', refresh); };
  }, [organizationId]);
  async function toggle() { if (!organizationId) return; setSaving(true); const next = !enabled; const result = await saveOfflineSetting(organizationId, next); setEnabled(next); setRemoteSaved(result.savedRemotely); setSaving(false); }
  if (!organizationId) return <div className="wt-screen"><div className="wt-notice">Choose a clinic before configuring offline mode.</div></div>;
  return <div className="wt-screen max-w-4xl"><div className="wt-page-head"><div><h1>Offline mode</h1><p>Clinic-scoped capture and assessment continuity for unreliable connections</p></div></div>
    <section className="bg-[#fffefc] border border-stone-200 rounded-xl p-5 mb-4"><div className="flex items-start justify-between gap-6"><div className="flex gap-3"><span className="w-10 h-10 rounded-lg bg-[#eef4f3] text-[#1f6f6b] flex items-center justify-center"><CloudOff size={20}/></span><div><h2 className="text-sm font-semibold">Allow offline check-ins for this clinic</h2><p className="text-xs text-stone-500 mt-1 max-w-xl">When enabled, assessments and photographs can be encrypted and held on this device until they can be synchronized. Other clinics remain online-only.</p></div></div><button disabled={loading||saving} onClick={toggle} role="switch" aria-checked={enabled} className={`w-11 h-6 rounded-full p-0.5 transition ${enabled?'bg-[#1f6f6b]':'bg-stone-300'}`}><span className={`block w-5 h-5 bg-white rounded-full shadow transition ${enabled?'translate-x-5':''}`}/></button></div>
      {!remoteSaved && <div className="mt-4 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2">Saved on this browser for testing. Apply the new Supabase migration to persist this setting for the whole clinic.</div>}
    </section>
    <div className="grid sm:grid-cols-3 gap-3"><article className="bg-[#fffefc] border border-stone-200 rounded-xl p-4"><div className="flex items-center gap-2 text-xs font-semibold">{online?<Wifi size={15} className="text-emerald-600"/>:<WifiOff size={15} className="text-red-600"/>} Connection</div><strong className="block text-xl mt-3">{online?'Online':'Offline'}</strong></article><article className="bg-[#fffefc] border border-stone-200 rounded-xl p-4"><div className="flex items-center gap-2 text-xs font-semibold"><RefreshCw size={15}/> Pending sync</div><strong className="block text-xl mt-3">{pending}</strong></article><article className="bg-[#fffefc] border border-stone-200 rounded-xl p-4"><div className="flex items-center gap-2 text-xs font-semibold"><LockKeyhole size={15}/> Device storage</div><strong className="block text-sm mt-3">AES-256-GCM</strong></article></div>
    <div className="mt-4 bg-[#fffefc] border border-stone-200 rounded-xl p-5"><h3 className="text-sm font-semibold flex items-center gap-2"><Database size={16}/> Current rollout</h3><ul className="text-xs text-stone-600 mt-3 space-y-2 list-disc pl-5"><li>App shell and static interface cached for offline reopening.</li><li>New assessments and photographs queued only when the clinic flag is enabled.</li><li>Cloud AI waits until the assessment reaches the server.</li><li>Automatic server synchronization is the next rollout stage and must be tested against the recovered Supabase project.</li></ul></div>
  </div>;
}
