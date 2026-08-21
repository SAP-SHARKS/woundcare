import { useState } from 'react';
import { useAuth, type UserRole } from './hooks/useAuth';
import AuthPage from './components/AuthPage';
import AppShell from './components/AppShell';

export default function App() {
  const auth = useAuth();
  const [bypassAuth, setBypassAuth] = useState<any>(null);

  const activeAuth = bypassAuth || auth;

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
      loading: false
    });
  };

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

  if (!activeAuth.user) {
    return <AuthPage onBypass={handleBypass} />;
  }

  return <AppShell auth={activeAuth} onExitPreview={() => setBypassAuth(null)} />;
}
