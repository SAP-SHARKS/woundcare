import { useAuth } from './hooks/useAuth';
import AuthPage from './components/AuthPage';
import AppShell from './components/AppShell';

export default function App() {
  const auth = useAuth();

  if (auth.loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Loading WoundCare Platform...</p>
        </div>
      </div>
    );
  }

  if (!auth.user) {
    return <AuthPage />;
  }

  return <AppShell auth={auth} />;
}
