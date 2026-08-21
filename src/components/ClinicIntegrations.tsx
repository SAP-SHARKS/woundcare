import { useEffect, useState } from 'react';
import { KeyRound, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Integration = { id?: string; provider: string; display_name: string; status: string; endpoint_url: string; credential_reference: string; config_notes: string };
const defaults: Integration[] = [
  { provider:'email', display_name:'Email delivery', status:'not_configured', endpoint_url:'', credential_reference:'Clinic-specific secret in Supabase Vault', config_notes:'' },
  { provider:'sms', display_name:'SMS / WhatsApp alerts', status:'not_configured', endpoint_url:'', credential_reference:'Clinic-specific secret in Supabase Vault', config_notes:'' },
  { provider:'ehr', display_name:'EHR / FHIR connection', status:'not_configured', endpoint_url:'', credential_reference:'Clinic-specific OAuth secret in Supabase Vault', config_notes:'' },
  { provider:'ai', display_name:'AI inference provider', status:'not_configured', endpoint_url:'', credential_reference:'Server environment or Supabase Vault secret', config_notes:'' },
];

export default function ClinicIntegrations({ organizationId }: { organizationId: string }) {
  const [items,setItems]=useState(defaults), [saving,setSaving]=useState(''), [message,setMessage]=useState(''), [error,setError]=useState('');
  useEffect(()=>{ void supabase.from('clinic_integrations').select('id,provider,display_name,status,endpoint_url,credential_reference,config_notes').eq('organization_id',organizationId).then(({data,error})=>{
    if(error){setError(error.message);return;} if(data?.length)setItems(defaults.map(base=>({...base,...data.find(row=>row.provider===base.provider)})));
  }); },[organizationId]);
  const update=(provider:string,key:keyof Integration,value:string)=>setItems(rows=>rows.map(row=>row.provider===provider?{...row,[key]:value}:row));
  async function save(item:Integration){
    setSaving(item.provider);setError('');setMessage('');
    const {data:{user}}=await supabase.auth.getUser();
    const {error:saveError}=await supabase.from('clinic_integrations').upsert({...item,organization_id:organizationId,updated_by:user?.id,updated_at:new Date().toISOString()},{onConflict:'organization_id,provider'});
    if(saveError)setError(saveError.message);else setMessage(`${item.display_name} settings saved.`);setSaving('');
  }
  return <div className="space-y-4">
    <div><h2 className="font-bold">Clinic integrations</h2><p className="text-xs text-stone-500 mt-1">Store connection metadata here. Secret API keys must remain in Vercel environment variables or Supabase Vault and are never displayed in the browser.</p></div>
    {error&&<p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">{error}</p>}{message&&<p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-3">{message}</p>}
    {items.map(item=><article key={item.provider} className="rounded-2xl border border-stone-200 p-4 space-y-3">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between"><div className="flex gap-2 items-center"><KeyRound size={17} className="text-[#1f6f6b]"/><h3 className="font-semibold">{item.display_name}</h3></div><select value={item.status} onChange={e=>update(item.provider,'status',e.target.value)} className="rounded-lg border px-3 py-2 text-sm"><option value="not_configured">Not configured</option><option value="testing">Testing</option><option value="connected">Connected</option><option value="disabled">Disabled</option></select></div>
      <label className="block text-xs font-semibold text-stone-600">Endpoint URL<input value={item.endpoint_url} onChange={e=>update(item.provider,'endpoint_url',e.target.value)} placeholder="https://api.provider.example" className="block mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm"/></label>
      <label className="block text-xs font-semibold text-stone-600">Credential location / secret name<input value={item.credential_reference} onChange={e=>update(item.provider,'credential_reference',e.target.value)} className="block mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm"/></label>
      <label className="block text-xs font-semibold text-stone-600">Configuration notes<textarea value={item.config_notes} onChange={e=>update(item.provider,'config_notes',e.target.value)} rows={2} className="block mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm"/></label>
      <button onClick={()=>void save(item)} disabled={saving===item.provider} className="wt-button"><Save size={14}/>{saving===item.provider?'Saving…':'Save integration'}</button>
    </article>)}
  </div>;
}
