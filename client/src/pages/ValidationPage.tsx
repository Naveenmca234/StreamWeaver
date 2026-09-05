import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  FileSearch,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RotateCw,
  Search,
  Filter,
  ShieldCheck
} from 'lucide-react';
import api from '../services/api';
import { useDataset } from '../contexts/DatasetContext';

type ValidationRecord = {
  _id: string;
  uploadId: string;
  rowNumber: number;
  fieldName: string;
  ruleName: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  createdAt: string;
};

type Summary = {
  totalRecords: number;
  totalErrors: number;
  totalWarnings: number;
};

const ValidationPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeUploadId, activeJob, allJobs, datasets, selectDataset, refreshActiveDataset } = useDataset();

  const queryUploadId = searchParams.get('uploadId') ?? '';
  const currentUploadId = queryUploadId || activeUploadId || '';

  const [records, setRecords] = useState<ValidationRecord[]>([]);
  const [summary, setSummary] = useState<Summary>({ totalRecords: 0, totalErrors: 0, totalWarnings: 0 });
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'error' | 'warning'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Sync URL query param with DatasetContext
  useEffect(() => {
    if (queryUploadId && queryUploadId !== activeUploadId) {
      void selectDataset(queryUploadId);
    }
  }, [queryUploadId, activeUploadId, selectDataset]);

  const loadValidations = async () => {
    if (!currentUploadId) {
      setRecords([]);
      setSummary({ totalRecords: 0, totalErrors: 0, totalWarnings: 0 });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const resp = await api.get('/validations', {
        params: {
          uploadId: currentUploadId,
          limit: 200
        }
      });
      setRecords(resp.data.records ?? []);
      setSummary(resp.data.summary ?? { totalRecords: 0, totalErrors: 0, totalWarnings: 0 });
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load validation records.');
    } finally {
      setLoading(false);
    }
  };

  const runValidation = async () => {
    if (!currentUploadId) return;
    setRunning(true);
    setError('');
    try {
      await api.post(`/validations/${currentUploadId}/run`);
      await loadValidations();
      await refreshActiveDataset();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to run validation.');
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    void loadValidations();
  }, [currentUploadId]);

  const filteredRecords = records.filter((r) => {
    const matchesSeverity = severityFilter === 'all' || r.severity === severityFilter;
    const matchesSearch =
      r.fieldName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.message?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.ruleName?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSeverity && matchesSearch;
  });

  const validationStatus = activeJob?.stages?.validation?.status || 'pending';

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="saas-card p-6 sm:p-8 bg-gradient-to-r from-theme-surface via-theme-surface-soft to-theme-surface-blue">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-theme-surface-blue border border-theme-border-strong text-theme-primary text-xs font-semibold uppercase tracking-wider mb-2">
              <Sparkles size={13} />
              <span>Data Governance</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-theme-text-primary">
              Validations & Audit
            </h1>
            <p className="mt-1 text-sm text-theme-text-secondary">
              Review schema validation issues, field format errors, and quality alerts.
            </p>
          </div>

          {/* Dataset Selector Dropdown & Action */}
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
                onClick={() => navigate(`/preview?uploadId=${currentUploadId}`)}
                className="btn-primary text-xs py-2 px-3.5 rounded-xl flex items-center gap-1.5 whitespace-nowrap"
              >
                <span>Preview & Export</span>
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      {currentUploadId && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="saas-card p-5 bg-theme-surface">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-theme-text-muted">Total Issues</span>
              <div className="w-8 h-8 rounded-lg bg-theme-surface-blue border border-theme-border-strong flex items-center justify-center text-theme-primary">
                <FileSearch size={16} />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-theme-text-primary mt-3">{summary.totalRecords.toLocaleString()}</p>
            <p className="text-xs text-theme-text-muted mt-1">Found across dataset</p>
          </div>

          <div className="saas-card p-5 bg-theme-surface">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-theme-text-muted">Errors</span>
              <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center justify-center text-rose-600">
                <AlertCircle size={16} />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-rose-600 dark:text-rose-400 mt-3">{summary.totalErrors.toLocaleString()}</p>
            <p className="text-xs text-theme-text-muted mt-1">Requires mapping / cleaning fix</p>
          </div>

          <div className="saas-card p-5 bg-theme-surface">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-theme-text-muted">Warnings</span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600">
                <AlertTriangle size={16} />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-amber-600 dark:text-amber-400 mt-3">{summary.totalWarnings.toLocaleString()}</p>
            <p className="text-xs text-theme-text-muted mt-1">Non-blocking notices</p>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs sm:text-sm flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={loadValidations}
            className="btn-secondary text-xs py-1 px-3 rounded-lg flex items-center gap-1"
          >
            <RotateCw size={12} />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Empty State */}
      {!currentUploadId && !loading && (
        <div className="saas-card p-12 text-center">
          <ShieldCheck size={36} className="mx-auto text-theme-text-muted mb-3 opacity-60" />
          <h3 className="text-base font-bold text-theme-text-primary">No Dataset Selected</h3>
          <p className="text-xs text-theme-text-muted mt-1 max-w-sm mx-auto">
            Choose an existing upload to inspect validation issues and errors.
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

      {/* Validations Table Card */}
      {currentUploadId && (
        <div className="saas-card overflow-hidden">
          {/* Toolbar */}
          <div className="p-4 sm:p-5 border-b border-theme-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-theme-surface-soft">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-text-muted" />
                <input
                  type="text"
                  placeholder="Filter issues..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="saas-input w-full pl-9 py-1.5 text-xs"
                />
              </div>
              <button
                type="button"
                onClick={runValidation}
                disabled={running}
                className="btn-primary flex-shrink-0 text-xs py-1.5 px-3 rounded-lg flex items-center gap-2"
              >
                <RotateCw size={14} className={running ? 'animate-spin' : ''} />
                <span>Run Validation</span>
              </button>
            </div>

            {/* Severity Filter Pills */}
            <div className="flex items-center p-1 rounded-xl bg-theme-surface border border-theme-border text-xs">
              <button
                type="button"
                onClick={() => setSeverityFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${severityFilter === 'all'
                    ? 'bg-theme-surface-blue border border-theme-border-strong text-theme-primary font-bold'
                    : 'text-theme-text-muted hover:text-theme-text-primary'
                  }`}
              >
                All ({summary.totalRecords})
              </button>
              <button
                type="button"
                onClick={() => setSeverityFilter('error')}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${severityFilter === 'error'
                    ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 font-bold'
                    : 'text-theme-text-muted hover:text-theme-text-primary'
                  }`}
              >
                Errors ({summary.totalErrors})
              </button>
              <button
                type="button"
                onClick={() => setSeverityFilter('warning')}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${severityFilter === 'warning'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 font-bold'
                    : 'text-theme-text-muted hover:text-theme-text-primary'
                  }`}
              >
                Warnings ({summary.totalWarnings})
              </button>
            </div>
          </div>

          {/* Records Table */}
          {loading || running || validationStatus === 'processing' ? (
            <div className="p-12 flex flex-col items-center justify-center">
              <div className="w-8 h-8 border-2 border-theme-primary border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-xs text-theme-text-muted">{running || validationStatus === 'processing' ? 'Running validation...' : 'Loading validations...'}</p>
            </div>
          ) : validationStatus === 'pending' ? (
            <div className="p-12 text-center">
              <AlertCircle size={36} className="mx-auto text-amber-500 mb-2" />
              <h3 className="text-sm font-bold text-theme-text-primary">Validation Pending</h3>
              <p className="text-xs text-theme-text-muted mt-1 mb-4">The dataset has been modified and requires re-validation.</p>
              <button onClick={runValidation} className="btn-primary text-xs py-1.5 px-4 rounded-lg inline-flex items-center gap-2">
                <RotateCw size={14} /> Run Validation Now
              </button>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-2" />
              <h3 className="text-sm font-bold text-theme-text-primary">Clean Validation Pass</h3>
              <p className="text-xs text-theme-text-muted mt-1">No schema validation errors or warnings found for this dataset.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-theme-table-header border-b border-theme-border">
                  <tr>
                    <th className="px-5 py-3 font-bold uppercase tracking-wider text-theme-text-muted text-[10px]">Row #</th>
                    <th className="px-5 py-3 font-bold uppercase tracking-wider text-theme-text-muted text-[10px]">Field Name</th>
                    <th className="px-5 py-3 font-bold uppercase tracking-wider text-theme-text-muted text-[10px]">Rule Triggered</th>
                    <th className="px-5 py-3 font-bold uppercase tracking-wider text-theme-text-muted text-[10px]">Severity</th>
                    <th className="px-5 py-3 font-bold uppercase tracking-wider text-theme-text-muted text-[10px]">Issue Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-border">
                  {filteredRecords.map((r) => (
                    <tr key={r._id} className="hover:bg-theme-surface-hover transition">
                      <td className="px-5 py-3 font-mono text-theme-text-muted font-medium">{r.rowNumber}</td>
                      <td className="px-5 py-3 font-bold text-theme-text-primary">{r.fieldName}</td>
                      <td className="px-5 py-3 text-theme-text-secondary">{r.ruleName}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wide ${r.severity === 'error'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300'
                            : r.severity === 'warning'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300'
                              : 'bg-theme-surface-blue text-theme-primary border border-theme-border-strong'
                          }`}>
                          {r.severity}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-theme-text-secondary max-w-md truncate">{r.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ValidationPage;
