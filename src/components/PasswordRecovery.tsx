import { useState } from 'react';
import { Activity, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function PasswordRecovery() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(''); setMessage('');
    if (password.length < 8) return setError('Use at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (updateError) return setError(updateError.message);
    setMessage('Password updated. You can now continue to WoundTrack.');
    window.history.replaceState({}, '', '/');
  }

  return <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
    <form onSubmit={submit} className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl p-7 space-y-4">
      <div className="w-12 h-12 rounded-xl bg-teal-600 text-white flex items-center justify-center"><Activity /></div>
      <div><h1 className="text-2xl font-bold text-slate-900">Choose a new password</h1><p className="text-sm text-slate-500 mt-1">This changes the password for your WoundTrack account.</p></div>
      {[['New password', password, setPassword], ['Confirm password', confirm, setConfirm]].map(([label, value, setter]) =>
        <label key={label as string} className="block text-sm font-medium text-slate-700">{label as string}
          <span className="relative block mt-1.5"><Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400"/><input type="password" value={value as string} onChange={e => (setter as (v:string)=>void)(e.target.value)} required minLength={8} className="w-full pl-10 pr-3 py-2.5 border rounded-xl"/></span>
        </label>)}
      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}
      {message && <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-3">{message}</p>}
      <button disabled={saving || Boolean(message)} className="w-full bg-teal-600 text-white font-semibold rounded-xl py-3 disabled:opacity-50">{saving ? 'Saving…' : 'Update password'}</button>
      {message && <a href="/" className="block text-center text-sm font-semibold text-teal-700">Continue to app</a>}
    </form>
  </main>;
}
