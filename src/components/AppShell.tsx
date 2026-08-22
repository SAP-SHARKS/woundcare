import { useState, useRef, useEffect } from 'react';
import type { AuthState } from '../hooks/useAuth';
import { signOut } from '../hooks/useAuth';
import {
  LayoutDashboard, Users, Building2, UserCog,
  Activity, Bell, ClipboardList, LogOut, Menu, X,
  Search, Shield, ChevronRight, FileText, Sliders, Layers, Heart, FolderOpen, CloudOff, FlaskConical
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
import CommandCenter from './CommandCenter';
import ReportsView from './ReportsView';
import RuleManager from './RuleManager';
import ReferenceDataConfig from './ReferenceDataConfig';
import PatientHomeCheckIn from './PatientHomeCheckIn';
import AIAnalysisReview from './AIAnalysisReview';
import DocumentLibrary from './DocumentLibrary';
import OfflineModeSettings from './OfflineModeSettings';
import PreviewDataScreen from './PreviewDataScreen';
import InstallAppButton from './InstallAppButton';
import { clearOfflineKeyMaterial } from '../lib/offline';
import ModelLab from './ModelLab';
import ClinicSettings from './ClinicSettings';

type Screen =
  | { name: 'dashboard' }
  | { name: 'organizations' }
  | { name: 'patients' }
  | { name: 'patient_detail'; patientId: string }
  | { name: 'staff' }
  | { name: 'alerts' }
  | { name: 'tasks' }
  | { name: 'audit_logs' }
  | { name: 'settings' }
  | { name: 'documents' }
  | { name: 'command_center' }
  | { name: 'reports' }
  | { name: 'rules' }
  | { name: 'reference_data' }
  | { name: 'offline_settings' }
  | { name: 'model_lab' }
  | { name: 'home_checkin' }
  | { name: 'ai_review'; assessmentId: string; patientId: string };

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
  onExitPreview: () => void;
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

export default function AppShell({ auth, onExitPreview }: Props) {
  const role = auth.role ?? 'patient';
  const [screen, setScreen] = useState<Screen>(() => screenFromPath(window.location.pathname, role));
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PatientResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [clinicIdentity, setClinicIdentity] = useState({ name: 'Wound Clinic', slug: '', logo_url: '' });
  const [clinicIdentityVersion, setClinicIdentityVersion] = useState(0);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const mobileSearchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const navItems = getNavItems(role);

  useEffect(() => {
    if (!auth.organizationId) return;
    void supabase.from('organizations').select('name,slug,logo_url').eq('id', auth.organizationId).maybeSingle().then(({ data }) => {
      if (data) setClinicIdentity({ name: data.name || 'Wound Clinic', slug: data.slug || '', logo_url: data.logo_url || '' });
    });
  }, [auth.organizationId, clinicIdentityVersion]);

  useEffect(() => {
    const syncFromUrl = () => setScreen(screenFromPath(window.location.pathname, role));
    window.addEventListener('popstate', syncFromUrl);
    const canonicalPath = pathForScreen(screenFromPath(window.location.pathname, role), role, clinicIdentity.slug);
    if (window.location.pathname !== canonicalPath) window.history.replaceState({}, '', canonicalPath);
    return () => window.removeEventListener('popstate', syncFromUrl);
  }, [role, clinicIdentity.slug]);

  async function handleSignOut() {
    clearOfflineKeyMaterial();
    if (auth.user?.id === 'bypass-user-id') {
      onExitPreview();
      return;
    }
    await signOut();
  }

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
    navigate({ name: 'patient_detail', patientId });
    setShowDropdown(false);
    setSearchQuery('');
    setSearchResults([]);
    setMobileSearchOpen(false);
    setSidebarOpen(false);
  }

  function navigate(s: Screen) {
    setScreen(s);
    const nextPath = pathForScreen(s, role, clinicIdentity.slug);
    if (window.location.pathname !== nextPath) window.history.pushState({}, '', nextPath);
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
    <div className="min-h-screen bg-[#f7f5f2] flex">
      {/* Sidebar - desktop */}
      <aside className="hidden lg:flex lg:flex-col lg:w-[238px] bg-[#fffefc] border-r border-stone-200 fixed inset-y-0 z-30">
        <div className="px-5 py-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center overflow-hidden">{clinicIdentity.logo_url?<img src={clinicIdentity.logo_url} alt="" className="w-full h-full object-contain bg-white"/>:<Activity className="w-4.5 h-4.5 text-white" />}</div>
            <div>
              <h1 className="text-[14.5px] font-bold text-stone-900 tracking-[-.2px]">WoundTrack</h1>
              <p className="text-[10px] font-medium text-stone-400 truncate max-w-[155px]">{clinicIdentity.name}</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-[10px] py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(item => (
            <button
              key={item.screen.name}
              onClick={() => navigate(item.screen)}
              className={`w-full flex items-center gap-3 px-3 h-[34px] rounded-[9px] text-[12.5px] transition-all ${
                screen.name === item.screen.name
                  ? 'bg-[#eef4f3] text-[#1f6f6b] font-semibold'
                  : 'text-stone-600 hover:bg-[#faf8f5] hover:text-stone-900'
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
            onClick={() => void handleSignOut()}
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
              <button onClick={() => void handleSignOut()} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-500 hover:bg-red-50 hover:text-red-600">
                <LogOut className="w-[18px] h-[18px]" />
                Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 lg:ml-[238px]">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-[#fffefc] border-b border-stone-200">
          <div className="px-4 sm:px-6 h-[58px] flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-1.5 hover:bg-slate-100 rounded-lg">
                <Menu className="w-5 h-5 text-slate-600" />
              </button>
              <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 min-w-0 text-sm">
                <button onClick={() => navigate({ name: 'dashboard' })} className="hidden sm:inline text-slate-500 hover:text-teal-700">
                  {ROLE_LABELS[role] ?? role}
                </button>
                <ChevronRight className="hidden sm:block w-3.5 h-3.5 text-slate-300" />
                {screen.name === 'patient_detail' && <><button onClick={() => navigate({ name: 'patients' })} className="text-slate-500 hover:text-teal-700">Patients</button><ChevronRight className="w-3.5 h-3.5 text-slate-300" /></>}
                <span className="font-semibold text-slate-900 truncate">{getScreenTitle(screen)}</span>
              </nav>
            </div>
            <div className="flex items-center gap-2">
              <InstallAppButton />
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

        <div className="p-4 sm:p-7 pb-11">
          {renderScreen(screen, auth, navigate, () => setClinicIdentityVersion((version) => version + 1))}
        </div>
      </main>
    </div>
  );
}

const SCREEN_SLUGS: Record<Exclude<Screen['name'], 'patient_detail' | 'ai_review'>, string> = {
  dashboard: 'dashboard', organizations: 'organizations', patients: 'patients', staff: 'staff',
  alerts: 'alerts', tasks: 'tasks', audit_logs: 'audit-log', settings: 'settings',
  documents: 'documents', command_center: 'triage', reports: 'reports', rules: 'rules',
  reference_data: 'reference-data', offline_settings: 'offline', home_checkin: 'home-check-in',
  model_lab: 'model-lab',
};

function roleSlug(role: string): string {
  return role.replace(/_/g, '-');
}

function pathForScreen(screen: Screen, role: string, clinicSlug = ''): string {
  const base = role === 'super_admin' ? '/super-admin' : clinicSlug ? `/c/${encodeURIComponent(clinicSlug)}` : `/${roleSlug(role)}`;
  if (screen.name === 'patient_detail') return `${base}/patients/${encodeURIComponent(screen.patientId)}`;
  if (screen.name === 'ai_review') return `${base}/ai-review/${encodeURIComponent(screen.assessmentId)}/${encodeURIComponent(screen.patientId)}`;
  return `${base}/${SCREEN_SLUGS[screen.name]}`;
}

function screenFromPath(pathname: string, role: string): Screen {
  const segments = pathname.split('/').filter(Boolean).map(segment => decodeURIComponent(segment));
  const offset = segments[0] === 'c' && segments[1] ? 2 : 1;
  const validRoot = offset === 2 || segments[0] === roleSlug(role);
  if (!validRoot) return { name: role === 'patient' ? 'home_checkin' : 'dashboard' };
  if (segments[offset] === 'patients' && segments[offset + 1]) return { name: 'patient_detail', patientId: segments[offset + 1] };
  if (segments[offset] === 'ai-review' && segments[offset + 1] && segments[offset + 2]) {
    return { name: 'ai_review', assessmentId: segments[offset + 1], patientId: segments[offset + 2] };
  }
  const match = Object.entries(SCREEN_SLUGS).find(([, slug]) => slug === segments[offset]);
  return match ? { name: match[0] } as Screen : { name: role === 'patient' ? 'home_checkin' : 'dashboard' };
}

function getNavItems(role: string) {
  const items: { icon: typeof LayoutDashboard; label: string; screen: Screen }[] = [];

  items.push({ icon: LayoutDashboard, label: 'Dashboard', screen: { name: 'dashboard' } });

  if (['super_admin', 'clinic_admin', 'doctor', 'wound_specialist', 'nurse', 'clinician'].includes(role)) {
    items.push({ icon: Activity, label: 'Triage Command Center', screen: { name: 'command_center' } });
  }

  if (role === 'super_admin') {
    items.push({ icon: Building2, label: 'Organizations', screen: { name: 'organizations' } });
    items.push({ icon: FlaskConical, label: 'Model Lab', screen: { name: 'model_lab' } });
  }

  if (['super_admin', 'clinic_admin', 'doctor', 'wound_specialist', 'nurse', 'clinician'].includes(role)) {
    items.push({ icon: Users, label: 'Patients', screen: { name: 'patients' } });
    items.push({ icon: FolderOpen, label: 'Document Library', screen: { name: 'documents' } });
  }

  if (['super_admin', 'clinic_admin', 'doctor', 'wound_specialist', 'clinician'].includes(role)) {
    items.push({ icon: FileText, label: 'Outcome Reports', screen: { name: 'reports' } });
  }

  if (['super_admin', 'clinic_admin'].includes(role)) {
    items.push({ icon: Building2, label: 'Clinic Settings', screen: { name: 'settings' } });
    items.push({ icon: UserCog, label: 'Staff', screen: { name: 'staff' } });
    items.push({ icon: Sliders, label: 'Triage Rules', screen: { name: 'rules' } });
    items.push({ icon: Layers, label: 'Reference Data', screen: { name: 'reference_data' } });
    items.push({ icon: CloudOff, label: 'Offline Mode', screen: { name: 'offline_settings' } });
  }

  if (['super_admin', 'clinic_admin', 'doctor', 'wound_specialist', 'clinician'].includes(role)) {
    items.push({ icon: Bell, label: 'Alerts', screen: { name: 'alerts' } });
    items.push({ icon: ClipboardList, label: 'Tasks', screen: { name: 'tasks' } });
  }

  if (['super_admin', 'clinic_admin'].includes(role)) {
    items.push({ icon: Shield, label: 'Audit Log', screen: { name: 'audit_logs' } });
  }

  items.push({ icon: Heart, label: 'Remote Home Check-in', screen: { name: 'home_checkin' } });

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
    case 'command_center': return 'Triage Command Center';
    case 'reports': return 'Outcome Reports';
    case 'rules': return 'Triage Rules Config';
    case 'reference_data': return 'Reference Data Config';
    case 'offline_settings': return 'Offline Mode';
    case 'model_lab': return 'Wound AI Model Lab';
    case 'home_checkin': return 'Remote Home Check-in';
    case 'documents': return 'Document Library';
    case 'ai_review': return 'AI Analysis Review';
    default: return '';
  }
}

function renderScreen(
  screen: Screen,
  auth: AuthState,
  navigate: (s: Screen) => void,
  refreshClinicIdentity: () => void
) {
  const orgId = auth.organizationId;
  const previewScreens = ['dashboard', 'organizations', 'staff', 'alerts', 'tasks', 'audit_logs'] as const;
  if (auth.user?.id === 'bypass-user-id' && screen.name === 'documents') {
    return <DocumentLibrary organizationId={null} previewMode />;
  }
  if (auth.user?.id === 'bypass-user-id' && previewScreens.some(name => name === screen.name)) {
    return <PreviewDataScreen screen={screen.name as (typeof previewScreens)[number]} onNavigate={navigate} />;
  }

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
    case 'settings':
      return <ClinicSettings organizationId={orgId} onOrganizationUpdated={refreshClinicIdentity} />;
    case 'command_center':
      return (
        <CommandCenter
          organizationId={orgId}
          onSelectPatient={(id) => navigate({ name: 'patient_detail', patientId: id })}
          onNavigateToReview={(assessmentId, patientId) =>
            navigate({ name: 'ai_review', assessmentId, patientId })
          }
        />
      );
    case 'reports':
      return <ReportsView organizationId={orgId} />;
    case 'rules':
      return <RuleManager />;
    case 'reference_data':
      return <ReferenceDataConfig />;
    case 'offline_settings':
      return <OfflineModeSettings organizationId={orgId} />;
    case 'model_lab':
      return <ModelLab />;
    case 'home_checkin':
      return <PatientHomeCheckIn />;
    case 'documents':
      return <DocumentLibrary organizationId={orgId} />;
    case 'ai_review':
      return (
        <AIReviewLoader
          patientId={screen.patientId}
          assessmentId={screen.assessmentId}
          onClose={() => navigate({ name: 'command_center' })}
        />
      );
    default:
      return <div className="text-slate-500">Coming soon...</div>;
  }
}

function AIReviewLoader({
  patientId,
  assessmentId,
  onClose
}: {
  patientId: string;
  assessmentId: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [patient, setPatient] = useState<any>(null);
  const [assessment, setAssessment] = useState<any>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);

        // Fetch patient
        const { data: pData, error: pErr } = await supabase
          .from('patients')
          .select('*')
          .eq('id', patientId)
          .single();
        if (pErr) throw pErr;

        // Fetch assessment
        const { data: aData, error: aErr } = await supabase
          .from('wound_assessments')
          .select('*')
          .eq('id', assessmentId)
          .single();
        if (aErr) throw aErr;

        setPatient(pData);
        setAssessment(aData);
      } catch (err: any) {
        // Fallback for mocked/sample data items in CommandCenter
        if (patientId.startsWith('sample-') || patientId.startsWith('mock-')) {
          setPatient({
            id: patientId,
            full_name: patientId === 'sample-p1' ? 'Mohammed Al-Hassan' : 'Fatimah Al-Harbi',
            mrn: patientId === 'sample-p1' ? '728382' : '529381'
          });
          setAssessment({
            id: assessmentId,
            assessment_date: new Date().toISOString(),
            length_cm: 2.6,
            width_cm: 1.9,
            depth_cm: 0.4,
            area_cm2: 5.0,
            granulation_pct: 64,
            slough_pct: 28,
            eschar_pct: 8,
            epithelial_pct: 0,
            pain_score: 3,
            status: 'draft'
          });
        } else {
          setError(err.message || 'Failed to load details');
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [patientId, assessmentId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-100 bg-slate-900 fixed inset-0 z-50">
        <div className="w-8 h-8 border-3 border-teal-500/30 border-t-teal-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !patient || !assessment) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-100 bg-slate-900 fixed inset-0 z-50 space-y-4">
        <p className="text-sm font-semibold text-slate-400">{error || 'Data could not be found'}</p>
        <button onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg">
          Back
        </button>
      </div>
    );
  }

  return (
    <AIAnalysisReview
      patient={patient}
      assessment={assessment}
      onClose={onClose}
      onApprove={async (notes) => {
        const { error: updErr } = await supabase
          .from('wound_assessments')
          .update({
            status: 'approved',
            clinical_notes: notes ? notes : assessment.clinical_notes
          })
          .eq('id', assessmentId);
        
        if (updErr) {
          alert(`Error saving sign-off: ${updErr.message}`);
        } else {
          alert('AI findings successfully approved and signed off to EHR!');
          onClose();
        }
      }}
      onReject={async () => {
        const { error: updErr } = await supabase
          .from('wound_assessments')
          .update({ status: 'rejected' })
          .eq('id', assessmentId);
        
        if (updErr) {
          alert(`Error rejecting: ${updErr.message}`);
        } else {
          alert('AI findings rejected.');
          onClose();
        }
      }}
      onFlag={async () => {
        const { error: updErr } = await supabase
          .from('wound_assessments')
          .update({ status: 'review_required' })
          .eq('id', assessmentId);
        
        if (updErr) {
          alert(`Error forwarding: ${updErr.message}`);
        } else {
          alert('Wound forwarded to wound care specialist.');
          onClose();
        }
      }}
    />
  );
}
