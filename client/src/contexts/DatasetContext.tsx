import React, { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

export interface PipelineStage {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startedAt?: string;
  finishedAt?: string;
  error?: string;
  count?: number;
}

export interface ImportJob {
  uploadId: string;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalRows: number;
  failedRows: number;
  fileSize?: number;
  columns?: string[];
  selectedColumns?: string[];
  mapping?: Record<string, any>;
  cleaningStrategies?: Record<string, { strategy: string; fillValue?: string }>;
  stages?: {
    ingestion?: PipelineStage;
    cleaning?: PipelineStage;
    mapping?: PipelineStage;
    transformation?: PipelineStage;
    validation?: PipelineStage;
  };
  profile?: DatasetProfile | any;
  errorMessage?: string;
  transformedAt?: string;
  importedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DatasetProfile {
  totalRows: number;
  totalColumns: number;
  totalMissingValues: number;
  totalDuplicateRows: number;
  numberNumericColumns: number;
  numberTextColumns: number;
  numberDateColumns: number;
  datasetSize: number;
  qualityScore: number;
  rowsWithMissingData: number;
  completeRows: number;
  missingDataPercentage: number;
  qualityBreakdown?: {
    completeness: number;
    validity: number;
    uniqueness: number;
    consistency: number;
  };
  columns?: any[];
}

export interface SelectableDataset {
  uploadId: string;
  fileName: string;
  totalRows: number;
  status: string;
  createdAt: string;
  label: string;
  isLatest: boolean;
  version?: number;
}

export const computeSelectableDatasets = (jobs: ImportJob[], _activeId: string | null): SelectableDataset[] => {
  if (!jobs.length) return [];

  return jobs.map((job, idx) => {
    const timeStr = new Date(job.createdAt).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    const shortId = job.uploadId.slice(0, 8);
    const rowsStr = (job.totalRows || 0).toLocaleString();
    return {
      uploadId: job.uploadId,
      fileName: job.fileName,
      totalRows: job.totalRows || 0,
      status: job.status,
      createdAt: job.createdAt,
      label: `${job.fileName} (${rowsStr} rows • ${timeStr} • #${shortId})`,
      isLatest: idx === 0,
      version: jobs.length - idx
    };
  });
};

export interface DashboardStats {
  registeredDatasets: number;
  totalPersistedRows: number;
  totalHistoricalRows: number;
  hasPersistedRows: boolean;
}

interface DatasetContextType {
  activeUploadId: string | null;
  activeJob: ImportJob | null;
  allJobs: ImportJob[];
  datasets: SelectableDataset[];
  profile: DatasetProfile | null;
  dashboardStats: DashboardStats | null;
  loading: boolean;
  profileLoading: boolean;
  error: string | null;
  selectDataset: (uploadId: string | null) => Promise<void>;
  refreshDatasets: () => Promise<void>;
  refreshActiveDataset: () => Promise<void>;
  registerNewUpload: (uploadId: string, fileName: string, totalRows?: number, columns?: string[], profileData?: any) => void;
  deleteDataset: (uploadId: string) => Promise<void>;
}

const DatasetContext = createContext<DatasetContextType | undefined>(undefined);

const STORAGE_KEY = 'streamweaver_active_upload_id';

export const DatasetProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [activeUploadId, setActiveUploadId] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEY) || null;
  });
  const [activeJob, setActiveJob] = useState<ImportJob | null>(null);
  const [allJobs, setAllJobs] = useState<ImportJob[]>([]);
  const [profile, setProfile] = useState<DatasetProfile | null>(null);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const datasets = React.useMemo(() => {
    return computeSelectableDatasets(allJobs, activeUploadId);
  }, [allJobs, activeUploadId]);

  // Load dataset profile for activeUploadId
  const loadProfile = useCallback(async (id: string) => {
    if (!id) {
      setProfile(null);
      return;
    }
    setProfileLoading(true);
    try {
      const resp = await api.get('/profiling', { params: { uploadId: id } });
      setProfile(resp.data.profile ?? null);
    } catch {
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  // Fetch all import jobs from backend
  const refreshDatasets = useCallback(async () => {
    if (!user) {
      setAllJobs([]);
      setActiveJob(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      let targetId = activeUploadId;
      const dashResp = await api.get('/dashboard', { params: { uploadId: targetId || undefined } });
      const dashData = dashResp.data;

      setDashboardStats({
        registeredDatasets: dashData.registeredDatasets,
        totalPersistedRows: dashData.totalPersistedRows,
        totalHistoricalRows: dashData.totalHistoricalRows,
        hasPersistedRows: Boolean(dashData.activeDataset?.hasPersistedRows)
      });

      const resp = await api.get('/imports');
      const jobs: ImportJob[] = resp.data.jobs ?? [];
      setAllJobs(jobs);

      if (dashData.activeDataset) {
        targetId = dashData.activeDataset.uploadId;
      } else if (!targetId || !jobs.some((j) => j.uploadId === targetId)) {
        targetId = jobs[0]?.uploadId || null;
      }

      if (targetId) {
        localStorage.setItem(STORAGE_KEY, targetId);
        setActiveUploadId(targetId);
        const match = jobs.find((j) => j.uploadId === targetId);
        setActiveJob(match || null);
        setProfile(dashData.profile ?? null);
      } else {
        localStorage.removeItem(STORAGE_KEY);
        setActiveUploadId(null);
        setActiveJob(null);
        setProfile(null);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load dataset list.');
    } finally {
      setLoading(false);
    }
  }, [user, activeUploadId, loadProfile]);

  // Refresh active dataset job details and profile
  const refreshActiveDataset = useCallback(async () => {
    if (!activeUploadId) return;
    try {
      const [jobResp, profileResp] = await Promise.all([
        api.get(`/imports/${activeUploadId}`),
        api.get('/profiling', { params: { uploadId: activeUploadId } }).catch(() => ({ data: { profile: null } }))
      ]);
      const job = jobResp.data.job;
      setActiveJob(job);
      setProfile(profileResp.data.profile);

      // Update in allJobs list as well
      setAllJobs((current) =>
        current.map((j) => (j.uploadId === activeUploadId ? { ...j, ...job } : j))
      );
    } catch {
      // ignore
    }
  }, [activeUploadId]);

  // Select a dataset manually
  const selectDataset = useCallback(async (id: string | null) => {
    if (!id) {
      localStorage.removeItem(STORAGE_KEY);
      setActiveUploadId(null);
      setActiveJob(null);
      setProfile(null);
      return;
    }

    localStorage.setItem(STORAGE_KEY, id);
    setActiveUploadId(id);

    const match = allJobs.find((j) => j.uploadId === id);
    if (match) {
      setActiveJob(match);
      if (match.profile) {
        setProfile(match.profile);
      }
    }

    try {
      const [jobResp, profileResp] = await Promise.all([
        api.get(`/imports/${id}`).catch(() => null),
        match?.profile ? Promise.resolve({ data: { profile: match.profile } }) : api.get('/profiling', { params: { uploadId: id } }).catch(() => ({ data: { profile: null } }))
      ]);

      if (jobResp?.data?.job) {
        setActiveJob(jobResp.data.job);
        if (jobResp.data.job.profile) {
          setProfile(jobResp.data.job.profile);
        }
      }
      if (profileResp?.data?.profile) {
        setProfile(profileResp.data.profile);
      }
    } catch {
      // ignore
    }
  }, [allJobs]);

  // Register newly uploaded dataset immediately into context
  const registerNewUpload = useCallback((
    uploadId: string,
    fileName: string,
    totalRows?: number,
    columns?: string[],
    profileData?: any
  ) => {
    const newJob: ImportJob = {
      uploadId,
      fileName,
      status: 'completed',
      totalRows: totalRows || 0,
      failedRows: 0,
      columns: columns || [],
      selectedColumns: columns || [],
      profile: profileData || null,
      stages: {
        ingestion: { status: 'completed', finishedAt: new Date().toISOString() },
        cleaning: { status: 'pending' },
        mapping: { status: 'pending' },
        transformation: { status: 'pending' },
        validation: { status: 'pending' }
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    localStorage.setItem(STORAGE_KEY, uploadId);
    setActiveUploadId(uploadId);
    setActiveJob(newJob);
    if (profileData) {
      setProfile(profileData);
    }
    setAllJobs((prev) => [newJob, ...prev.filter((j) => j.uploadId !== uploadId)]);

    void api.get('/dashboard', { params: { uploadId } }).then((dRes) => {
      if (dRes.data) {
        setDashboardStats({
          registeredDatasets: dRes.data.registeredDatasets,
          totalPersistedRows: dRes.data.totalPersistedRows,
          totalHistoricalRows: dRes.data.totalHistoricalRows,
          hasPersistedRows: Boolean(dRes.data.activeDataset?.hasPersistedRows)
        });
        if (dRes.data.profile) {
          setProfile(dRes.data.profile);
        }
      }
    }).catch(() => undefined);
  }, []);

  const deleteDataset = useCallback(async (id: string) => {
    try {
      await api.delete(`/imports/${id}`);
      setAllJobs((prev) => prev.filter((j) => j.uploadId !== id));
      if (activeUploadId === id) {
        const remaining = allJobs.filter((j) => j.uploadId !== id);
        const nextId = remaining[0]?.uploadId || null;
        await selectDataset(nextId);
      }
      void refreshDatasets();
    } catch (err: any) {
      throw new Error(err?.response?.data?.message || 'Failed to delete dataset');
    }
  }, [activeUploadId, allJobs, selectDataset, refreshDatasets]);

  useEffect(() => {
    if (user) {
      void refreshDatasets();
    }
  }, [user]);

  return (
    <DatasetContext.Provider
      value={{
        activeUploadId,
        activeJob,
        allJobs,
        datasets,
        profile,
        dashboardStats,
        loading,
        profileLoading,
        error,
        selectDataset,
        refreshDatasets,
        refreshActiveDataset,
        registerNewUpload,
        deleteDataset
      }}
    >
      {children}
    </DatasetContext.Provider>
  );
};

export const useDataset = () => {
  const context = useContext(DatasetContext);
  if (!context) {
    throw new Error('useDataset must be used within a DatasetProvider');
  }
  return context;
};
