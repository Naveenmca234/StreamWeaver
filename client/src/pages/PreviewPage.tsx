import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Database,
  Sparkles,
  ArrowRight,
  Download,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  Layers,
  FileSpreadsheet
} from 'lucide-react';
import api from '../services/api';
import MemoryAudit from '../components/MemoryAudit';
import { useDataset } from '../contexts/DatasetContext';

const PreviewPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeUploadId, activeJob, allJobs, datasets, selectDataset } = useDataset();

  const queryUploadId = searchParams.get('uploadId') ?? '';
  const currentUploadId = queryUploadId || activeUploadId || '';

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'raw' | 'transformed'>('raw');

  // Sync URL query param with DatasetContext
  useEffect(() => {
    if (queryUploadId && queryUploadId !== activeUploadId) {
      void selectDataset(queryUploadId);
    }
  }, [queryUploadId, activeUploadId, selectDataset]);

  const loadData = async (abortController: AbortController) => {
    if (!currentUploadId) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (activeTab === 'transformed') {
        const resp = await api.get(`/transformed/${currentUploadId}`, { signal: abortController.signal });
        const transformedRows = (resp.data.rows || []).map((r: any) => r.transformedData || r.data || r);
        if (!abortController.signal.aborted) {
          setRows(transformedRows);
          setError('');
        }
      } else {
        const resp = await api.get('/uploads/preview', { params: { uploadId: currentUploadId, limit: 1000 }, signal: abortController.signal });
        if (!abortController.signal.aborted) {
          setRows(resp.data.preview ?? resp.data.rows ?? []);
          setError('');
        }
      }
    } catch (err: any) {
      if (!abortController.signal.aborted) {
        setError(err?.response?.data?.message || 'Unable to fetch preview records. Please retry.');
      }
    } finally {
      if (!abortController.signal.aborted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const abortController = new AbortController();
    void loadData(abortController);
    return () => abortController.abort();
  }, [currentUploadId, activeTab]);

  const columns = useMemo(() => {
    if (!rows.length) return [];
    return Array.from(new Set(rows.flatMap((r) => Object.keys(r || {}))));
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter((r) =>
      Object.values(r || {}).some((v) => String(v).toLowerCase().includes(q))
    );
  }, [rows, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="saas-card p-6 sm:p-8 bg-gradient-to-r from-theme-surface via-theme-surface-soft to-theme-surface-blue">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-theme-surface-blue border border-theme-border-strong text-theme-primary text-xs font-semibold uppercase tracking-wider mb-2">
              <Sparkles size={13} />
              <span>Data Virtualization</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-theme-text-primary">
              Preview Data
            </h1>
            <p className="mt-1 text-sm text-theme-text-secondary">
              Virtual table inspector for persisted dataset records with zero-buffer streaming.
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
                onClick={() => navigate(`/validations?uploadId=${currentUploadId}`)}
                className="btn-primary text-xs py-2 px-3.5 rounded-xl whitespace-nowrap"
              >
                <span>Validations</span>
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Memory Audit Component */}
      {currentUploadId && <MemoryAudit uploadId={currentUploadId} />}

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs sm:text-sm flex items-center gap-2">
          <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Empty State */}
      {!currentUploadId && !loading && (
        <div className="saas-card p-12 text-center">
          <Database size={36} className="mx-auto text-theme-text-muted mb-3 opacity-60" />
          <h3 className="text-base font-bold text-theme-text-primary">No Dataset Selected</h3>
          <p className="text-xs text-theme-text-muted mt-1 max-w-sm mx-auto">
            Choose an existing upload or upload a new file to preview records.
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

      {/* Table Workspace */}
      {currentUploadId && (
        <div className="saas-card overflow-hidden">
          {/* Table Toolbar */}
          <div className="p-4 sm:p-5 border-b border-theme-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-theme-surface-soft">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-text-muted" />
                <input
                  type="text"
                  placeholder="Filter preview records..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="saas-input w-full pl-9 py-1.5 text-xs"
                />
              </div>
            </div>

            {/* Toggle Raw vs Transformed */}
            <div className="flex items-center p-1 rounded-xl bg-theme-surface border border-theme-border text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('raw')}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${activeTab === 'raw'
                    ? 'bg-theme-surface-blue border border-theme-border-strong text-theme-primary font-bold'
                    : 'text-theme-text-muted hover:text-theme-text-primary'
                  }`}
              >
                Raw Ingestion
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('transformed')}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${activeTab === 'transformed'
                    ? 'bg-theme-surface-blue border border-theme-border-strong text-theme-primary font-bold'
                    : 'text-theme-text-muted hover:text-theme-text-primary'
                  }`}
              >
                Transformed
              </button>
            </div>
          </div>

          {/* Records Stats Header */}
          <div className="px-5 py-2.5 bg-theme-surface border-b border-theme-border flex items-center justify-between text-xs text-theme-text-muted">
            <span>
              Showing <strong className="text-theme-text-primary">{filteredRows.length.toLocaleString()}</strong> of <strong className="text-theme-text-primary">{(activeJob?.totalRows ?? 0).toLocaleString()}</strong> records ({columns.length} {activeTab === 'transformed' ? 'transformed' : 'raw'} columns)
            </span>
            <span className="text-[11px] text-theme-primary font-semibold">
              Live RAM Snapshot
            </span>
          </div>

          {/* Virtual Table */}
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center">
              <div className="w-8 h-8 border-2 border-theme-primary border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-xs text-theme-text-muted">Streaming dataset preview...</p>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="p-10 text-center text-xs text-theme-text-muted">
              No records match your filter criteria or dataset has no preview rows.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[550px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-theme-table-header border-b border-theme-border z-10">
                  <tr>
                    <th className="px-4 py-3 font-bold uppercase tracking-wider text-theme-text-muted text-[10px] w-12 border-r border-theme-border text-center">
                      #
                    </th>
                    {columns.map((col) => (
                      <th
                        key={col}
                        className="px-4 py-3 font-bold uppercase tracking-wider text-theme-text-muted text-[10px] whitespace-nowrap border-r border-theme-border last:border-r-0"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-theme-border">
                  {filteredRows.slice(0, 200).map((row, idx) => (
                    <tr key={idx} className="hover:bg-theme-surface-hover transition">
                      <td className="px-4 py-2.5 font-mono text-[11px] text-theme-text-muted border-r border-theme-border text-center">
                        {idx + 1}
                      </td>
                      {columns.map((col) => {
                        const val = row[col];
                        const isNull = val === null || val === undefined || val === '';
                        return (
                          <td
                            key={col}
                            className={`px-4 py-2.5 whitespace-nowrap border-r border-theme-border last:border-r-0 font-medium ${isNull ? 'text-rose-400 italic text-[11px]' : 'text-theme-text-primary'
                              }`}
                          >
                            {isNull ? 'null' : String(val)}
                          </td>
                        );
                      })}
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

export default PreviewPage;
