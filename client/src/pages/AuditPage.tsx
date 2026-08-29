import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Sparkles, Cpu, Database, CheckCircle2, ArrowRight } from 'lucide-react';
import api from '../services/api';
import MemoryAudit from '../components/MemoryAudit';

const AuditPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const uploadId = searchParams.get('uploadId') ?? '';
  const [job, setJob] = useState<any | null>(null);

  useEffect(() => {
    if (!uploadId) return;
    api.get(`/imports/${uploadId}`).then((r) => setJob(r.data.job)).catch(() => setJob(null));
  }, [uploadId]);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header Banner */}
      <div className="saas-card p-6 sm:p-8 bg-gradient-to-r from-theme-surface via-theme-surface-soft to-theme-surface-blue">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-theme-surface-blue border border-theme-border-strong text-theme-primary text-xs font-semibold uppercase tracking-wider mb-2">
          <Sparkles size={13} />
          <span>Diagnostics</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-theme-text-primary">
          Memory & Pipeline Audit
        </h1>
        <p className="mt-1 text-sm text-theme-text-secondary">
          Deep-dive inspection into RSS memory consumption and resource utilization for streaming jobs.
        </p>
      </div>

      {uploadId ? (
        <div className="space-y-6">
          <MemoryAudit uploadId={uploadId} />

          {job && (
            <div className="saas-card p-6">
              <h3 className="text-sm font-bold text-theme-text-primary mb-3">Job Details</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                <div className="p-3 rounded-xl bg-theme-surface-soft border border-theme-border">
                  <span className="text-[11px] text-theme-text-muted">Dataset</span>
                  <p className="font-semibold text-theme-text-primary mt-0.5 truncate">{job.fileName}</p>
                </div>
                <div className="p-3 rounded-xl bg-theme-surface-soft border border-theme-border">
                  <span className="text-[11px] text-theme-text-muted">Status</span>
                  <p className="font-semibold text-emerald-600 capitalize mt-0.5">{job.status}</p>
                </div>
                <div className="p-3 rounded-xl bg-theme-surface-soft border border-theme-border">
                  <span className="text-[11px] text-theme-text-muted">Total Records</span>
                  <p className="font-semibold text-theme-text-primary mt-0.5">{(job.totalRows || 0).toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="saas-card p-12 text-center">
          <Cpu size={36} className="mx-auto text-theme-text-muted mb-3 opacity-60" />
          <h3 className="text-base font-bold text-theme-text-primary">No Upload ID Specified</h3>
          <p className="text-xs text-theme-text-muted mt-1 max-w-sm mx-auto">
            Select a dataset from Import History to audit its runtime memory performance.
          </p>
          <button
            type="button"
            onClick={() => navigate('/history')}
            className="btn-primary text-xs mt-4 py-2 px-4 rounded-xl"
          >
            View Import History
          </button>
        </div>
      )}
    </div>
  );
};

export default AuditPage;
