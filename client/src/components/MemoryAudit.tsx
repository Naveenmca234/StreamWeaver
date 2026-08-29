import { useEffect, useState } from 'react';
import { Activity, CheckCircle2, AlertTriangle, Cpu } from 'lucide-react';

type Audit = {
  summary: { peakRss: number; peakHeap: number; avgRss: number; avgHeap: number; samples: number };
  memoryLimitMB: number;
  peakRssMB: number;
  pass: boolean;
};

export default function MemoryAudit({ uploadId }: { uploadId: string }) {
  const [audit, setAudit] = useState<Audit | null>(null);
  const [loading, setLoading] = useState(false);
  const [jobStatus, setJobStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!uploadId) return;
    let mounted = true;
    setLoading(true);

    fetch(`/api/imports/${uploadId}`).then((r) => r.json()).then((data) => {
      if (!mounted) return;
      const job = data.job as any;
      setJobStatus(job?.status ?? null);
      if (job?.status === 'completed') {
        return fetch(`/api/imports/${uploadId}/audit`).then((r) => r.json()).then((auditData) => {
          if (!mounted) return;
          setAudit(auditData);
        });
      }
    }).catch(() => {
      // ignore
    }).finally(() => {
      if (mounted) setLoading(false);
    });

    return () => { mounted = false; };
  }, [uploadId]);

  if (!uploadId) return null;
  if (loading) {
    return (
      <div className="p-3 rounded-xl bg-theme-surface-soft border border-theme-border text-xs text-theme-text-muted flex items-center gap-2">
        <div className="w-3.5 h-3.5 border-2 border-theme-primary border-t-transparent rounded-full animate-spin" />
        <span>Loading memory profile...</span>
      </div>
    );
  }

  if (!audit) {
    if (jobStatus && jobStatus !== 'completed') {
      return (
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs flex items-center gap-2">
          <Activity size={14} className="animate-pulse text-amber-600" />
          <span>Memory audit pending — pipeline status: <strong className="capitalize">{jobStatus}</strong></span>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="p-4 rounded-xl bg-theme-surface border border-theme-border shadow-xs">
      <div className="flex items-center justify-between pb-3 border-b border-theme-border">
        <div className="flex items-center gap-2">
          <Cpu size={16} className="text-theme-primary" />
          <span className="text-xs font-bold text-theme-text-primary uppercase tracking-wider">
            Streaming Memory Audit
          </span>
        </div>
        <span
          className={`px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 ${
            audit.pass
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
              : 'bg-rose-50 text-rose-700 border border-rose-200'
          }`}
        >
          {audit.pass ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
          {audit.pass ? 'PASS (<150MB Limit)' : 'FAIL (Limit Exceeded)'}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div>
          <span className="text-[11px] text-theme-text-muted uppercase">Peak RSS</span>
          <p className="font-bold text-theme-text-primary mt-0.5">
            {(audit.summary.peakRss / 1024 / 1024).toFixed(1)} MB
          </p>
        </div>
        <div>
          <span className="text-[11px] text-theme-text-muted uppercase">Avg RSS</span>
          <p className="font-bold text-theme-text-primary mt-0.5">
            {(audit.summary.avgRss / 1024 / 1024).toFixed(1)} MB
          </p>
        </div>
        <div>
          <span className="text-[11px] text-theme-text-muted uppercase">Samples</span>
          <p className="font-bold text-theme-text-primary mt-0.5">{audit.summary.samples}</p>
        </div>
        <div>
          <span className="text-[11px] text-theme-text-muted uppercase">Memory Budget</span>
          <p className="font-bold text-theme-primary mt-0.5">{audit.memoryLimitMB} MB</p>
        </div>
      </div>

      {Array.isArray((audit as any).samples) && (audit as any).samples.length > 0 && (
        <div className="mt-3 pt-2 border-t border-theme-border">
          <svg viewBox="0 0 100 20" className="w-full h-7">
            {(() => {
              const samplesArr = (audit as any).samples as any[];
              const vals = samplesArr.map((s: any) => s.rss / 1024 / 1024);
              const min = Math.min(...vals);
              const max = Math.max(...vals) || 1;
              const points = vals.map((v, i) => `${(i / Math.max(vals.length - 1, 1)) * 100},${20 - ((v - min) / (max - min)) * 18}`).join(' ');
              return <polyline fill="none" stroke="var(--primary)" strokeWidth={2} points={points} />;
            })()}
          </svg>
        </div>
      )}
    </div>
  );
}
