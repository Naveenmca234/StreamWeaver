import { Router, Response } from 'express';
import ValidationRecord from '../models/ValidationRecord';
import UploadRow from '../models/UploadRow';
import ImportJob from '../models/ImportJob';
import { requireAuth, AuthedRequest } from '../middleware/authMiddleware';

const createJobFilter = (userEmail?: string, userId?: string) => {
  const owners = [userEmail, userId].filter(Boolean) as string[];
  return owners.length ? { createdBy: { $in: owners } } : {};
};

const router = Router();
router.use(requireAuth);

router.get('/', async (req: AuthedRequest, res: Response) => {
  const { uploadId } = req.query;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
  const skip = (page - 1) * limit;

  try {
    const owners = [req.user?.email, req.user?.id].filter(Boolean) as string[];
    const query: any = owners.length ? { createdBy: { $in: owners } } : {};
    if (typeof uploadId === 'string') {
      query.uploadId = uploadId;
    }

    const totalRecords = await ValidationRecord.countDocuments(query);
    const totalErrors = await ValidationRecord.countDocuments({ ...query, severity: 'error' });
    const records = await ValidationRecord.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json({
      summary: {
        totalRecords,
        totalErrors,
        totalWarnings: totalRecords - totalErrors
      },
      records,
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages: Math.ceil(totalRecords / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Could not load validation records', error: String(error) });
  }
});

router.post('/:uploadId/run', async (req: AuthedRequest, res: Response) => {
  try {
    const { uploadId } = req.params;
    const owners = [req.user?.email, req.user?.id].filter(Boolean) as string[];
    const rowFilter = owners.length ? { uploadId, createdBy: { $in: owners } } : { uploadId };

    const job = await ImportJob.findOne({ uploadId, ...createJobFilter(req.user?.email, req.user?.id) });
    if (!job) return res.status(404).json({ message: 'Import not found' });

    // Clear old validation records
    await ValidationRecord.deleteMany({ uploadId });
    
    // Set status to processing
    const stages = job.stages ?? {};
    stages.validation = { status: 'processing', startedAt: new Date() };
    await ImportJob.findOneAndUpdate({ _id: job._id }, { stages, updatedAt: new Date() });

    // Re-validate using cursor
    const cursor = UploadRow.find(rowFilter).lean().cursor();
    
    let batchOps: any[] = [];
    let processed = 0;
    
    for await (const row of cursor) {
      if (row.data) {
        for (const [k, v] of Object.entries(row.data)) {
          if (v === null || v === undefined || String(v).trim() === '') {
             batchOps.push({ insertOne: { document: {
                uploadId,
                rowNumber: row.rowNumber,
                fieldName: k,
                ruleName: 'RequiredField',
                severity: 'warning',
                message: `Missing value for ${k}`
             }}});
          }
        }
      }
      processed++;
      if (batchOps.length >= 2000) {
        await ValidationRecord.bulkWrite(batchOps, { ordered: false });
        batchOps = [];
      }
    }
    if (batchOps.length) {
      await ValidationRecord.bulkWrite(batchOps, { ordered: false });
    }

    stages.validation = { status: 'completed', finishedAt: new Date() };
    await ImportJob.findOneAndUpdate({ _id: job._id }, { stages, updatedAt: new Date() });

    res.json({ message: 'Validation complete', processedRows: processed });
  } catch (error) {
    const job = await ImportJob.findOne({ uploadId: req.params.uploadId });
    if (job) {
      const stages = job.stages ?? {};
      stages.validation = { status: 'failed', error: String(error) };
      await ImportJob.findOneAndUpdate({ _id: job._id }, { stages, updatedAt: new Date() });
    }
    res.status(500).json({ message: 'Validation failed', error: String(error) });
  }
});

export default router;
