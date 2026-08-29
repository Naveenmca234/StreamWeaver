import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';

interface ImportJob {
  uploadId: string;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalRows: number;
  failedRows: number;
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
}

const HistoryPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const currentUploadId = searchParams.get('uploadId') ?? '';

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const response = await api.get('/imports');
        setJobs(response.data.jobs ?? []);
      } catch (err) {
        setError('Unable to load import history.');
      } finally {
        setLoading(false);
      }
    };

    void loadHistory();
  }, []);

  const totalRows = useMemo(() => jobs.reduce((sum, job) => sum + job.totalRows, 0), [jobs]);
  const latestJob = jobs[0];

  return (
    <div className="space-y-6">
      <div className="saas-card p-6 sm:p-8 bg-gradient-to-r from-theme-surface via-theme-surface-soft to-theme-surface-blue">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-theme-surface-blue border border-theme-border-strong text-theme-primary text-xs font-semibold uppercase tracking-wider mb-2">
              <span>Import history</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-theme-text-primary">Track every dataset import.</h1>
            <p className="mt-1 text-sm text-theme-text-secondary">Review the timeline of ingestion jobs, status, and row counts with enterprise-level audit visibility.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="saas-card p-6 bg-theme-surface-soft">
          <p className="text-xs text-theme-text-muted font-medium">Import jobs</p>
          <p className="mt-1 text-xl font-bold text-theme-text-primary">{jobs.length}</p>
        </div>
        <div className="saas-card p-6 bg-theme-surface-soft">
          <p className="text-xs text-theme-text-muted font-medium">Rows ingested</p>
          <p className="mt-1 text-xl font-bold text-theme-text-primary">{totalRows.toLocaleString()}</p>
        </div>
        <div className="saas-card p-6 bg-theme-surface-soft">
          <p className="text-xs text-theme-text-muted font-medium">Last updated</p>
          <p className="mt-1 text-xl font-bold text-theme-text-primary">{latestJob ? new Date(latestJob.createdAt).toLocaleDateString() : '—'}</p>
        </div>
      </div>

      {loading && (
        <div className="saas-card p-12 flex flex-col items-center justify-center">
          <div className="w-8 h-8 border-2 border-theme-primary border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs text-theme-text-muted">Loading history...</p>
        </div>
      )}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs sm:text-sm flex items-center gap-2">
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && jobs.length === 0 && (
        <div className="saas-card p-12 text-center text-xs text-theme-text-muted">
          No import history available yet. Upload a dataset to begin tracking jobs.
        </div>
      )}

      {!loading && jobs.length > 0 && (
        <div className="saas-card overflow-hidden">
          <div className="grid min-w-full grid-cols-[1.5fr_1fr_1fr_1fr_1fr_0.9fr] gap-4 border-b border-theme-border bg-theme-table-header px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-theme-text-muted">
            <div>Dataset</div>
            <div>Status</div>
            <div>Rows</div>
            <div>Failed</div>
            <div>Started</div>
            <div>Action</div>
          </div>
          <div className="max-h-[560px] overflow-auto px-4 py-2">
            {jobs.map((job) => (
              <div
                key={job.uploadId}
                className={`grid min-w-full grid-cols-[1.5fr_1fr_1fr_1fr_1fr_0.9fr] gap-4 border-b border-theme-border py-3 text-sm text-theme-text-primary last:border-b-0 hover:bg-theme-surface-hover transition ${job.uploadId === currentUploadId ? 'bg-theme-surface-blue/50' : ''}`}
              >
                <div className="truncate font-medium">{job.fileName}</div>
                <div>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full border text-xs font-semibold ${
                    job.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300' :
                    job.status === 'failed' ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300' :
                    'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                  }`}>
                    {job.status}
                  </span>
                </div>
                <div>{job.totalRows.toLocaleString()}</div>
                <div>{job.failedRows.toLocaleString()}</div>
                <div className="text-theme-text-muted">{job.startedAt ? new Date(job.startedAt).toLocaleDateString() : '—'}</div>
                <div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/validations?uploadId=${job.uploadId}`)}
                      className="btn-secondary text-[11px] py-1.5 px-3 rounded-lg flex items-center gap-1 whitespace-nowrap"
                    >
                      Inspect
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/audit?uploadId=${job.uploadId}`)}
                      className="btn-secondary text-[11px] py-1.5 px-3 rounded-lg flex items-center gap-1 whitespace-nowrap"
                    >
                      Audit
                    </button>
                      <button
                        type="button"
                        onClick={async () => {
                          // confirm and delete
                          // eslint-disable-next-line no-restricted-globals
                          if (!confirm(`Delete dataset ${job.fileName}? This will remove all related data.`)) return;
                          try {
                            await api.delete(`/imports/${job.uploadId}`);
                            // refresh list
                            const resp = await api.get('/imports');
                            setJobs(resp.data.jobs ?? []);
                          } catch (err: any) {
                            // eslint-disable-next-line no-console
                            console.error('Delete failed', err);
                            const msg = err?.response?.data?.message || err?.message || 'Failed to delete dataset';
                            const details = err?.response?.data?.details ? `: ${JSON.stringify(err.response.data.details)}` : '';
                            // If import not found, allow admin force-delete retry
                            if (msg === 'Import not found' && /* eslint-disable-next-line no-restricted-globals */ confirm('Import not found for your account. Try force-delete as admin?')) {
                              try {
                                await api.delete(`/imports/${job.uploadId}?force=true`);
                                const resp = await api.get('/imports');
                                setJobs(resp.data.jobs ?? []);
                                return;
                              } catch (err2: any) {
                                // eslint-disable-next-line no-console
                                console.error('Force delete failed', err2);
                                const m2 = err2?.response?.data?.message || err2?.message || 'Force delete failed';
                                alert(`${m2}${err2?.response?.data?.details ? `: ${JSON.stringify(err2.response.data.details)}` : ''}`);
                                return;
                              }
                            }

                            alert(`${msg}${details}`);
                          }
                        }}
                        className="btn-secondary text-[11px] py-1.5 px-3 rounded-lg flex items-center gap-1 whitespace-nowrap text-rose-600 dark:text-rose-400 hover:bg-rose-50 hover:border-rose-200 dark:hover:bg-rose-950/40"
                      >
                        Remove
                      </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryPage;
