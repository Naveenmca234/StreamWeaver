import { useState } from 'react';
import { 
  Settings, 
  Sparkles, 
  Sun, 
  Moon, 
  Cloud, 
  Database, 
  CheckCircle2, 
  Cpu, 
  HardDrive, 
  Sliders,
  ShieldCheck
} from 'lucide-react';
import { useTheme, type Theme } from '../contexts/ThemeContext';

const SettingsPage = () => {
  const { theme, setTheme } = useTheme();
  const [animationsEnabled, setAnimationsEnabled] = useState(true);
  const [streamingMode, setStreamingMode] = useState(true);

  const themeOptions: { id: Theme; title: string; desc: string; icon: any; previewBg: string; previewCard: string }[] = [
    {
      id: 'light',
      title: 'Light (Default)',
      desc: 'Clean white workspace with sky-blue accents and navy text.',
      icon: Sun,
      previewBg: 'bg-[#F7FBFD] border-[#DCEBF1]',
      previewCard: 'bg-white border-[#DCEBF1]'
    },
    {
      id: 'sky',
      title: 'Sky Blue',
      desc: 'Refined light cyan tint inspired by modern data platforms.',
      icon: Cloud,
      previewBg: 'bg-[#F0FAFD] border-[#BFE7F2]',
      previewCard: 'bg-white border-[#BFE7F2]'
    },
    {
      id: 'dark',
      title: 'Dark Mode',
      desc: 'Polished slate dark theme for low-light environments.',
      icon: Moon,
      previewBg: 'bg-[#020617] border-[#1E293B]',
      previewCard: 'bg-[#0F172A] border-[#1E293B]'
    }
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header Banner */}
      <div className="saas-card p-6 sm:p-8 bg-gradient-to-r from-theme-surface via-theme-surface-soft to-theme-surface-blue">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-theme-surface-blue border border-theme-border-strong text-theme-primary text-xs font-semibold uppercase tracking-wider mb-2">
          <Sparkles size={13} />
          <span>Configuration</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-theme-text-primary">
          Workspace Settings
        </h1>
        <p className="mt-1 text-sm text-theme-text-secondary">
          Customize interface appearance, stream processing parameters, and local database storage.
        </p>
      </div>

      {/* Theme Appearance Selector Section */}
      <div className="saas-card p-6 sm:p-8">
        <div className="pb-4 border-b border-theme-border flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-theme-text-primary">Appearance & Theme</h2>
            <p className="text-xs text-theme-text-muted mt-0.5">Select your preferred color mode for StreamWeaver</p>
          </div>
          <span className="text-xs font-bold text-theme-primary uppercase tracking-wider px-2.5 py-1 rounded-full bg-theme-surface-blue border border-theme-border-strong">
            Active: {theme}
          </span>
        </div>

        {/* 3 Theme Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          {themeOptions.map((t) => {
            const Icon = t.icon;
            const isSelected = theme === t.id;

            return (
              <div
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`p-5 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'border-theme-primary bg-theme-surface-blue shadow-md ring-2 ring-theme-primary/20'
                    : 'border-theme-border bg-theme-surface hover:bg-theme-surface-soft'
                }`}
              >
                <div>
                  {/* Theme Preview Box */}
                  <div className={`h-24 rounded-xl border p-2 mb-4 flex flex-col justify-between ${t.previewBg}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-theme-primary" />
                        <div className="w-10 h-2 rounded bg-slate-300 dark:bg-slate-700" />
                      </div>
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    </div>
                    <div className={`p-2 rounded-lg border shadow-xs ${t.previewCard}`}>
                      <div className="w-16 h-2 rounded bg-slate-400 dark:bg-slate-600 mb-1" />
                      <div className="w-10 h-1.5 rounded bg-theme-primary opacity-60" />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Icon size={16} className={isSelected ? 'text-theme-primary' : 'text-theme-text-muted'} />
                    <h3 className="text-sm font-bold text-theme-text-primary">{t.title}</h3>
                  </div>
                  <p className="text-xs text-theme-text-secondary mt-1.5 leading-relaxed">{t.desc}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-theme-border flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-theme-text-muted">
                    {isSelected ? 'Currently Selected' : 'Click to Apply'}
                  </span>
                  {isSelected && <CheckCircle2 size={16} className="text-theme-primary" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pipeline & Streaming Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Ingestion & Performance */}
        <div className="saas-card p-6">
          <div className="flex items-center gap-3 pb-4 border-b border-theme-border">
            <div className="w-9 h-9 rounded-xl bg-theme-surface-blue border border-theme-border-strong flex items-center justify-center text-theme-primary">
              <Cpu size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-theme-text-primary">Pipeline Engine</h3>
              <p className="text-xs text-theme-text-muted">Streaming batch performance settings</p>
            </div>
          </div>

          <div className="mt-4 space-y-3.5 text-xs text-theme-text-secondary">
            <div className="flex items-center justify-between p-3 rounded-xl bg-theme-surface-soft border border-theme-border">
              <div>
                <p className="font-semibold text-theme-text-primary">Default Ingestion Batch</p>
                <p className="text-[11px] text-theme-text-muted">Rows per database bulkWrite operation</p>
              </div>
              <span className="font-mono font-bold text-theme-primary">5,000 rows</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-theme-surface-soft border border-theme-border">
              <div>
                <p className="font-semibold text-theme-text-primary">Memory Budget Limit</p>
                <p className="text-[11px] text-theme-text-muted">Enforced RSS threshold for zero-buffer streaming</p>
              </div>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">150 MB</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-theme-surface-soft border border-theme-border">
              <div>
                <p className="font-semibold text-theme-text-primary">V8 Sandbox Execution</p>
                <p className="text-[11px] text-theme-text-muted">Per-row custom transform timeout</p>
              </div>
              <span className="font-mono font-bold text-theme-primary">50 ms</span>
            </div>
          </div>
        </div>

        {/* Database & Storage Architecture */}
        <div className="saas-card p-6">
          <div className="flex items-center gap-3 pb-4 border-b border-theme-border">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Database size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-theme-text-primary">Database & Storage</h3>
              <p className="text-xs text-theme-text-muted">Local persistence & staging directory</p>
            </div>
          </div>

          <div className="mt-4 space-y-3.5 text-xs text-theme-text-secondary">
            <div className="flex items-center justify-between p-3 rounded-xl bg-theme-surface-soft border border-theme-border">
              <div>
                <p className="font-semibold text-theme-text-primary">Active Database Engine</p>
                <p className="text-[11px] text-theme-text-muted">Embedded In-Memory MongoDB (Zero Setup)</p>
              </div>
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={13} /> Active
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-theme-surface-soft border border-theme-border">
              <div>
                <p className="font-semibold text-theme-text-primary">File Ingestion Staging</p>
                <p className="text-[11px] text-theme-text-muted">Automatic cleanup after parsing complete</p>
              </div>
              <span className="font-mono font-bold text-theme-primary">Enabled</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-theme-surface-soft border border-theme-border">
              <div>
                <p className="font-semibold text-theme-text-primary">JWT Token Authentication</p>
                <p className="text-[11px] text-theme-text-muted">Protected API routes & secure sessions</p>
              </div>
              <span className="inline-flex items-center gap-1 font-semibold text-theme-primary">
                <ShieldCheck size={13} /> Enforced
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
