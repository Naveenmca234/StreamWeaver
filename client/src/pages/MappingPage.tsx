import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Layers,
  Sparkles,
  ArrowRight,
  Code,
  CheckCircle2,
  AlertCircle,
  Database,
  Search,
  Check,
  Play,
  RotateCw,
  Info
} from 'lucide-react';
import api from '../services/api';
import { useDataset } from '../contexts/DatasetContext';

type MappingItem = {
  source: string;
  target: string;
  enabled: boolean;
  transformCode?: string;
};

const canonicalTargets = [
  { key: 'EmployeeID', label: 'Employee ID', type: 'string', required: true },
  { key: 'Age', label: 'Age', type: 'number', required: false },
  { key: 'Attrition', label: 'Attrition Status', type: 'string', required: true },
  { key: 'Department', label: 'Department', type: 'string', required: true },
  { key: 'DistanceFromHome', label: 'Distance From Home', type: 'number', required: false },
  { key: 'Education', label: 'Education Level', type: 'number', required: false },
  { key: 'EducationField', label: 'Education Field', type: 'string', required: false },
  { key: 'Gender', label: 'Gender', type: 'string', required: false },
  { key: 'JobRole', label: 'Job Role', type: 'string', required: true },
  { key: 'MonthlyIncome', label: 'Monthly Income', type: 'number', required: false },
  { key: 'NumCompaniesWorked', label: 'Previous Companies', type: 'number', required: false },
  { key: 'OverTime', label: 'Overtime Status', type: 'string', required: false },
  { key: 'TotalWorkingYears', label: 'Total Experience', type: 'number', required: false },
  { key: 'YearsAtCompany', label: 'Tenure Years', type: 'number', required: false }
];

const MappingPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { activeUploadId, activeJob, allJobs, datasets, selectDataset, refreshActiveDataset } = useDataset();

  const queryUploadId = searchParams.get('uploadId') ?? '';
  const currentUploadId = queryUploadId || activeUploadId || '';

  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [mappingItems, setMappingItems] = useState<MappingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [transforming, setTransforming] = useState(false);
  const [error, setError] = useState('');
  const [transformError, setTransformError] = useState<{ reason: string; mappedCount: number } | null>(null);
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCodeField, setEditingCodeField] = useState<string | null>(null);
  const [codeBuffer, setCodeBuffer] = useState('');

  // Sync URL query param with DatasetContext
  useEffect(() => {
    if (queryUploadId && queryUploadId !== activeUploadId) {
      void selectDataset(queryUploadId);
    }
  }, [queryUploadId, activeUploadId, selectDataset]);

  const loadJobData = async () => {
    if (!currentUploadId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    setTransformError(null);

    try {
      const [jobResp, mappingResp] = await Promise.all([
        api.get(`/imports/${currentUploadId}`),
        api.get(`/imports/${currentUploadId}/mapping`).catch(() => ({ data: { mapping: {} } }))
      ]);

      const job = jobResp.data.job;
      const cols: string[] = job.columns || [];
      setAvailableColumns(cols);

      const savedMapping = mappingResp.data.mapping || job.mapping || {};

      // Initialize mapping items based on canonical targets and dataset columns
      const initialItems: MappingItem[] = canonicalTargets.map((target) => {
        const savedEntry = savedMapping[target.key];
        let sourceField = '';
        let transformCode: string | undefined = undefined;
        let enabled = false;

        if (savedEntry) {
          if (typeof savedEntry === 'string') {
            sourceField = savedEntry;
            enabled = true;
          } else if (typeof savedEntry === 'object' && savedEntry.source) {
            sourceField = savedEntry.source;
            transformCode = savedEntry.transformCode;
            enabled = true;
          }
        } else {
          // Auto-match exact name
          const exactMatch = cols.find((c) => c.toLowerCase() === target.key.toLowerCase());
          if (exactMatch) {
            sourceField = exactMatch;
            enabled = true;
          }
        }

        return {
          target: target.key,
          source: sourceField,
          enabled,
          transformCode
        };
      });

      setMappingItems(initialItems);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load mapping schema.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadJobData();
  }, [currentUploadId]);

  const handleSourceChange = (targetKey: string, sourceCol: string) => {
    setMappingItems((prev) =>
      prev.map((item) =>
        item.target === targetKey
          ? { ...item, source: sourceCol, enabled: Boolean(sourceCol) }
          : item
      )
    );
  };

  const handleToggleEnabled = (targetKey: string) => {
    setMappingItems((prev) =>
      prev.map((item) =>
        item.target === targetKey ? { ...item, enabled: !item.enabled } : item
      )
    );
  };

  const handleAutoMap = () => {
    setMappingItems((prev) =>
      prev.map((item) => {
        const match = availableColumns.find((c) => c.toLowerCase() === item.target.toLowerCase());
        return match ? { ...item, source: match, enabled: true } : item;
      })
    );
    setMessage('Auto-mapped matching schema columns.');
  };

  const handleSelectAll = (check: boolean) => {
    setMappingItems((prev) => prev.map((item) => ({ ...item, enabled: check && Boolean(item.source) })));
  };

  const saveMapping = async () => {
    if (!currentUploadId) return;
    setSaving(true);
    setError('');
    setMessage('');

    const mappingPayload = mappingItems
      .filter((item) => item.enabled && item.source)
      .reduce((acc, item) => {
        acc[item.target] = item.transformCode
          ? { source: item.source, transformCode: item.transformCode }
          : item.source;
        return acc;
      }, {} as Record<string, any>);

    try {
      await api.post(`/imports/${currentUploadId}/mapping`, { mapping: mappingPayload });
      setMessage('Mapping configuration saved successfully.');
      await refreshActiveDataset();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Unable to save mapping configuration.');
    } finally {
      setSaving(false);
    }
  };

  const handleRunTransformation = async () => {
    if (!currentUploadId) return;
    setTransforming(true);
    setError('');
    setTransformError(null);
    setMessage('');

    // First ensure mapping is saved
    const mappingPayload = mappingItems
      .filter((item) => item.enabled && item.source)
      .reduce((acc, item) => {
        acc[item.target] = item.transformCode
          ? { source: item.source, transformCode: item.transformCode }
          : item.source;
        return acc;
      }, {} as Record<string, any>);

    try {
      await api.post(`/imports/${currentUploadId}/mapping`, { mapping: mappingPayload });
      const resp = await api.post(`/imports/${currentUploadId}/transform`);

      const failedCount = resp.data.failedRows || 0;
      const sandboxErrors = resp.data.sandboxErrors || [];

      if (sandboxErrors.length > 0 && failedCount === resp.data.transformedCount) {
        setTransformError({
          reason: sandboxErrors[0] || 'Unknown transformation error occurred.',
          mappedCount: mappingItems.filter((i) => i.enabled).length
        });
      } else {
        setMessage(`Transformation complete (${resp.data.transformedCount?.toLocaleString()} rows processed).`);
        await refreshActiveDataset();
        navigate(`/preview?uploadId=${currentUploadId}`);
      }
    } catch (err: any) {
      const mappedCount = mappingItems.filter((i) => i.enabled).length;
      const backendError = err?.response?.data?.message || err?.response?.data?.error || 'Additional error details are not available.';
      setTransformError({
        reason: backendError,
        mappedCount
      });
    } finally {
      setTransforming(false);
    }
  };

  const openCodeModal = (targetKey: string) => {
    const item = mappingItems.find((i) => i.target === targetKey);
    setEditingCodeField(targetKey);
    setCodeBuffer(item?.transformCode || `// Example: uppercase string or parse number\nreturn String(value).toUpperCase();`);
  };

  const saveCustomCode = () => {
    if (!editingCodeField) return;
    setMappingItems((prev) =>
      prev.map((item) =>
        item.target === editingCodeField ? { ...item, transformCode: codeBuffer } : item
      )
    );
    setEditingCodeField(null);
  };

  const filteredItems = useMemo(() => {
    return mappingItems.filter((item) => {
      const matchTarget = item.target.toLowerCase().includes(searchQuery.toLowerCase());
      const matchSource = item.source.toLowerCase().includes(searchQuery.toLowerCase());
      return matchTarget || matchSource;
    });
  }, [mappingItems, searchQuery]);

  const enabledCount = mappingItems.filter((i) => i.enabled).length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="saas-card p-6 sm:p-8 bg-gradient-to-r from-theme-surface via-theme-surface-soft to-theme-surface-blue">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-theme-surface-blue border border-theme-border-strong text-theme-primary text-xs font-semibold uppercase tracking-wider mb-2">
              <Sparkles size={13} />
              <span>ETL Schema Mapping</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-theme-text-primary">
              Mapping Studio
            </h1>
            <p className="mt-1 text-sm text-theme-text-secondary">
              Map dataset fields to destination schema and apply isolated JavaScript expressions.
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
          </div>
        </div>
      </div>

      {/* Success Notification */}
      {message && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs sm:text-sm flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600" />
          <span>{message}</span>
        </div>
      )}

      {/* Generic Error */}
      {error && !transformError && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs sm:text-sm flex items-center gap-2">
          <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Comprehensive Transformation Error Card (Item 10) */}
      {transformError && (
        <div className="saas-card p-6 border-rose-300 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/20">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/50 text-rose-600 flex items-center justify-center font-bold flex-shrink-0">
              <AlertCircle size={22} />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-rose-900 dark:text-rose-200">Transformation failed</h3>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-theme-surface border border-theme-border">
                  <span className="text-theme-text-muted block text-[11px]">Dataset</span>
                  <span className="font-semibold text-theme-text-primary">{activeJob?.fileName || 'Active Dataset'}</span>
                </div>
                <div className="p-3 rounded-lg bg-theme-surface border border-theme-border">
                  <span className="text-theme-text-muted block text-[11px]">Stage</span>
                  <span className="font-semibold text-rose-600">Transformation</span>
                </div>
                <div className="p-3 rounded-lg bg-theme-surface border border-theme-border">
                  <span className="text-theme-text-muted block text-[11px]">Mapping</span>
                  <span className="font-semibold text-theme-text-primary">{transformError.mappedCount} / {canonicalTargets.length}</span>
                </div>
              </div>

              <div className="mt-3 p-3 rounded-lg bg-theme-surface border border-theme-border text-xs">
                <span className="text-theme-text-muted block text-[11px] font-bold uppercase tracking-wider">Reason</span>
                <p className="mt-1 font-mono text-rose-600 dark:text-rose-400 break-words">{transformError.reason}</p>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setTransformError(null)}
                  className="btn-secondary text-xs py-2 px-4 rounded-xl"
                >
                  Review Mapping
                </button>
                <button
                  type="button"
                  onClick={handleRunTransformation}
                  disabled={transforming}
                  className="btn-primary text-xs py-2 px-4 rounded-xl flex items-center gap-1.5"
                >
                  <RotateCw size={13} />
                  <span>Retry Transformation</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="saas-card p-12 text-center">
          <RotateCw size={32} className="mx-auto text-theme-primary animate-spin mb-3" />
          <h3 className="text-base font-bold text-theme-text-primary">Loading Dataset Schema...</h3>
          <p className="text-xs text-theme-text-muted mt-1">Preparing mapping studio for the active dataset.</p>
        </div>
      )}

      {/* Empty State: No Dataset Selected */}
      {!currentUploadId && !loading && (
        <div className="saas-card p-12 text-center">
          <Layers size={36} className="mx-auto text-theme-text-muted mb-3 opacity-60" />
          <h3 className="text-base font-bold text-theme-text-primary">No Dataset Selected</h3>
          <p className="text-xs text-theme-text-muted mt-1 max-w-sm mx-auto">
            Select a dataset from the dropdown above to bind fields to the canonical schema.
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

      {/* Mapping Studio Main Workspace */}
      {currentUploadId && (
        <div className="saas-card overflow-hidden">
          {/* Studio Header Toolbar */}
          <div className="p-4 sm:p-5 border-b border-theme-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-theme-surface-soft">
            <div className="flex items-center gap-3 flex-1 max-w-md">
              <div className="relative w-full">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-text-muted" />
                <input
                  type="text"
                  placeholder="Filter mapping fields..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="saas-input w-full pl-9 py-1.5 text-xs"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleAutoMap}
                className="btn-secondary text-xs py-1.5 px-3 rounded-lg flex items-center gap-1.5"
              >
                <Sparkles size={13} className="text-theme-primary" />
                <span>Auto Match</span>
              </button>
              <button
                type="button"
                onClick={saveMapping}
                disabled={saving}
                className="btn-secondary text-xs py-1.5 px-4 rounded-lg flex items-center gap-1.5"
              >
                <Check size={13} />
                <span>{saving ? 'Saving...' : 'Save Mapping'}</span>
              </button>
              <button
                type="button"
                onClick={handleRunTransformation}
                disabled={transforming}
                className="btn-primary text-xs py-1.5 px-4 rounded-lg flex items-center gap-1.5"
              >
                <Play size={13} />
                <span>{transforming ? 'Transforming...' : 'Run Transformation'}</span>
              </button>
            </div>
          </div>

          {/* Mapping Grid Header */}
          <div className="grid grid-cols-12 gap-3 px-5 py-3 bg-theme-surface-soft border-b border-theme-border text-[11px] font-bold uppercase tracking-wider text-theme-text-muted">
            <div className="col-span-1 flex items-center gap-2">
              <input
                type="checkbox"
                checked={enabledCount === canonicalTargets.length}
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="rounded border-theme-border cursor-pointer"
              />
              <span>Use</span>
            </div>
            <div className="col-span-4">Target Canonical Field</div>
            <div className="col-span-5">Source Dataset Column</div>
            <div className="col-span-2 text-right">Transform Code</div>
          </div>

          {/* Mapping Rows */}
          <div className="divide-y divide-theme-border">
            {filteredItems.map((item) => {
              const targetMeta = canonicalTargets.find((t) => t.key === item.target);
              return (
                <div
                  key={item.target}
                  className={`grid grid-cols-12 gap-3 px-5 py-3.5 items-center transition ${item.enabled ? 'bg-theme-surface hover:bg-theme-surface-soft' : 'bg-theme-surface/50 opacity-60'
                    }`}
                >
                  <div className="col-span-1">
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={() => handleToggleEnabled(item.target)}
                      className="rounded border-theme-border cursor-pointer"
                    />
                  </div>

                  <div className="col-span-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-theme-text-primary">{item.target}</span>
                      {targetMeta?.required && (
                        <span className="text-[10px] text-rose-500 font-bold">*Required</span>
                      )}
                    </div>
                    <p className="text-[11px] text-theme-text-muted mt-0.5">{targetMeta?.label} ({targetMeta?.type})</p>
                  </div>

                  <div className="col-span-5">
                    <select
                      value={item.source}
                      onChange={(e) => handleSourceChange(item.target, e.target.value)}
                      className="saas-input w-full text-xs py-1.5 px-3"
                    >
                      <option value="">— Select Source Column —</option>
                      {availableColumns.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2 text-right">
                    <button
                      type="button"
                      onClick={() => openCodeModal(item.target)}
                      className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border transition ${item.transformCode
                          ? 'bg-theme-surface-blue border-theme-border-strong text-theme-primary font-semibold'
                          : 'bg-theme-surface border-theme-border text-theme-text-muted hover:text-theme-text-primary'
                        }`}
                    >
                      <Code size={13} />
                      <span>{item.transformCode ? 'V8 Active' : '+ Code'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* V8 Transform Code Editor Drawer / Modal */}
      {editingCodeField && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="saas-card max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-theme-border pb-3">
              <div>
                <h3 className="text-base font-bold text-theme-text-primary">
                  V8 Transform: {editingCodeField}
                </h3>
                <p className="text-xs text-theme-text-muted">
                  JavaScript function executed per-row. Available arguments: <code className="text-theme-primary">value</code> and <code className="text-theme-primary">row</code>.
                </p>
              </div>
            </div>

            <textarea
              rows={6}
              value={codeBuffer}
              onChange={(e) => setCodeBuffer(e.target.value)}
              className="saas-input w-full font-mono text-xs p-3 leading-relaxed"
              placeholder="// return value.trim().toLowerCase();"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingCodeField(null)}
                className="btn-secondary text-xs py-2 px-4 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveCustomCode}
                className="btn-primary text-xs py-2 px-5 rounded-xl"
              >
                Apply Expression
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MappingPage;
