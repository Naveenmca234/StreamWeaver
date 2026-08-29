import { motion } from 'framer-motion';
import { ArrowRight, Database, Layers, ShieldCheck, Sparkles, Workflow, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const LandingPage = () => {
  return (
    <div className="relative min-h-screen bg-theme-bg text-theme-text-primary overflow-hidden">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-theme-surface/90 backdrop-blur border-b border-theme-border px-6 py-4">
        <div className="mx-auto max-w-7xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-sky-400 flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-theme-text-primary">StreamWeaver</span>
              <span className="ml-2 text-[10px] uppercase font-bold text-theme-primary px-2 py-0.5 rounded-full bg-theme-surface-blue border border-theme-border-strong">
                ETL
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link 
              to="/auth" 
              className="btn-secondary text-xs py-2 px-4 rounded-xl"
            >
              Sign In
            </Link>
            <Link 
              to="/auth" 
              className="btn-primary text-xs py-2 px-4 rounded-xl"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Main Hero Section */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-12 sm:py-16">
        <div className="saas-card p-8 sm:p-14 bg-gradient-to-br from-theme-surface via-theme-surface-soft to-theme-surface-blue grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-theme-surface-blue border border-theme-border-strong text-theme-primary text-xs font-semibold uppercase tracking-wider mb-4">
              <Sparkles size={13} />
              <span>Enterprise ETL Workspace</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-bold text-theme-text-primary tracking-tight leading-tight">
              High-throughput no-code data pipelines that scale effortlessly.
            </h1>
            <p className="mt-4 text-sm sm:text-base text-theme-text-secondary leading-relaxed max-w-xl">
              Ingest multi-gigabyte CSV and JSON files with streaming memory efficiency, map destination schemas visually, apply isolated sandbox transforms, and audit data quality.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/auth" className="btn-primary text-xs sm:text-sm py-3 px-6 rounded-xl flex items-center gap-2">
                <span>Launch Workspace</span>
                <ArrowRight size={16} />
              </Link>
              <Link to="/dashboard" className="btn-secondary text-xs sm:text-sm py-3 px-5 rounded-xl">
                Explore Command Center
              </Link>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6 }} className="space-y-4">
            <div className="saas-card p-5 bg-theme-surface shadow-md">
              <div className="flex items-center justify-between pb-3 border-b border-theme-border">
                <span className="text-xs font-bold uppercase tracking-wider text-theme-text-muted">Live Stream Processing</span>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={13} /> Active Engine
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2.5 rounded-xl bg-theme-surface-soft border border-theme-border">
                  <p className="text-[10px] text-theme-text-muted uppercase">RAM Peak</p>
                  <p className="font-bold text-emerald-600 mt-0.5">48 MB</p>
                </div>
                <div className="p-2.5 rounded-xl bg-theme-surface-soft border border-theme-border">
                  <p className="text-[10px] text-theme-text-muted uppercase">Batch Size</p>
                  <p className="font-bold text-theme-primary mt-0.5">5,000</p>
                </div>
                <div className="p-2.5 rounded-xl bg-theme-surface-soft border border-theme-border">
                  <p className="text-[10px] text-theme-text-muted uppercase">Latency</p>
                  <p className="font-bold text-theme-text-primary mt-0.5">&lt; 1.2s</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="saas-card p-4 bg-theme-surface">
                <Database size={20} className="text-theme-primary mb-2" />
                <h3 className="text-xs font-bold text-theme-text-primary">Streamed Parsing</h3>
                <p className="text-[11px] text-theme-text-muted mt-0.5">Zero RAM overload on multi-GB datasets.</p>
              </div>
              <div className="saas-card p-4 bg-theme-surface">
                <Layers size={20} className="text-theme-primary mb-2" />
                <h3 className="text-xs font-bold text-theme-text-primary">Mapping Studio</h3>
                <p className="text-[11px] text-theme-text-muted mt-0.5">Visual schema binding & expressions.</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
          <div className="saas-card p-6">
            <div className="w-10 h-10 rounded-xl bg-theme-surface-blue border border-theme-border-strong text-theme-primary flex items-center justify-center mb-4">
              <Database size={20} />
            </div>
            <h3 className="text-sm font-bold text-theme-text-primary">High-Throughput Ingestion</h3>
            <p className="text-xs text-theme-text-secondary mt-2 leading-relaxed">
              Handle large CSV and JSON files effortlessly with incremental streaming straight into database batches.
            </p>
          </div>

          <div className="saas-card p-6">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-600 flex items-center justify-center mb-4">
              <Layers size={20} />
            </div>
            <h3 className="text-sm font-bold text-theme-text-primary">Smart Schema Mapping</h3>
            <p className="text-xs text-theme-text-secondary mt-2 leading-relaxed">
              Auto-suggest column pairings, clean null records, and apply JavaScript transformations in isolated sandboxes.
            </p>
          </div>

          <div className="saas-card p-6">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-600 flex items-center justify-center mb-4">
              <ShieldCheck size={20} />
            </div>
            <h3 className="text-sm font-bold text-theme-text-primary">Enterprise Validation</h3>
            <p className="text-xs text-theme-text-secondary mt-2 leading-relaxed">
              Automatic data profiling, missing-value alerts, quality scores, and real-time streaming progress over WebSockets.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LandingPage;
