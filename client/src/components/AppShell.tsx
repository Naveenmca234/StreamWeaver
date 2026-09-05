import { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { 
  Home, 
  Upload, 
  Database, 
  Layers, 
  Settings, 
  FileSearch, 
  Sparkles, 
  LogOut, 
  CheckCircle2, 
  Sun, 
  Moon, 
  Cloud, 
  Menu, 
  X, 
  ChevronRight, 
  Plus, 
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useDataset } from '../contexts/DatasetContext';

interface NavItem {
  label: string;
  path: string;
  icon: any;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'PIPELINE',
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: Home },
      { label: 'Upload Dataset', path: '/upload', icon: Upload },
      { label: 'Clean Data', path: '/cleaning', icon: FileSearch },
      { label: 'Mapping Studio', path: '/mapping', icon: Layers },
      { label: 'Validations', path: '/validations', icon: CheckCircle2 },
      { label: 'Preview & Export', path: '/preview', icon: Database },
      { label: 'Import History', path: '/history', icon: Database },
    ]
  },
  {
    title: 'SYSTEM',
    items: [
      { label: 'Settings', path: '/settings', icon: Settings }
    ]
  }
];

const getBreadcrumbTitle = (pathname: string): { section: string; page: string } => {
  switch (pathname) {
    case '/dashboard':
      return { section: 'Dashboard', page: 'Overview' };
    case '/upload':
      return { section: 'Workspace', page: 'Upload Dataset' };
    case '/cleaning':
      return { section: 'Data Quality', page: 'Clean Data' };
    case '/preview':
      return { section: 'Workspace', page: 'Preview Data' };
    case '/mapping':
      return { section: 'Workspace', page: 'Mapping Studio' };
    case '/validations':
    case '/validation':
      return { section: 'Data Quality', page: 'Validations' };
    case '/history':
      return { section: 'Data Quality', page: 'Import History' };
    case '/audit':
      return { section: 'System', page: 'Memory Audit' };
    case '/settings':
      return { section: 'System', page: 'Settings' };
    default:
      return { section: 'Workspace', page: 'ETL Pipeline' };
  }
};

const AppShell = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { activeUploadId, activeJob, allJobs, datasets, selectDataset } = useDataset();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = () => {
    logout();
    navigate('/auth', { replace: true });
  };

  const breadcrumbs = getBreadcrumbTitle(location.pathname);
  const userName = user?.name || 'Naveen';

  return (
    <div className="relative min-h-screen bg-theme-bg text-theme-text-primary flex">
      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Modern Enterprise Sidebar */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-theme-surface border-r border-theme-border flex flex-col justify-between transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full overflow-y-auto">
          {/* Brand Header */}
          <div className="p-5 border-b border-theme-border flex items-center justify-between">
            <Link to="/dashboard" className="flex items-center gap-3" onClick={() => setMobileOpen(false)}>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-sky-400 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
                <Sparkles size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold tracking-tight text-theme-text-primary flex items-center gap-1.5">
                  StreamWeaver
                </h1>
                <p className="text-[11px] font-semibold text-theme-primary uppercase tracking-wider">
                  ETL Workspace
                </p>
              </div>
            </Link>
            <button 
              onClick={() => setMobileOpen(false)} 
              className="lg:hidden p-1 text-theme-text-muted hover:text-theme-text-primary"
            >
              <X size={20} />
            </button>
          </div>

          {/* Active Dataset Pill in Sidebar */}
          {activeJob && (
            <div className="px-3 pt-3">
              <div className="p-2.5 rounded-xl bg-theme-surface-blue border border-theme-border-strong flex items-center gap-2">
                <FileSpreadsheet size={15} className="text-theme-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-theme-primary uppercase tracking-wider">Active Dataset</p>
                  <p className="text-xs font-semibold text-theme-text-primary truncate" title={activeJob.fileName}>
                    {activeJob.fileName}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Nav Categories */}
          <div className="px-3 py-4 space-y-6 flex-1">
            {navSections.map((section) => (
              <div key={section.title}>
                <p className="px-3 mb-2 text-[11px] font-bold text-theme-text-muted tracking-wider uppercase">
                  {section.title}
                </p>
                <nav className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const active = location.pathname === item.path || (item.path === '/validations' && location.pathname === '/validation');
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setMobileOpen(false)}
                        className={`group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                          active
                            ? 'bg-theme-surface-blue border border-theme-border-active text-theme-primary-text font-semibold shadow-xs'
                            : 'text-theme-text-secondary hover:bg-theme-surface-soft hover:text-theme-text-primary'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon
                            size={18}
                            className={`transition-colors ${
                              active ? 'text-theme-primary' : 'text-theme-text-muted group-hover:text-theme-primary'
                            }`}
                          />
                          <span>{item.label}</span>
                        </div>
                        {active && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
                        )}
                      </Link>
                    );
                  })}
                </nav>
              </div>
            ))}
          </div>

          {/* User Profile Card at Bottom */}
          <div className="p-3 border-t border-theme-border">
            <div className="saas-card p-3.5 bg-theme-surface-soft border border-theme-border rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-theme-surface-blue border border-theme-border-strong flex items-center justify-center text-theme-primary font-bold text-sm">
                  {userName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-theme-text-primary truncate">{userName}</p>
                  <p className="text-[11px] text-theme-text-muted truncate">Enterprise workspace</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-lg border border-theme-border bg-theme-surface hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-300/30 py-1.5 px-3 text-xs font-medium text-theme-text-secondary transition"
              >
                <LogOut size={14} />
                Sign out
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Layout Container */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Top Header */}
        <header className="sticky top-0 z-30 h-16 bg-theme-surface/95 backdrop-blur border-b border-theme-border px-4 sm:px-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="p-2 -ml-2 text-theme-text-muted hover:text-theme-text-primary lg:hidden rounded-lg hover:bg-theme-surface-soft flex-shrink-0"
              aria-label="Toggle menu"
            >
              <Menu size={20} />
            </button>

            {/* Breadcrumb Navigation */}
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="text-theme-text-muted font-medium">{breadcrumbs.section}</span>
              <ChevronRight size={14} className="text-theme-text-muted flex-shrink-0" />
              <span className="text-theme-text-primary font-semibold truncate">{breadcrumbs.page}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Global Dataset Selector */}
            {datasets.length > 0 && (
              <div className="hidden sm:flex items-center gap-1.5">
                <select
                  value={activeUploadId || ''}
                  onChange={(e) => void selectDataset(e.target.value || null)}
                  className="saas-input text-xs font-medium py-1.5 px-2.5 max-w-[240px] cursor-pointer"
                  title="Switch Active Dataset"
                >
                  {datasets.map((d) => (
                    <option key={d.uploadId} value={d.uploadId}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* System Status Pill */}
            <div className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-medium">
              <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" />
              <span>Operational</span>
            </div>

            {/* Theme Selector */}
            <div className="flex items-center p-0.5 rounded-xl border border-theme-border bg-theme-surface-soft">
              <button
                type="button"
                onClick={() => setTheme('light')}
                title="Light Theme"
                className={`p-1.5 rounded-lg text-xs font-medium transition ${
                  theme === 'light'
                    ? 'bg-theme-surface text-theme-primary shadow-xs'
                    : 'text-theme-text-muted hover:text-theme-text-primary'
                }`}
              >
                <Sun size={15} />
              </button>
              <button
                type="button"
                onClick={() => setTheme('sky')}
                title="Sky Blue Theme"
                className={`p-1.5 rounded-lg text-xs font-medium transition ${
                  theme === 'sky'
                    ? 'bg-theme-surface text-theme-primary shadow-xs'
                    : 'text-theme-text-muted hover:text-theme-text-primary'
                }`}
              >
                <Cloud size={15} />
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                title="Dark Theme"
                className={`p-1.5 rounded-lg text-xs font-medium transition ${
                  theme === 'dark'
                    ? 'bg-theme-surface text-theme-primary shadow-xs'
                    : 'text-theme-text-muted hover:text-theme-text-primary'
                }`}
              >
                <Moon size={15} />
              </button>
            </div>

            {/* Quick Action Button: New Import */}
            <Link
              to="/upload"
              className="btn-primary text-xs py-2 px-3.5 rounded-xl"
            >
              <Plus size={15} />
              <span className="hidden sm:inline">New Import</span>
            </Link>

            {/* User Pill */}
            <div className="hidden xl:flex items-center gap-2 pl-2 border-l border-theme-border">
              <div className="w-8 h-8 rounded-full bg-theme-surface-blue border border-theme-border-strong flex items-center justify-center text-theme-primary font-bold text-xs">
                {userName.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs font-bold text-theme-text-primary uppercase tracking-wide">
                {userName}
              </span>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1500px] w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppShell;
