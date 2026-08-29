import { Router, Response } from 'express';
import { requireAuth, AuthedRequest } from '../middleware/authMiddleware';
import ImportJob from '../models/ImportJob';
import UploadRow from '../models/UploadRow';
import { generateDatasetProfile } from './profilingRoutes';

const router = Router();

const createJobFilter = (email?: string, id?: string) => {
  const owners = [email, id].filter(Boolean) as string[];
  return owners.length ? { createdBy: { $in: owners } } : {};
};

router.get('/', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const owner = req.user?.email || req.user?.id;
    const filter = createJobFilter(req.user?.email, req.user?.id);
    const jobs = await ImportJob.find(filter).sort({ updatedAt: -1, createdAt: -1 }).lean();

    if (!jobs.length) {
      return res.json({
        registeredDatasets: 0,
        totalPersistedRows: 0,
        totalHistoricalRows: 0,
        activeDataset: null,
        profile: null,
        datasets: [],
        pipelineStatus: {
          ingestion: 'pending',
          cleaning: 'pending',
          mapping: 'pending',
          transformation: 'pending',
          validation: 'pending'
        }
      });
    }

    // Group jobs by fileName to find unique canonical datasets
    const fileGroups: Record<string, typeof jobs> = {};
    jobs.forEach((j) => {
      const key = j.fileName;
      if (!fileGroups[key]) fileGroups[key] = [];
      fileGroups[key].push(j);
    });

    // For each unique dataset, find the latest job and count live rows in uploadrows
    const datasetItems = await Promise.all(
      Object.entries(fileGroups).map(async ([, groupJobs]) => {
        const sorted = [...groupJobs].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        const latest = sorted[sorted.length - 1];
        const persistedRows = await UploadRow.countDocuments({ uploadId: latest.uploadId });

        return {
          uploadId: latest.uploadId,
          fileName: latest.fileName,
          persistedRows,
          historicalRows: latest.totalRows || 0,
          status: latest.status,
          createdAt: latest.createdAt,
          label: `${latest.fileName} (${persistedRows > 0 ? persistedRows.toLocaleString() + ' rows' : 'No rows in storage'})`,
          isLatest: true,
          columns: latest.columns || []
        };
      })
    );

    const totalPersistedRows = datasetItems.reduce((acc, d) => acc + d.persistedRows, 0);
    const totalHistoricalRows = datasetItems.reduce((acc, d) => acc + d.historicalRows, 0);
    const registeredDatasets = datasetItems.length;

    // Resolve active dataset: requested by query or default to preferred / latest
    const requestedId = typeof req.query.uploadId === 'string' ? req.query.uploadId : null;
    let targetJob = jobs.find((j) => j.uploadId === requestedId);
    if (!targetJob) {
      targetJob = jobs[0];
    }

    let activeDataset = null;
    let profile = null;

    if (targetJob) {
      const activePersistedRows = await UploadRow.countDocuments({ uploadId: targetJob.uploadId });
      activeDataset = {
        uploadId: targetJob.uploadId,
        fileName: targetJob.fileName,
        status: targetJob.status,
        fileSize: targetJob.fileSize,
        columns: targetJob.columns || [],
        persistedRows: activePersistedRows,
        historicalRows: targetJob.totalRows || 0,
        createdAt: targetJob.createdAt,
        hasPersistedRows: activePersistedRows > 0,
        stages: targetJob.stages
      };

      if (activePersistedRows > 0) {
        profile = await generateDatasetProfile(targetJob.uploadId, owner);
      }
    }

    const stages = targetJob?.stages;
    const pipelineStatus = {
      ingestion: activeDataset?.hasPersistedRows ? 'completed' : targetJob?.status === 'completed' ? 'completed' : 'pending',
      cleaning: stages?.cleaning?.status || (targetJob?.cleaningStrategies && Object.keys(targetJob.cleaningStrategies).length ? 'completed' : 'pending'),
      mapping: stages?.mapping?.status || (targetJob?.mapping && Object.keys(targetJob.mapping).length ? 'completed' : 'pending'),
      transformation: stages?.transformation?.status || (targetJob?.transformedAt ? 'completed' : 'pending'),
      validation: stages?.validation?.status || 'pending'
    };

    return res.json({
      registeredDatasets,
      totalPersistedRows,
      totalHistoricalRows,
      activeDataset,
      profile,
      datasets: datasetItems,
      pipelineStatus
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to load dashboard state', error: String(error) });
  }
});

export default router;

