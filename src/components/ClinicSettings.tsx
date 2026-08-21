import { useEffect, useState } from 'react';
import { Building2, Image, Plug, Save, Shield, Sliders, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';
import ClinicIntegrations from './ClinicIntegrations';

interface Props { organizationId: string | null; onOrganizationUpdated?: () => void }

const emptyOrganization = { name: '', legal_name: '', slug: '', phone: '', email: '', support_email: '', website: '', address: '', city: '', region: '', country: '', logo_url: '', primary_color: '#1f6f6b', secondary_color: '#eef4f3' };
const emptySettings = { timezone: 'UTC', default_language: 'English', date_format: 'MM/DD/YYYY', measurement_system: 'metric', sender_name: '', reply_to_email: '', clinical_alert_email: '', administrative_email: '', require_mfa: false, session_timeout_minutes: 480, allow_patient_home_checkin: true, require_photo_consent: true, require_calibration_marker: false };

export default function ClinicSettings({ organizationId, onOrganizationUpdated }: Props) {
  const [organization, setOrganization] = useState(emptyOrganization);
  const [settings, setSettings] = useState(emptySettings);
  const [tab, setTab] = useState<'identity'|'communications'|'security'|'clinical'|'integrations'>('identity');
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');

  async function load() {
    if (!organizationId) { setLoading(false); return; }
    setLoading(true); setError('');
    const [orgResult, settingsResult] = await Promise.all([
      supabase.from('organizations').select('name,legal_name,slug,phone,email,support_email,website,address,city,region,country,logo_url,primary_color,secondary_color').eq('id', organizationId).single(),
      supabase.from('clinic_settings').select('*').eq('organization_id', organizationId).maybeSingle(),
    ]);
    if (orgResult.error) setError(orgResult.error.message); else setOrganization({ ...emptyOrganization, ...orgResult.data });
    if (settingsResult.error) setError(settingsResult.error.message); else if (settingsResult.data) setSettings({ ...emptySettings, ...settingsResult.data });
    setLoading(false);
  }
  useEffect(() => { void load(); }, [organizationId]);

  function setOrg(key: keyof typeof organization, value: string) { setOrganization(current => ({ ...current, [key]: value })); }
  function setSetting<K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) { setSettings(current => ({ ...current, [key]: value })); }

  async function uploadLogo(file?: File) {
    if (!file || !organizationId) return;
    if (file.size > 2 * 1024 * 1024) return setError('Logo must be smaller than 2 MB.');
    setSaving(true); setError('');
    const extension = file.name.split('.').pop()?.toLowerCase() || 'png';
    const path = `${organizationId}/logo-${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from('clinic-branding').upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) { setError(uploadError.message); setSaving(false); return; }
    const { data } = supabase.storage.from('clinic-branding').getPublicUrl(path);
    setOrg('logo_url', data.publicUrl); setSaving(false);
  }

  async function save() {
    if (!organizationId) return;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(organization.slug)) return setError('Clinic URL slug may contain lowercase letters, numbers, and single hyphens only.');
    setSaving(true); setError(''); setMessage('');
    const { error: orgError } = await supabase.from('organizations').update({ ...organization, updated_at: new Date().toISOString() }).eq('id', organizationId);
    if (orgError) { setError(orgError.message); setSaving(false); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { error: settingsError } = await supabase.from('clinic_settings').upsert({ ...settings, organization_id: organizationId, updated_by: user?.id, updated_at: new Date().toISOString() });
    if (settingsError) setError(settingsError.message); else { setMessage('Clinic settings saved.'); onOrganizationUpdated?.(); }
    setSaving(false);
  }

  if (!organizationId) return <div className="wt-notice">Select a clinic before opening clinic settings.</div>;
  if (loading) return <div className="py-20 text-center text-sm text-stone-500">Loading clinic settings…</div>;
  const input = 'w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm';
  const tabs = [{id:'identity',label:'Profile & branding',icon:Building2},{id:'communications',label:'Email & alerts',icon:Image},{id:'security',label:'Security',icon:Shield},{id:'clinical',label:'Clinical defaults',icon:Sliders},{id:'integrations',label:'Integrations',icon:Plug}] as const;
  return <div className="space-y-5">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><h1 className="text-2xl font-bold text-stone-900">Clinic administration</h1><p className="text-sm text-stone-500 mt-1">Identity, communications, security and clinical defaults for this clinic.</p></div><button onClick={() => void save()} disabled={saving} className="wt-button primary"><Save size={15}/>{saving?'Saving…':'Save settings'}</button></div>
    {error&&<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}{message&&<div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}
    <div className="grid lg:grid-cols-[220px_1fr] gap-5"><nav className="bg-white border rounded-2xl p-2 h-fit">{tabs.map(item=><button key={item.id} onClick={()=>setTab(item.id)} className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm ${tab===item.id?'bg-[#eef4f3] text-[#1f6f6b] font-semibold':'text-stone-600 hover:bg-stone-50'}`}><item.icon size={16}/>{item.label}</button>)}</nav>
    <section className="bg-white border border-stone-200 rounded-2xl p-5 sm:p-6 space-y-5">
      {tab==='identity'&&<><h2 className="font-bold">Profile and branding</h2><div className="flex flex-col sm:flex-row gap-4 items-start"><div className="w-24 h-24 rounded-2xl border bg-stone-50 grid place-items-center overflow-hidden">{organization.logo_url?<img src={organization.logo_url} alt="Clinic logo" className="w-full h-full object-contain"/>:<Building2 className="text-stone-300"/>}</div><label className="wt-button cursor-pointer"><Upload size={15}/>Upload logo<input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={e=>void uploadLogo(e.target.files?.[0])}/></label></div><div className="grid sm:grid-cols-2 gap-4"><Field label="Clinic name"><input className={input} value={organization.name} onChange={e=>setOrg('name',e.target.value)}/></Field><Field label="Legal name"><input className={input} value={organization.legal_name} onChange={e=>setOrg('legal_name',e.target.value)}/></Field><Field label="Clinic URL"><div className="flex rounded-xl border overflow-hidden"><span className="px-3 py-2.5 bg-stone-50 text-xs text-stone-500">woundheal.ai/c/</span><input className="min-w-0 flex-1 px-3 text-sm" value={organization.slug} onChange={e=>setOrg('slug',e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,''))}/></div></Field><Field label="Website"><input className={input} value={organization.website} onChange={e=>setOrg('website',e.target.value)}/></Field><Field label="Main email"><input type="email" className={input} value={organization.email} onChange={e=>setOrg('email',e.target.value)}/></Field><Field label="Support email"><input type="email" className={input} value={organization.support_email} onChange={e=>setOrg('support_email',e.target.value)}/></Field><Field label="Phone"><input className={input} value={organization.phone} onChange={e=>setOrg('phone',e.target.value)}/></Field><Field label="Country"><input className={input} value={organization.country} onChange={e=>setOrg('country',e.target.value)}/></Field><Field label="Address"><input className={input} value={organization.address} onChange={e=>setOrg('address',e.target.value)}/></Field><Field label="City"><input className={input} value={organization.city} onChange={e=>setOrg('city',e.target.value)}/></Field><Field label="Primary color"><input type="color" className="h-11 w-full rounded-xl border p-1" value={organization.primary_color} onChange={e=>setOrg('primary_color',e.target.value)}/></Field><Field label="Secondary color"><input type="color" className="h-11 w-full rounded-xl border p-1" value={organization.secondary_color} onChange={e=>setOrg('secondary_color',e.target.value)}/></Field></div></>}
      {tab==='communications'&&<><h2 className="font-bold">Email and alert destinations</h2><p className="text-xs text-stone-500">These settings control clinic-branded application messages. Authentication email infrastructure remains platform-managed.</p><div className="grid sm:grid-cols-2 gap-4"><Field label="Sender name"><input className={input} value={settings.sender_name} onChange={e=>setSetting('sender_name',e.target.value)}/></Field><Field label="Reply-to email"><input type="email" className={input} value={settings.reply_to_email} onChange={e=>setSetting('reply_to_email',e.target.value)}/></Field><Field label="Clinical alerts email"><input type="email" className={input} value={settings.clinical_alert_email} onChange={e=>setSetting('clinical_alert_email',e.target.value)}/></Field><Field label="Administrative email"><input type="email" className={input} value={settings.administrative_email} onChange={e=>setSetting('administrative_email',e.target.value)}/></Field></div></>}
      {tab==='security'&&<><h2 className="font-bold">Clinic security policy</h2><Toggle label="Require multi-factor authentication" checked={settings.require_mfa} onChange={value=>setSetting('require_mfa',value)}/><Field label="Session inactivity timeout (minutes)"><input type="number" min="15" max="43200" className={input} value={settings.session_timeout_minutes} onChange={e=>setSetting('session_timeout_minutes',Number(e.target.value))}/></Field><p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">The saved policy is ready for enforcement. Platform-level Supabase session settings must also be configured before this becomes a hard authentication timeout.</p></>}
      {tab==='clinical'&&<><h2 className="font-bold">Clinical and regional defaults</h2><div className="grid sm:grid-cols-2 gap-4"><Field label="Timezone"><input className={input} value={settings.timezone} onChange={e=>setSetting('timezone',e.target.value)}/></Field><Field label="Default language"><select className={input} value={settings.default_language} onChange={e=>setSetting('default_language',e.target.value)}><option>English</option><option>Arabic</option></select></Field><Field label="Date format"><select className={input} value={settings.date_format} onChange={e=>setSetting('date_format',e.target.value)}><option>MM/DD/YYYY</option><option>DD/MM/YYYY</option><option>YYYY-MM-DD</option></select></Field><Field label="Measurement system"><select className={input} value={settings.measurement_system} onChange={e=>setSetting('measurement_system',e.target.value)}><option value="metric">Metric</option><option value="imperial">Imperial</option></select></Field></div><Toggle label="Allow patient home check-in" checked={settings.allow_patient_home_checkin} onChange={value=>setSetting('allow_patient_home_checkin',value)}/><Toggle label="Require photography consent" checked={settings.require_photo_consent} onChange={value=>setSetting('require_photo_consent',value)}/><Toggle label="Require calibration marker for measurements" checked={settings.require_calibration_marker} onChange={value=>setSetting('require_calibration_marker',value)}/></>}
      {tab==='integrations'&&<ClinicIntegrations organizationId={organizationId}/>}
    </section></div>
  </div>;
}

function Field({label,children}:{label:string;children:React.ReactNode}) { return <label><span className="block text-xs font-semibold text-stone-600 mb-1.5">{label}</span>{children}</label> }
function Toggle({label,checked,onChange}:{label:string;checked:boolean;onChange:(value:boolean)=>void}) { return <label className="flex items-center justify-between gap-4 rounded-xl border p-4"><span className="text-sm font-medium">{label}</span><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)} className="w-5 h-5 accent-[#1f6f6b]"/></label> }
