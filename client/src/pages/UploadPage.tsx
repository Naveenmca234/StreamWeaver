import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import {
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  FileText,
  Activity,
  Zap,
  ArrowRight,
  Layers,
  FileSearch,
  Sparkles,
  FileSpreadsheet,
  RotateCw
} from 'lucide-react';
import api from '../services/api';
import uploadFile from '../services/uploadService';
import { joinRoom, onImportProgress } from '../services/socket';
import { useDataset } from '../contexts/DatasetContext';

const UploadPage = () => {
  const navigate = useNavigate();
  const { activeJob, profile: activeProfile, registerNewUpload, selectDataset } = useDataset();

  const [fileName, setFileName] = useState('');
  const [uploadId, setUploadId] = useState('');
  const [totalRows, setTotalRows] = useState<number | null>(null);
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [profiling, setProfiling] = useState(false);
  const [savingColumns, setSavingColumns] = useState(false);

  const [progress, setProgress] = useState(0);
  const [rowsProcessed, setRowsProcessed] = useState(0);
  const [rowsFailed, setRowsFailed] = useState(0);
  const [rowsPerSecond, setRowsPerSecond] = useState(0);

  const clientUploadIdRef = useRef('');
  const isUploadingRef = useRef(false);
  const displayProfile = profile || (activeJob?.uploadId === uploadId ? (activeJob?.profile || activeProfile) : activeProfile);

  // Sync with activeJob and activeProfile from context when not uploading
  useEffect(() => {
    if (isUploadingRef.current || loading) return;

    if (activeJob) {
      if (!uploadId || activeJob.uploadId === uploadId) {
        setFileName(activeJob.fileName);
        if (!uploadId) setUploadId(activeJob.uploadId);
        setTotalRows(activeJob.totalRows);
        setAvailableColumns(activeJob.columns || []);
        setSelectedColumns(activeJob.selectedColumns || activeJob.columns || []);
        setProgress(100);
        if (activeJob.profile) {
          setProfile(activeJob.profile);
        } else if (activeProfile) {
          setProfile(activeProfile);
        }
      }
    }
  }, [activeJob, activeProfile, loading, uploadId]);

  useEffect(() => {
    const unsubscribe = onImportProgress((payload) => {
      if (payload.uploadId !== clientUploadIdRef.current) return;
      setProgress(payload.progress ?? 0);
      setRowsProcessed(payload.rowsProcessed ?? 0);
      setRowsFailed(payload.rowsFailed ?? 0);
      setRowsPerSecond(payload.rowsPerSecond ?? 0);
      if ((payload.progress ?? 0) >= 100) {
        setProfiling(true);
      }
    });
    return unsubscribe;
  }, []);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!acceptedFiles.length) return;
    const file = acceptedFiles[0];
    setError('');

    if (!['text/csv', 'application/json', 'application/octet-stream'].includes(file.type) && !/\.(csv|json)$/i.test(file.name)) {
      setError('Only CSV and JSON files are supported.');
      return;
    }

    const clientUploadId = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    clientUploadIdRef.current = clientUploadId;

    setFileName(file.name);
    setUploadId(clientUploadId);
    setTotalRows(null);
    setAvailableColumns([]);
    setSelectedColumns([]);
    setProfile(null);
    setProgress(0);
    setRowsProcessed(0);
    setRowsFailed(0);
    setRowsPerSecond(0);
    setError('');
    setLoading(true);
    setProfiling(false);
    isUploadingRef.current = true;

    joinRoom(clientUploadId);

    try {
      const response = await uploadFile(file, clientUploadId);
      const uploadPreview = response.preview ?? [];
      const id = response.uploadId ?? clientUploadId;
      const columns = response.columns ?? Array.from(new Set(uploadPreview.flatMap(Object.keys)));
      const parsedTotal = response.total ?? response.totalRows ?? null;

      setFileName(response.fileName || file.name);
      setUploadId(id);
      setTotalRows(parsedTotal);
      setAvailableColumns(columns);
      setSelectedColumns(columns);
      setProgress(100);

      // 1. Check if backend directly included the computed profile
      let profData = response.profile || null;

      // 2. If not provided in response, fetch it
      if (!profData) {
        setProfiling(true);
        try {
          const profileResponse = await api.get('/profiling', { params: { uploadId: id } });
          profData = profileResponse.data.profile;
        } catch (profErr) {
          console.warn('Profiling fetch note:', profErr);
        }
      }

      // 3. Immediately update React state on the current page
      if (profData) {
        setProfile(profData);
      }

      // 4. Persist as active dataset across entire workspace immediately
      registerNewUpload(id, response.fileName || file.name, parsedTotal || 0, columns, profData);
    } catch (err: any) {
      if (clientUploadId !== clientUploadIdRef.current) return;
      const errorMsg = err?.response?.data?.message || err?.message || 'Upload failed. Please try again.';
      console.error('Upload page error:', err);
      setError(errorMsg);
    } finally {
      if (clientUploadId === clientUploadIdRef.current) {
        isUploadingRef.current = false;
        setLoading(false);
        setProfiling(false);
      }
    }
  }, [registerNewUpload]);

  const continueToMapping = async () => {
    const colsToSave = selectedColumns.length ? selectedColumns : availableColumns;
    if (!colsToSave.length) {
      setError('Select at least one column before continuing.');
      return;
    }

    if (uploadId) {
      setSavingColumns(true);
      try {
        await api.patch(`/imports/${uploadId}/columns`, { selectedColumns: colsToSave });
        await selectDataset(uploadId);
        navigate(`/mapping?uploadId=${uploadId}`);
      } catch {
        setError('Unable to save selected columns.');
      } finally {
        setSavingColumns(false);
      }
    }
  };

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    multiple: false,
    accept: { 'text/csv': ['.csv'], 'application/json': ['.json'] }
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="saas-card p-6 sm:p-8 bg-gradient-to-r from-theme-surface via-theme-surface-soft to-theme-surface-blue">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-theme-surface-blue border border-theme-border-strong text-theme-primary text-xs font-semibold uppercase tracking-wider mb-2">
              <Sparkles size={13} />
              <span>Data Ingestion</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-theme-text-primary">
              Upload Dataset
            </h1>
            <p className="mt-1 text-sm text-theme-text-secondary">
              High-speed streaming data ingestion with live parsing and immediate schema profiling.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="btn-secondary text-xs py-2 px-4 rounded-xl self-start sm:self-auto"
          >
            Back to Dashboard
          </button>
        </div>
      </div>

      {/* Main Upload Dropzone Card */}
      <div className="saas-card p-6 sm:p-8">
        <div
          {...getRootProps()}
          className={`min-h-[260px] rounded-2xl border-2 border-dashed p-8 sm:p-12 text-center transition-all cursor-pointer flex flex-col items-center justify-center ${isDragActive
              ? 'border-theme-primary bg-theme-surface-blue scale-[0.99]'
              : 'border-theme-border-strong bg-theme-surface-soft hover:bg-theme-surface-blue/50 hover:border-theme-primary'
            }`}
        >
          <input {...getInputProps()} />
          <div className="w-16 h-16 rounded-2xl bg-theme-surface-blue border border-theme-border-strong text-theme-primary flex items-center justify-center mb-4 shadow-sm">
            <UploadCloud size={32} />
          </div>
          <p className="text-lg font-bold text-theme-text-primary">
            {isDragActive ? 'Drop your dataset file here...' : 'Drag & drop your dataset file here'}
          </p>
          <p className="mt-2 text-xs sm:text-sm text-theme-text-muted max-w-md">
            Supports CSV and JSON formats up to 5GB. Streamed directly to local database memory.
          </p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              open();
            }}
            className="btn-primary text-xs mt-6 py-2.5 px-6 rounded-xl"
          >
            Choose File from Computer
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mt-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs sm:text-sm flex items-center gap-3">
            <AlertCircle size={18} className="flex-shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Live Upload & Stream Progress */}
        {(loading || rowsProcessed > 0) && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Status Card */}
            <div className="saas-card p-5 bg-theme-surface-soft">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-theme-text-muted">Live Ingestion Status</span>
                <span className="text-xs font-semibold text-theme-primary">{progress}%</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-theme-surface-blue border border-theme-border-strong flex items-center justify-center text-theme-primary font-bold text-base">
                  {progress}%
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-theme-text-muted">Current File</p>
                  <p className="text-sm font-bold text-theme-text-primary truncate">{fileName || 'Ingesting stream...'}</p>
                </div>
              </div>
              <div className="mt-4 w-full h-2 rounded-full bg-theme-border overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-theme-primary to-cyan-400 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Performance Stats */}
            <div className="saas-card p-5 bg-theme-surface-soft">
              <span className="text-xs font-bold uppercase tracking-wider text-theme-text-muted block mb-3">Ingestion Throughput</span>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-theme-surface border border-theme-border">
                  <p className="text-[11px] text-theme-text-muted">Processed</p>
                  <p className="text-sm font-bold text-theme-text-primary mt-0.5">{rowsProcessed.toLocaleString()}</p>
                </div>
                <div className="p-2.5 rounded-xl bg-theme-surface border border-theme-border">
                  <p className="text-[11px] text-theme-text-muted">Throughput</p>
                  <p className="text-sm font-bold text-theme-primary mt-0.5">{rowsPerSecond.toLocaleString()} <span className="text-[10px]">r/s</span></p>
                </div>
                <div className="p-2.5 rounded-xl bg-theme-surface border border-theme-border">
                  <p className="text-[11px] text-theme-text-muted">Flags</p>
                  <p className="text-sm font-bold text-amber-600 mt-0.5">{rowsFailed.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dataset Summary Cards (Populated after successful ingestion or from active dataset) */}
        {(fileName && (displayProfile || loading || profiling || totalRows !== null)) && (
          <div className="mt-6 space-y-6">
            <div className="saas-card p-6 border border-theme-border-strong">
              <div className="flex items-center justify-between pb-4 border-b border-theme-border">
                <div>
                  <h2 className="text-base font-bold text-theme-text-primary">Dataset Schema & Quality Profile</h2>
                  <p className="text-xs text-theme-text-muted mt-0.5">Persisted workspace dataset: <strong className="text-theme-primary">{fileName}</strong></p>
                </div>
                {displayProfile ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs font-semibold">
                    <CheckCircle2 size={13} />
                    <span>Profile Ready</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-theme-surface-blue text-theme-primary border border-theme-border-strong text-xs font-semibold">
                    <RotateCw size={13} className="animate-spin text-theme-primary" />
                    <span>Profiling dataset...</span>
                  </div>
                )}
              </div>

              {/* 8 Compact Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-5">
                <div className="saas-card p-4 bg-theme-surface-soft">
                  <p className="text-xs text-theme-text-muted font-medium">Total Rows</p>
                  <p className="text-xl font-bold text-theme-text-primary mt-1">
                    {(displayProfile?.totalRows ?? totalRows ?? (rowsProcessed || 0)).toLocaleString()}
                  </p>
                </div>
                <div className="saas-card p-4 bg-theme-surface-soft">
                  <p className="text-xs text-theme-text-muted font-medium">Total Columns</p>
                  <p className="text-xl font-bold text-theme-text-primary mt-1">
                    {displayProfile?.totalColumns ?? (availableColumns.length || '—')}
                  </p>
                </div>
                <div className="saas-card p-4 bg-theme-surface-soft">
                  <p className="text-xs text-theme-text-muted font-medium">Missing Values</p>
                  <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                    {displayProfile?.totalMissingValues != null ? displayProfile.totalMissingValues.toLocaleString() : '—'}
                  </p>
                </div>
                <div className="saas-card p-4 bg-theme-surface-soft">
                  <p className="text-xs text-theme-text-muted font-medium">Duplicate Rows</p>
                  <p className="text-xl font-bold text-theme-text-primary mt-1">
                    {displayProfile?.totalDuplicateRows != null ? displayProfile.totalDuplicateRows.toLocaleString() : '—'}
                  </p>
                </div>
                <div className="saas-card p-4 bg-theme-surface-soft">
                  <p className="text-xs text-theme-text-muted font-medium">Numeric Columns</p>
                  <p className="text-xl font-bold text-theme-text-primary mt-1">
                    {displayProfile?.numberNumericColumns != null ? displayProfile.numberNumericColumns : '—'}
                  </p>
                </div>
                <div className="saas-card p-4 bg-theme-surface-soft">
                  <p className="text-xs text-theme-text-muted font-medium">Text Columns</p>
                  <p className="text-xl font-bold text-theme-text-primary mt-1">
                    {displayProfile?.numberTextColumns != null ? displayProfile.numberTextColumns : '—'}
                  </p>
                </div>
                <div className="saas-card p-4 bg-theme-surface-soft">
                  <p className="text-xs text-theme-text-muted font-medium">Date Columns</p>
                  <p className="text-xl font-bold text-theme-text-primary mt-1">
                    {displayProfile?.numberDateColumns != null ? displayProfile.numberDateColumns : '—'}
                  </p>
                </div>
                <div className="saas-card p-4 bg-theme-surface-blue border-theme-border-strong">
                  <p className="text-xs text-theme-primary font-bold">Quality Score</p>
                  <p className="text-xl font-bold text-theme-primary mt-1">
                    {displayProfile?.qualityScore != null ? `${displayProfile.qualityScore}%` : '100%'}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 pt-5 border-t border-theme-border flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    if (uploadId) {
                      await selectDataset(uploadId);
                      navigate(`/cleaning?uploadId=${uploadId}`);
                    }
                  }}
                  disabled={!displayProfile && (loading || profiling)}
                  className="btn-secondary text-xs py-2.5 px-4 rounded-xl flex items-center gap-2 disabled:opacity-50"
                >
                  <FileSearch size={15} />
                  <span>Review Missing Data</span>
                </button>
                <button
                  type="button"
                  onClick={continueToMapping}
                  disabled={savingColumns || (!profile && (loading || profiling))}
                  className="btn-primary text-xs py-2.5 px-5 rounded-xl flex items-center gap-2 ml-auto disabled:opacity-50"
                >
                  <span>{savingColumns ? 'Saving schema...' : 'Continue to Mapping'}</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadPage;
