import { useState, useRef, useEffect } from 'react';
import type { AuthState } from '../hooks/useAuth';
import { signOut } from '../hooks/useAuth';
import {
  LayoutDashboard, Users, Building2, UserCog,
  Activity, Bell, ClipboardList, LogOut, Menu, X,
  Search, Shield, ChevronRight
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import SuperAdminDashboard from './SuperAdminDashboard';
import OrganizationManager from './OrganizationManager';
import ClinicDashboard from './ClinicDashboard';
import PatientList from './PatientList';
import PatientDetail from './PatientDetail';
import StaffManager from './StaffManager';
import AlertsView from './AlertsView';
import TasksView from './TasksView';
import AuditLogView from './AuditLogView';

type Screen =
  | { name: 'dashboard' }
  | { name: 'organizations' }
  | { name: 'patients' }
  | { name: 'patient_detail'; patientId: string }
  | { name: 'staff' }
  | { name: 'alerts' }
  | { name: 'tasks' }
  | { name: 'audit_logs' }
  | { name: 'settings' };

interface PatientResult {
  id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  mrn: string;
  phone: string | null;
  email: string | null;
}

interface Props {
  auth: AuthState;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  clinic_admin: 'Clinic Admin',
  doctor: 'Doctor',
  wound_specialist: 'Wound Specialist',
  nurse: 'Nurse',
  patient: 'Patient',
  clinician: 'Clinician',
};

export default function AppShell({ auth }: Props) {
  const [screen, setScreen] = useState<Screen>({ name: 'dashboard' });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PatientResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const mobileSearchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const role = auth.role ?? 'patient';

  const navItems = getNavItems(role);

  // Debounced search effect
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      const pattern = `%${searchQuery}%`;
      const { data, error } = await supabase
        .from('patients')
        .select('id, full_name, first_name, last_name, mrn, phone, email')
        .or(
          `full_name.ilike.${pattern},mrn.ilike.${pattern},first_name.ilike.${pattern},last_name.ilike.${pattern},phone.ilike.${pattern},email.ilike.${pattern}`
        )
        .limit(6);

      if (!error && data) {
        setSearchResults(data);
        setShowDropdown(true);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node) &&
        mobileSearchContainerRef.current &&
        !mobileSearchContainerRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
        setMobileSearchOpen(false);
      } else if (
        !searchContainerRef.current &&
        mobileSearchContainerRef.current &&
        !mobileSearchContainerRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
        setMobileSearchOpen(false);
      } else if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node) &&
        !mobileSearchContainerRef.current
      ) {
        setShowDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setShowDropdown(false);
        setMobileSearchOpen(false);
        searchInputRef.current?.blur();
        mobileSearchInputRef.current?.blur();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus mobile search input when opened
  useEffect(() => {
    if (mobileSearchOpen) {
      setTimeout(() => mobileSearchInputRef.current?.focus(), 100);
    }
  }, [mobileSearchOpen]);

  function handleSelectPatient(patientId: string) {
    setScreen({ name: 'patient_detail', patientId });
    setShowDropdown(false);
    setSearchQuery('');
    setSearchResults([]);
    setMobileSearchOpen(false);
    setSidebarOpen(false);
  }

  function navigate(s: Screen) {
    setScreen(s);
    setSidebarOpen(false);
  }

  function renderSearchDropdown() {
    if (!showDropdown || searchResults.length === 0) return null;

    return (
      <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg border border-slate-200 shadow-lg overflow-hidden z-50">
        {searchResults.map((patient) => (
          <button
            key={patient.id}
            onClick={() => handleSelectPatient(patient.id)}
            className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 transition-colors text-left"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900 truncate">
                {patient.full_name || `${patient.first_name} ${patient.last_name}`}
              </p>
              <p className="text-xs text-slate-500 truncate">
                MRN: {patient.mrn}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0 ml-2" />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar - desktop */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-white border-r border-slate-200 fixed inset-y-0 z-30">
        <div className="px-5 py-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center">
              <Activity className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-slate-900">WoundCare</h1>
              <p className="text-[11px] text-slate-400">Clinical Platform</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(item => (
            <button
              key={item.screen.name}
              onClick={() => navigate(item.screen)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                screen.name === item.screen.name
                  ? 'bg-teal-50 text-teal-700 font-medium'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-100">
          <div className="px-3 py-2 mb-2">
            <p className="text-sm font-medium text-slate-900 truncate">
              {auth.user?.user_metadata?.display_name || auth.user?.email}
            </p>
            <p className="text-xs text-slate-400">{ROLE_LABELS[role] ?? role}</p>
          </div>
          <button
            onClick={() => signOut()}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all"
          >
            <LogOut className="w-[18px] h-[18px]" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl flex flex-col">
            <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center">
                  <Activity className="w-4.5 h-4.5 text-white" />
                </div>
                <h1 className="text-sm font-semibold text-slate-900">WoundCare</h1>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
              {navItems.map(item => (
                <button
                  key={item.screen.name}
                  onClick={() => navigate(item.screen)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                    screen.name === item.screen.name
                      ? 'bg-teal-50 text-teal-700 font-medium'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
                  {item.label}
                </button>
              ))}
            </nav>
            <div className="p-3 border-t border-slate-100">
              <button onClick={() => signOut()} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-500 hover:bg-red-50 hover:text-red-600">
                <LogOut className="w-[18px] h-[18px]" />
                Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 lg:ml-64">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200">
          <div className="px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-1.5 hover:bg-slate-100 rounded-lg">
                <Menu className="w-5 h-5 text-slate-600" />
              </button>
              <h2 className="text-sm font-semibold text-slate-900">
                {getScreenTitle(screen)}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {/* Desktop search */}
              <div ref={searchContainerRef} className="hidden sm:block relative">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200 focus-within:border-teal-400 focus-within:ring-1 focus-within:ring-teal-400 transition-all">
                  <Search className="w-4 h-4 text-slate-400" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => {
                      if (searchQuery.length >= 2 && searchResults.length > 0) {
                        setShowDropdown(true);
                      }
                    }}
                    placeholder="Search patients..."
                    className="bg-transparent text-sm text-slate-600 placeholder:text-slate-400 outline-none w-48"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setSearchResults([]);
                        setShowDropdown(false);
                      }}
                      className="p-0.5 hover:bg-slate-200 rounded"
                    >
                      <X className="w-3 h-3 text-slate-400" />
                    </button>
                  )}
                </div>
                {renderSearchDropdown()}
              </div>

              {/* Mobile search icon button */}
              <button
                onClick={() => setMobileSearchOpen(true)}
                className="sm:hidden p-1.5 hover:bg-slate-100 rounded-lg"
              >
                <Search className="w-5 h-5 text-slate-600" />
              </button>
            </div>
          </div>

          {/* Mobile expanded search bar */}
          {mobileSearchOpen && (
            <div
              ref={mobileSearchContainerRef}
              className="sm:hidden px-4 pb-3 relative"
            >
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 focus-within:border-teal-400 focus-within:ring-1 focus-within:ring-teal-400 transition-all">
                <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <input
                  ref={mobileSearchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => {
                    if (searchQuery.length >= 2 && searchResults.length > 0) {
                      setShowDropdown(true);
                    }
                  }}
                  placeholder="Search patients..."
                  className="bg-transparent text-sm text-slate-600 placeholder:text-slate-400 outline-none flex-1 min-w-0"
                />
                <button
                  onClick={() => {
                    setMobileSearchOpen(false);
                    setSearchQuery('');
                    setSearchResults([]);
                    setShowDropdown(false);
                  }}
                  className="p-0.5 hover:bg-slate-200 rounded"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>
              {renderSearchDropdown()}
            </div>
          )}
        </header>

        <div className="p-4 sm:p-6">
          {renderScreen(screen, auth, navigate)}
        </div>
      </main>
    </div>
  );
}

function getNavItems(role: string) {
  const items: { icon: typeof LayoutDashboard; label: string; screen: Screen }[] = [];

  items.push({ icon: LayoutDashboard, label: 'Dashboard', screen: { name: 'dashboard' } });

  if (role === 'super_admin') {
    items.push({ icon: Building2, label: 'Organizations', screen: { name: 'organizations' } });
  }

  if (['super_admin', 'clinic_admin', 'doctor', 'wound_specialist', 'nurse', 'clinician'].includes(role)) {
    items.push({ icon: Users, label: 'Patients', screen: { name: 'patients' } });
  }

  if (['super_admin', 'clinic_admin'].includes(role)) {
    items.push({ icon: UserCog, label: 'Staff', screen: { name: 'staff' } });
  }

  if (['super_admin', 'clinic_admin', 'doctor', 'wound_specialist', 'clinician'].includes(role)) {
    items.push({ icon: Bell, label: 'Alerts', screen: { name: 'alerts' } });
    items.push({ icon: ClipboardList, label: 'Tasks', screen: { name: 'tasks' } });
  }

  if (['super_admin', 'clinic_admin'].includes(role)) {
    items.push({ icon: Shield, label: 'Audit Log', screen: { name: 'audit_logs' } });
  }

  return items;
}

function getScreenTitle(screen: Screen): string {
  switch (screen.name) {
    case 'dashboard': return 'Dashboard';
    case 'organizations': return 'Organizations';
    case 'patients': return 'Patients';
    case 'patient_detail': return 'Patient';
    case 'staff': return 'Staff Management';
    case 'alerts': return 'Alerts';
    case 'tasks': return 'Tasks';
    case 'audit_logs': return 'Audit Log';
    case 'settings': return 'Settings';
    default: return '';
  }
}

function renderScreen(
  screen: Screen,
  auth: AuthState,
  navigate: (s: Screen) => void
) {
  const orgId = auth.organizationId;

  switch (screen.name) {
    case 'dashboard':
      if (auth.role === 'super_admin') {
        return <SuperAdminDashboard onNavigate={navigate} />;
      }
      return <ClinicDashboard organizationId={orgId} onNavigate={navigate} />;
    case 'organizations':
      return <OrganizationManager />;
    case 'patients':
      return <PatientList organizationId={orgId} onSelectPatient={(id) => navigate({ name: 'patient_detail', patientId: id })} />;
    case 'patient_detail':
      return <PatientDetail patientId={screen.patientId} organizationId={orgId} onBack={() => navigate({ name: 'patients' })} />;
    case 'staff':
      return <StaffManager organizationId={orgId} />;
    case 'alerts':
      return <AlertsView organizationId={orgId} />;
    case 'tasks':
      return <TasksView organizationId={orgId} />;
    case 'audit_logs':
      return <AuditLogView organizationId={orgId} />;
    default:
      return <div className="text-slate-500">Coming soon...</div>;
  }
}