import { useState } from 'react';
import { signOut, useAuth, type UserRole } from './hooks/useAuth';
import AuthPage from './components/AuthPage';
import PasswordRecovery from './components/PasswordRecovery';
import AppShell from './components/AppShell';

export default function App() {
  const auth = useAuth();
  const [bypassAuth, setBypassAuth] = useState<any>(null);

  const activeAuth = bypassAuth || auth;
  const isRecovery = window.location.search.includes('recovery=1') || window.location.hash.includes('type=recovery');

  const handleBypass = (role: UserRole) => {
    setBypassAuth({
      user: {
        id: 'bypass-user-id',
        email: `bypass-${role}@clinic.com`,
        user_metadata: { display_name: `Bypass ${role.replace('_', ' ').toUpperCase()}` },
        app_metadata: {},
        aud: 'authenticated',
        created_at: new Date().toISOString()
      },
      session: {
        access_token: 'bypass-token',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'bypass-refresh',
        user: { id: 'bypass-user-id' } as any
      },
      role,
      organizationId: '809fb0b8-4c4f-4d3a-b8cb-4f36bfb1b72a', // mock organization
      membership: { id: 'm1', organization_id: '809fb0b8-4c4f-4d3a-b8cb-4f36bfb1b72a', role, status: 'active' },
      loading: false,
      error: null
    });
  };

  if (isRecovery) return <PasswordRecovery />;
  if (activeAuth.loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Loading WoundCare Platform...</p>
        </div>
      </div>
    );
  }

  if (activeAuth.error) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center p-5"><div className="max-w-md bg-white border border-red-200 rounded-xl p-5"><h1 className="font-semibold text-red-800">Access could not be verified</h1><p className="text-sm text-slate-600 mt-2">{activeAuth.error}</p><button onClick={() => void signOut().then(() => location.reload())} className="wt-button mt-4">Return to sign in</button></div></div>;
  }
  if (!activeAuth.user) {
    return <AuthPage onBypass={handleBypass} allowBypass />;
  }

  return <AppShell auth={activeAuth} onExitPreview={() => setBypassAuth(null)} />;
}
