import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  Layers,
  Plus,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap,
  AlertCircle,
  Clock
} from 'lucide-react';
import { useDataset } from '../contexts/DatasetContext';

const DashboardPage = () => {
  const { activeJob, allJobs, datasets, profile, dashboardStats, activeUploadId, loading } = useDataset();

  const registeredDatasetsCount = dashboardStats?.registeredDatasets ?? datasets.length;
  const persistedRowsCount = dashboardStats?.totalPersistedRows ?? 0;
  const historicalRowsCount = dashboardStats?.totalHistoricalRows ?? datasets.reduce((sum, d) => sum + (d.totalRows || 0), 0);
  const hasPersistedRows = dashboardStats ? dashboardStats.hasPersistedRows : Boolean((activeJob?.totalRows || 0) > 0 && profile);

  const totalRows = hasPersistedRows ? (activeJob?.totalRows ?? profile?.totalRows ?? 0) : 0;
  const failedRows = activeJob?.failedRows ?? 0;
  const successRows = Math.max(0, totalRows - failedRows);
  const qualityScore = (hasPersistedRows && profile?.qualityScore != null)
    ? profile.qualityScore
    : (hasPersistedRows && totalRows > 0)
      ? Math.round((successRows / totalRows) * 100)
      : null;

  // Stage statuses
  const ingestionStatus = activeJob?.stages?.ingestion?.status || (activeJob?.status === 'completed' ? 'completed' : activeJob?.status === 'processing' ? 'processing' : 'pending');
  const cleaningStatus = activeJob?.stages?.cleaning?.status || (activeJob?.cleaningStrategies && Object.keys(activeJob.cleaningStrategies).length ? 'completed' : 'pending');
  const mappingStatus = activeJob?.stages?.mapping?.status || (activeJob?.mapping && Object.keys(activeJob.mapping).length ? 'completed' : 'pending');
  const transformStatus = activeJob?.stages?.transformation?.status || (activeJob?.transformedAt ? 'completed' : activeJob?.status === 'failed' ? 'failed' : 'pending');
  const validationStatus = activeJob?.stages?.validation?.status || 'pending';

  const getStageBadge = (st: string) => {
    switch (st) {
      case 'completed':
        return <span className="text-emerald-500 font-bold">✓</span>;
      case 'failed':
        return <span className="text-rose-500 font-bold">✗</span>;
      case 'processing':
        return <span className="w-2.5 h-2.5 rounded-full bg-theme-primary animate-pulse inline-block" />;
      default:
        return <span className="text-theme-text-muted font-normal text-xs">○</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero / Command Center Banner */}
      <div className="saas-card p-6 sm:p-8 bg-gradient-to-r from-theme-surface via-theme-surface-soft to-theme-surface-blue border border-theme-border relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-theme-surface-blue border border-theme-border-strong text-theme-primary text-xs font-semibold uppercase tracking-wider mb-3">
              <Sparkles size={13} />
              <span>Workspace Hub</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-theme-text-primary tracking-tight">
              Enterprise ETL Command Center
            </h1>
            <p className="mt-2 text-sm sm:text-base text-theme-text-secondary leading-relaxed">
              Monitor active data streams, track schema completeness, apply isolated sandbox transforms, and govern pipeline quality across all your datasets.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-theme-surface border border-theme-border shadow-xs text-xs font-semibold text-theme-text-primary">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>All Systems Operational</span>
            </div>
            <Link
              to="/upload"
              className="btn-primary text-xs py-2.5 px-4 rounded-xl"
            >
              <Plus size={15} />
              <span>Start Ingestion</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 4 KPI Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5">
        <div className="saas-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-theme-text-muted">Registered Datasets</span>
            <div className="w-8 h-8 rounded-lg bg-theme-surface-blue border border-theme-border-strong flex items-center justify-center text-theme-primary">
              <Activity size={16} />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-bold text-theme-text-primary">{registeredDatasetsCount}</span>
            <span className="inline-flex items-center text-xs font-medium text-theme-primary gap-0.5">
              <Database size={13} /> Persisted
            </span>
          </div>
          <p className="mt-1 text-xs text-theme-text-muted">Total datasets in workspace</p>
        </div>

        <div className="saas-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-theme-text-muted">Persisted Rows</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Database size={16} />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-bold text-theme-text-primary">{persistedRowsCount.toLocaleString()}</span>
            <span className="inline-flex items-center text-xs font-medium text-emerald-600 dark:text-emerald-400 gap-0.5">
              <Zap size={13} /> Live Storage
            </span>
          </div>
          <p className="mt-1 text-xs text-theme-text-muted">
            {persistedRowsCount > 0
              ? `${historicalRowsCount.toLocaleString()} cumulative rows ingested`
              : `0 live rows (${historicalRowsCount.toLocaleString()} historically ingested)`}
          </p>
        </div>

        <div className="saas-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-theme-text-muted">Quality Score</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <ShieldCheck size={16} />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-2xl sm:text-3xl font-bold text-theme-text-primary">
              {qualityScore != null ? `${qualityScore}%` : '—'}
            </span>
            {qualityScore != null && qualityScore >= 90 ? (
              <span className="inline-flex items-center text-xs font-medium text-emerald-600 dark:text-emerald-400 gap-0.5">
                <CheckCircle2 size={13} /> High Quality
              </span>
            ) : qualityScore != null ? (
              <span className="inline-flex items-center text-xs font-medium text-amber-600 dark:text-amber-400 gap-0.5">
                <AlertCircle size={13} /> Validated
              </span>
            ) : (
              <span className="inline-flex items-center text-xs font-medium text-theme-text-muted gap-0.5">
                Awaiting Data
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-theme-text-muted">
            {hasPersistedRows ? 'Current active dataset profile' : 'No live rows in storage to profile'}
          </p>
        </div>

        <div className="saas-card p-5 bg-gradient-to-br from-theme-surface to-theme-surface-blue flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-theme-primary font-semibold">New Dataset</span>
            <div className="w-8 h-8 rounded-lg bg-theme-primary text-white flex items-center justify-center shadow-xs">
              <Plus size={16} />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-sm font-semibold text-theme-text-primary">Ingest CSV or JSON</p>
            <p className="text-xs text-theme-text-muted mt-0.5">Upload dataset up to 5GB</p>
          </div>
          <Link
            to="/upload"
            className="mt-3 w-full btn-primary text-xs py-2 rounded-lg"
          >
            <span>Upload File</span>
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </div>

      {/* Main Grid: Pipeline Status & Latest Import Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Pipeline Visual Status & ETL Flow */}
        <div className="lg:col-span-2 space-y-6">
          {/* Pipeline Stages Card */}
          <div className="saas-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-theme-text-primary">ETL Pipeline Status</h2>
                <p className="text-xs text-theme-text-muted mt-0.5">
                  {activeJob ? `Dataset: ${activeJob.fileName}` : 'Select or upload a dataset to track pipeline stages'}
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-theme-surface-blue text-theme-primary border border-theme-border-strong">
                Streaming V2 Engine
              </span>
            </div>

            {/* Horizontal Timeline Component */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
              <Link to="/upload" className="p-3.5 rounded-xl border border-theme-border bg-theme-surface-soft hover:bg-theme-surface-hover transition text-center group">
                <div className="w-8 h-8 mx-auto rounded-full bg-theme-surface border border-theme-border flex items-center justify-center mb-2 font-bold text-xs">
                  {getStageBadge(ingestionStatus)}
                </div>
                <p className="text-xs font-bold text-theme-text-primary group-hover:text-theme-primary">1. Ingestion</p>
                <p className="text-[11px] text-theme-text-muted mt-0.5 capitalize">{ingestionStatus}</p>
              </Link>

              <Link to={activeUploadId ? `/cleaning?uploadId=${activeUploadId}` : '/cleaning'} className="p-3.5 rounded-xl border border-theme-border bg-theme-surface-soft hover:bg-theme-surface-hover transition text-center group">
                <div className="w-8 h-8 mx-auto rounded-full bg-theme-surface border border-theme-border flex items-center justify-center mb-2 font-bold text-xs">
                  {getStageBadge(cleaningStatus)}
                </div>
                <p className="text-xs font-bold text-theme-text-primary group-hover:text-theme-primary">2. Clean</p>
                <p className="text-[11px] text-theme-text-muted mt-0.5 capitalize">{cleaningStatus}</p>
              </Link>

              <Link to={activeUploadId ? `/mapping?uploadId=${activeUploadId}` : '/mapping'} className="p-3.5 rounded-xl border border-theme-border bg-theme-surface-soft hover:bg-theme-surface-hover transition text-center group">
                <div className="w-8 h-8 mx-auto rounded-full bg-theme-surface border border-theme-border flex items-center justify-center mb-2 font-bold text-xs">
                  {getStageBadge(mappingStatus)}
                </div>
                <p className="text-xs font-bold text-theme-text-primary group-hover:text-theme-primary">3. Mapping</p>
                <p className="text-[11px] text-theme-text-muted mt-0.5 capitalize">{mappingStatus}</p>
              </Link>

              <Link to={activeUploadId ? `/preview?uploadId=${activeUploadId}` : '/preview'} className="p-3.5 rounded-xl border border-theme-border bg-theme-surface-soft hover:bg-theme-surface-hover transition text-center group">
                <div className="w-8 h-8 mx-auto rounded-full bg-theme-surface border border-theme-border flex items-center justify-center mb-2 font-bold text-xs">
                  {getStageBadge(transformStatus)}
                </div>
                <p className="text-xs font-bold text-theme-text-primary group-hover:text-theme-primary">4. Transform</p>
                <p className="text-[11px] text-theme-text-muted mt-0.5 capitalize">{transformStatus}</p>
              </Link>

              <Link to={activeUploadId ? `/validations?uploadId=${activeUploadId}` : '/validations'} className="p-3.5 rounded-xl border border-theme-border bg-theme-surface-soft hover:bg-theme-surface-hover transition text-center group">
                <div className="w-8 h-8 mx-auto rounded-full bg-theme-surface border border-theme-border flex items-center justify-center mb-2 font-bold text-xs">
                  {getStageBadge(validationStatus)}
                </div>
                <p className="text-xs font-bold text-theme-text-primary group-hover:text-theme-primary">5. Validate</p>
                <p className="text-[11px] text-theme-text-muted mt-0.5 capitalize">{validationStatus}</p>
              </Link>
            </div>
          </div>

          {/* Quick Action Feature Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="saas-card p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-theme-surface-blue border border-theme-border-strong flex items-center justify-center text-theme-primary flex-shrink-0">
                <Layers size={20} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-theme-text-primary">Visual Mapping Studio</h3>
                <p className="text-xs text-theme-text-secondary mt-1 leading-relaxed">
                  Map dynamic dataset columns to canonical schemas with isolated JavaScript expressions.
                </p>
                <Link to={activeUploadId ? `/mapping?uploadId=${activeUploadId}` : '/mapping'} className="inline-flex items-center gap-1 text-xs font-semibold text-theme-primary hover:text-theme-primary-hover mt-3">
                  Open Studio <ArrowUpRight size={13} />
                </Link>
              </div>
            </div>

            <div className="saas-card p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                <FileSpreadsheet size={20} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-theme-text-primary">Dataset Profiling & Clean</h3>
                <p className="text-xs text-theme-text-secondary mt-1 leading-relaxed">
                  Detect nulls, calculate completeness, and apply imputation strategies in seconds.
                </p>
                <Link to={activeUploadId ? `/cleaning?uploadId=${activeUploadId}` : '/cleaning'} className="inline-flex items-center gap-1 text-xs font-semibold text-theme-primary hover:text-theme-primary-hover mt-3">
                  Clean Data <ArrowUpRight size={13} />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Active Dataset Summary Card */}
        <div className="saas-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-theme-border">
              <div>
                <h2 className="text-base font-bold text-theme-text-primary">Active Dataset</h2>
                <p className="text-xs text-theme-text-muted mt-0.5">Workspace persistent resource</p>
              </div>
              {activeJob?.status ? (
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold capitalize ${activeJob.status === 'completed'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300'
                    : activeJob.status === 'failed'
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                  {activeJob.status}
                </span>
              ) : null}
            </div>

            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center">
                <div className="w-8 h-8 border-2 border-theme-primary border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-xs text-theme-text-muted">Loading dataset summary...</p>
              </div>
            ) : !activeJob ? (
              <div className="py-10 text-center">
                <Database size={32} className="mx-auto text-theme-text-muted mb-2 opacity-50" />
                <p className="text-sm font-semibold text-theme-text-primary">No Dataset Available</p>
                <p className="text-xs text-theme-text-muted mt-1 max-w-[200px] mx-auto">
                  Upload your first dataset to populate live analytics.
                </p>
                <Link to="/upload" className="btn-primary text-xs mt-4 py-2 px-4 rounded-xl">
                  Upload Dataset
                </Link>
              </div>
            ) : (
              <div className="pt-5 space-y-5">
                {/* Radial Visual / Score Display */}
                <div className="p-4 rounded-2xl bg-theme-surface-soft border border-theme-border flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-theme-text-muted">Quality Score</p>
                    <p className="text-2xl font-bold text-theme-text-primary mt-1">
                      {qualityScore != null ? `${qualityScore}%` : '—'}
                    </p>
                    <p className="text-[11px] text-theme-text-muted font-medium">
                      {hasPersistedRows ? 'Valid schema rows' : 'Awaiting raw rows in storage'}
                    </p>
                  </div>
                  <div className="relative w-16 h-16 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-theme-border stroke-current"
                        strokeWidth="3.5"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="text-theme-primary stroke-current"
                        strokeDasharray={`${qualityScore ?? 0}, 100`}
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <span className="absolute text-xs font-bold text-theme-text-primary">
                      {qualityScore != null ? `${qualityScore}%` : '—'}
                    </span>
                  </div>
                </div>

                {/* File Information */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-theme-text-muted">Dataset File</p>
                  <p className="text-sm font-semibold text-theme-text-primary truncate mt-0.5" title={activeJob.fileName}>
                    {activeJob.fileName}
                  </p>
                </div>

                {/* Metric Summary Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-theme-surface-soft border border-theme-border">
                    <p className="text-[11px] text-theme-text-muted">Total Rows</p>
                    <p className="text-base font-bold text-theme-text-primary mt-0.5">{totalRows.toLocaleString()}</p>
                    <p className="text-[10px] text-theme-text-muted mt-0.5">
                      {hasPersistedRows ? 'Live storage' : activeJob.totalRows ? `(${activeJob.totalRows.toLocaleString()} ingested)` : 'No live rows'}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-theme-surface-soft border border-theme-border">
                    <p className="text-[11px] text-theme-text-muted">Columns</p>
                    <p className="text-base font-bold text-theme-primary mt-0.5">{activeJob.columns?.length || profile?.totalColumns || '—'}</p>
                    <p className="text-[10px] text-theme-text-muted mt-0.5">Detected fields</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {activeJob && (
            <div className="pt-4 border-t border-theme-border mt-4 flex items-center gap-2">
              <Link
                to={`/preview?uploadId=${activeJob.uploadId}`}
                className="flex-1 btn-secondary text-xs py-2 px-3 rounded-xl justify-center text-center"
              >
                Preview Data
              </Link>
              <Link
                to={`/validations?uploadId=${activeJob.uploadId}`}
                className="flex-1 btn-primary text-xs py-2 px-3 rounded-xl justify-center text-center"
              >
                Validations
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
