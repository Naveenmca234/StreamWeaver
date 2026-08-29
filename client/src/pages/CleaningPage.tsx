import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  FileSearch, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  ArrowRight, 
  Search, 
  Filter,
  Check,
  Zap,
  RotateCw
} from 'lucide-react';
import api from '../services/api';
import { useDataset } from '../contexts/DatasetContext';

type MissingColumnSummary = {
  name: string;
  totalRows: number;
  missingValues: number;
  missingPercentage: number;
  completeCount: number;
  type: 'number' | 'date' | 'string' | 'boolean' | 'unknown';
  sampleValues: unknown[];
};

type MissingDataSummary = {
  totalRows: number;
  rowsWithMissingData: number;
  completeRows: number;
  totalMissingValues: number;
  missingPercentage: number;
};

type StrategyChoice = 'keep' | 'remove' | 'fill' | 'mean' | 'median' | 'mode';

type ColumnStrategy = {
  strategy: StrategyChoice;
  fillValue: string;
};

const CleaningPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeUploadId, activeJob, allJobs, datasets, selectDataset, refreshActiveDataset } = useDataset();

  const queryUploadId = searchParams.get('uploadId') ?? '';
  const currentUploadId = queryUploadId || activeUploadId || '';

  const [columns, setColumns] = useState<MissingColumnSummary[]>([]);
  const [summary, setSummary] = useState<MissingDataSummary | null>(null);
  const [strategies, setStrategies] = useState<Record<string, ColumnStrategy>>({});
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string>('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [fieldSearch, setFieldSearch] = useState('');
  const [showAllColumns, setShowAllColumns] = useState(false);

  // Synchronize URL query parameter with DatasetContext
  useEffect(() => {
    if (queryUploadId && queryUploadId !== activeUploadId) {
      void selectDataset(queryUploadId);
    }
  }, [queryUploadId, activeUploadId, selectDataset]);

  const loadMissingSummary = async () => {
    if (!currentUploadId) {
      setColumns([]);
      setStrategies({});
      setSummary(null);
      setLoading(false);
      return;
    }

    setError('');
    setMessage('');
    setLoading(true);

    try {
      const response = await api.get('/cleaning', { params: { uploadId: currentUploadId } });
      const fetchedColumns: MissingColumnSummary[] = response.data.columns ?? [];
      const fetchedSummary: MissingDataSummary | null = response.data.summary ?? null;
      const savedStrategies: Record<string, ColumnStrategy> = response.data.strategies ?? {};

      setColumns(fetchedColumns);
      setSummary(fetchedSummary);

      const initialStrategies = fetchedColumns.reduce((acc, column) => {
        acc[column.name] = savedStrategies[column.name] || { strategy: 'keep', fillValue: '' };
        return acc;
      }, {} as Record<string, ColumnStrategy>);

      setStrategies(initialStrategies);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Unable to load missing value profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMissingSummary();
  }, [currentUploadId]);

  const filteredColumns = useMemo(() => {
    return columns.filter((col) => {
      const matchesSearch = col.name.toLowerCase().includes(fieldSearch.toLowerCase());
      const matchesMissing = showAllColumns ? true : col.missingValues > 0;
      return matchesSearch && matchesMissing;
    });
  }, [columns, fieldSearch, showAllColumns]);

  const handleStrategyChange = (columnName: string, field: keyof ColumnStrategy, value: string) => {
    setStrategies((prev) => ({
      ...prev,
      [columnName]: {
        ...prev[columnName],
        [field]: value
      }
    }));
  };

  const applySingleStrategy = async (columnName: string) => {
    const current = strategies[columnName];
    if (!current || !currentUploadId) return;

    setApplying(columnName);
    setError('');
    setMessage('');

    try {
      await api.post(`/cleaning/${currentUploadId}/apply`, {
        columnName,
        strategy: current.strategy,
        fillValue: current.fillValue
      });
      setMessage(`Strategy applied to ${columnName} successfully.`);
      await loadMissingSummary();
      await refreshActiveDataset();
    } catch (err: any) {
      const backendError = err?.response?.data?.message || err?.response?.data?.error || `Failed to clean ${columnName}`;
      setError(backendError);
    } finally {
      setApplying('');
    }
  };

  const applyAllStrategies = async () => {
    if (!currentUploadId) return;
    setApplying('ALL');
    setError('');
    setMessage('');

    try {
      await api.post(`/cleaning/${currentUploadId}/apply-all`, { strategies });
      setMessage('All cleaning rules applied successfully.');
      await loadMissingSummary();
      await refreshActiveDataset();
    } catch (err: any) {
      const backendError = err?.response?.data?.message || err?.response?.data?.error || 'Failed to apply cleaning strategies.';
      setError(backendError);
    } finally {
      setApplying('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="saas-card p-6 sm:p-8 bg-gradient-to-r from-theme-surface via-theme-surface-soft to-theme-surface-blue">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-theme-surface-blue border border-theme-border-strong text-theme-primary text-xs font-semibold uppercase tracking-wider mb-2">
              <Sparkles size={13} />
              <span>Data Profiling</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-theme-text-primary">
              Clean Data
            </h1>
            <p className="mt-1 text-sm text-theme-text-secondary">
              Profile schema completeness, impute missing values, and configure column-level clean rules.
            </p>
          </div>

          {/* Dataset Selector Dropdown */}
          <div className="flex items-center gap-3">
            <select
              value={currentUploadId}
              onChange={(e) => void selectDataset(e.target.value || null)}
              className="saas-input text-xs font-medium cursor-pointer min-w-[220px]"
            >
              <option value="">Select a Dataset...</option>
              {datasets.map((d) => (
                <option key={d.uploadId} value={d.uploadId}>
                  {d.label}
                </option>
              ))}
            </select>
            {currentUploadId && (
              <button
                type="button"
                onClick={() => navigate(`/mapping?uploadId=${currentUploadId}`)}
                className="btn-primary text-xs py-2 px-3.5 rounded-xl whitespace-nowrap"
              >
                <span>Mapping Studio</span>
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      {message && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs sm:text-sm flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600" />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={loadMissingSummary}
            className="btn-secondary text-xs py-1 px-3 rounded-lg self-start sm:self-auto flex items-center gap-1"
          >
            <RotateCw size={12} />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Summary KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
          <div className="saas-card p-4 bg-theme-surface">
            <span className="text-[11px] font-bold uppercase tracking-wider text-theme-text-muted">Total Rows</span>
            <p className="text-xl font-bold text-theme-text-primary mt-1">{summary.totalRows.toLocaleString()}</p>
          </div>
          <div className="saas-card p-4 bg-theme-surface">
            <span className="text-[11px] font-bold uppercase tracking-wider text-theme-text-muted">Complete Rows</span>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{summary.completeRows.toLocaleString()}</p>
          </div>
          <div className="saas-card p-4 bg-theme-surface">
            <span className="text-[11px] font-bold uppercase tracking-wider text-theme-text-muted">Rows with Nulls</span>
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">{summary.rowsWithMissingData.toLocaleString()}</p>
          </div>
          <div className="saas-card p-4 bg-theme-surface">
            <span className="text-[11px] font-bold uppercase tracking-wider text-theme-text-muted">Total Nulls</span>
            <p className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1">{summary.totalMissingValues.toLocaleString()}</p>
          </div>
          <div className="saas-card p-4 bg-theme-surface-blue border-theme-border-strong">
            <span className="text-[11px] font-bold uppercase tracking-wider text-theme-primary">Completeness</span>
            <p className="text-xl font-bold text-theme-primary mt-1">
              {(100 - (summary.missingPercentage ?? 0)).toFixed(1)}%
            </p>
          </div>
        </div>
      )}

      {/* Empty State: No Dataset Selected */}
      {!currentUploadId && !loading && (
        <div className="saas-card p-12 text-center">
          <FileSearch size={36} className="mx-auto text-theme-text-muted mb-3 opacity-60" />
          <h3 className="text-base font-bold text-theme-text-primary">No Dataset Selected</h3>
          <p className="text-xs text-theme-text-muted mt-1 max-w-sm mx-auto">
            Choose an existing upload from the dropdown above or upload a new file to start profiling missing data.
          </p>
          <button
            type="button"
            onClick={() => navigate('/upload')}
            className="btn-primary text-xs mt-4 py-2 px-4 rounded-xl"
          >
            Upload New Dataset
          </button>
        </div>
      )}

      {/* Clean Dataset State: No Missing Values */}
      {currentUploadId && !loading && columns.length === 0 && !error && (
        <div className="saas-card p-8 border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 flex items-center justify-center font-bold">
                ✓
              </div>
              <div>
                <h3 className="text-sm font-bold text-theme-text-primary">No Missing Values Detected</h3>
                <p className="text-xs text-theme-text-muted mt-0.5">Your dataset is 100% complete and ready for mapping.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/mapping?uploadId=${currentUploadId}`)}
              className="btn-primary text-xs py-2.5 px-5 rounded-xl whitespace-nowrap"
            >
              Continue to Mapping →
            </button>
          </div>
        </div>
      )}

      {/* Column Rules & Imputation Table */}
      {currentUploadId && columns.length > 0 && (
        <div className="saas-card overflow-hidden">
          {/* Table Toolbar */}
          <div className="p-4 sm:p-5 border-b border-theme-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-theme-surface-soft">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-text-muted" />
                <input
                  type="text"
                  placeholder="Filter column name..."
                  value={fieldSearch}
                  onChange={(e) => setFieldSearch(e.target.value)}
                  className="saas-input w-full pl-9 py-1.5 text-xs"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowAllColumns(!showAllColumns)}
                className={`btn-secondary text-xs py-1.5 px-3 rounded-lg flex items-center gap-1.5 whitespace-nowrap ${
                  showAllColumns ? 'bg-theme-surface-blue border-theme-border-strong text-theme-primary' : ''
                }`}
              >
                <Filter size={13} />
                <span>{showAllColumns ? 'All Columns' : 'Only Missing'}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={applyAllStrategies}
              disabled={applying === 'ALL'}
              className="btn-primary text-xs py-2 px-4 rounded-xl flex items-center gap-2 whitespace-nowrap"
            >
              <Zap size={14} />
              <span>{applying === 'ALL' ? 'Applying...' : 'Apply All Rules'}</span>
            </button>
          </div>

          {/* Table Rows */}
          <div className="divide-y divide-theme-border overflow-x-auto">
            {filteredColumns.map((col) => {
              const currentStrategy = strategies[col.name]?.strategy ?? 'keep';
              const fillVal = strategies[col.name]?.fillValue ?? '';
              const isApplyingThis = applying === col.name;

              return (
                <div key={col.name} className="p-4 sm:p-5 hover:bg-theme-surface-soft transition flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Column Metadata */}
                  <div className="min-w-[240px]">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-theme-text-primary">{col.name}</span>
                      <span className="px-2 py-0.5 rounded-md bg-theme-surface-soft border border-theme-border text-[10px] uppercase font-bold text-theme-text-muted">
                        {col.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-theme-text-muted">
                      <span>Nulls: <strong className="text-rose-600 dark:text-rose-400">{col.missingValues.toLocaleString()}</strong> ({col.missingPercentage.toFixed(1)}%)</span>
                      <span>•</span>
                      <span>Complete: {col.completeCount.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Strategy Controls */}
                  <div className="flex flex-wrap items-center gap-3">
                    <select
                      value={currentStrategy}
                      onChange={(e) => handleStrategyChange(col.name, 'strategy', e.target.value as StrategyChoice)}
                      className="saas-input text-xs py-1.5 px-3 min-w-[170px]"
                    >
                      <option value="keep">Keep missing values</option>
                      <option value="remove">Remove rows with nulls</option>
                      <option value="fill">Fill with custom value</option>
                      {col.type === 'number' && (
                        <>
                          <option value="mean">Impute Mean (average)</option>
                          <option value="median">Impute Median</option>
                        </>
                      )}
                      <option value="mode">Impute Mode (frequent)</option>
                    </select>

                    {currentStrategy === 'fill' && (
                      <input
                        type="text"
                        placeholder="Enter default fill value..."
                        value={fillVal}
                        onChange={(e) => handleStrategyChange(col.name, 'fillValue', e.target.value)}
                        className="saas-input text-xs py-1.5 px-3 w-48"
                      />
                    )}

                    <button
                      type="button"
                      onClick={() => applySingleStrategy(col.name)}
                      disabled={isApplyingThis}
                      className="btn-secondary text-xs py-1.5 px-3 rounded-lg flex items-center gap-1"
                    >
                      <Check size={13} />
                      <span>{isApplyingThis ? 'Applying...' : 'Apply'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default CleaningPage;
