import { Router, Response } from 'express';
import { requireAuth, AuthedRequest, createOwnerFilter } from '../middleware/authMiddleware';
import ImportJob from '../models/ImportJob';
import UploadRow from '../models/UploadRow';
import { generateDatasetProfile } from './profilingRoutes';

const router = Router();

router.get('/', requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const owner = req.user?.email || req.user?.id;
    const filter = createOwnerFilter(req.user?.email, req.user?.id);
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

    // Build dataset list with distinct identifiers and formatting
    const datasetItems = await Promise.all(
      jobs.map(async (j) => {
        const persistedRows = await UploadRow.countDocuments({ uploadId: j.uploadId });
        const dateStr = new Date(j.createdAt).toLocaleDateString([], {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        const shortId = j.uploadId.slice(0, 8);

        return {
          uploadId: j.uploadId,
          fileName: j.fileName,
          persistedRows,
          historicalRows: j.totalRows || 0,
          status: j.status,
          createdAt: j.createdAt,
          label: `${j.fileName} (${persistedRows > 0 ? persistedRows.toLocaleString() + ' rows' : 'No rows in storage'} • ${dateStr} • ${shortId})`,
          columns: j.columns || []
        };
      })
    );

    const totalPersistedRows = datasetItems.reduce((acc, d) => acc + d.persistedRows, 0);
    const totalHistoricalRows = datasetItems.reduce((acc, d) => acc + d.historicalRows, 0);
    const registeredDatasets = datasetItems.length;

    // Resolve active dataset: requested by query or default to latest
    const requestedId = typeof req.query.uploadId === 'string' ? req.query.uploadId.trim() : null;
    let targetJob = requestedId ? jobs.find((j) => j.uploadId === requestedId) : null;
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
