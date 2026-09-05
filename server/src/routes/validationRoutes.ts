import { Router, Response } from 'express';
import ValidationRecord from '../models/ValidationRecord';
import UploadRow from '../models/UploadRow';
import ImportJob from '../models/ImportJob';
import { requireAuth, AuthedRequest, createOwnerFilter } from '../middleware/authMiddleware';
import { generateDatasetProfile } from './profilingRoutes';

const createJobFilter = (userEmail?: string, userId?: string) => createOwnerFilter(userEmail, userId);

const router = Router();
router.use(requireAuth);

router.get('/', async (req: AuthedRequest, res: Response) => {
  const { uploadId } = req.query;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
  const skip = (page - 1) * limit;

  try {
    const owners = [req.user?.email, req.user?.id].filter(Boolean) as string[];
    const query: any = {};
    if (typeof uploadId === 'string' && uploadId.trim().length > 0) {
      query.uploadId = uploadId.trim();
    } else if (owners.length) {
      query.createdBy = { $in: owners };
    }

    const [totalRecords, totalErrors, records, job] = await Promise.all([
      ValidationRecord.countDocuments(query),
      ValidationRecord.countDocuments({ ...query, severity: 'error' }),
      ValidationRecord.find(query).sort({ rowNumber: 1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      typeof uploadId === 'string' ? ImportJob.findOne({ uploadId }).lean() : null
    ]);

    // Map records to ensure fieldName is always populated
    const normalizedRecords = records.map((r: any) => ({
      _id: r._id,
      uploadId: r.uploadId,
      rowNumber: r.rowNumber,
      fieldName: r.fieldName || r.field || 'unknown',
      field: r.field || r.fieldName || 'unknown',
      ruleName: r.ruleName || 'SchemaValidation',
      severity: r.severity || 'warning',
      message: r.message,
      data: r.data || {},
      createdAt: r.createdAt
    }));

    res.json({
      summary: {
        totalRecords,
        totalErrors,
        totalWarnings: Math.max(0, totalRecords - totalErrors)
      },
      validationStatus: job?.stages?.validation?.status || 'pending',
      qualityScore: job?.profile?.qualityScore ?? null,
      records: normalizedRecords,
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages: Math.ceil(totalRecords / limit) || 1
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Could not load validation records', error: String(error) });
  }
});

router.post('/:uploadId/run', async (req: AuthedRequest, res: Response) => {
  const uploadId = String(req.params.uploadId);
  try {
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
    let totalErrors = 0;
    let totalWarnings = 0;

    for await (const row of cursor) {
      if (row.data) {
        for (const [k, v] of Object.entries(row.data)) {
          // Rule 1: Required / Empty field check
          if (v === null || v === undefined || String(v).trim() === '') {
            totalWarnings++;
            batchOps.push({
              insertOne: {
                document: {
                  uploadId,
                  rowNumber: row.rowNumber,
                  fieldName: k,
                  field: k,
                  ruleName: 'RequiredField',
                  severity: 'warning',
                  message: `Missing or empty value for field "${k}"`,
                  data: row.data,
                  createdBy: job.createdBy
                }
              }
            });
          }

          // Rule 2: Email format check
          if (
            (k.toLowerCase().includes('email') || (typeof v === 'string' && v.includes('@'))) &&
            typeof v === 'string' &&
            v.trim().length > 0 &&
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
          ) {
            totalWarnings++;
            batchOps.push({
              insertOne: {
                document: {
                  uploadId,
                  rowNumber: row.rowNumber,
                  fieldName: k,
                  field: k,
                  ruleName: 'EmailFormat',
                  severity: 'warning',
                  message: `Email format invalid: "${v}"`,
                  data: row.data,
                  createdBy: job.createdBy
                }
              }
            });
          }

          // Rule 3: Date format check
          if (
            (k.toLowerCase().includes('date') || k.toLowerCase().includes('time')) &&
            typeof v === 'string' &&
            v.trim().length >= 6 &&
            Number.isNaN(Date.parse(v.trim()))
          ) {
            totalWarnings++;
            batchOps.push({
              insertOne: {
                document: {
                  uploadId,
                  rowNumber: row.rowNumber,
                  fieldName: k,
                  field: k,
                  ruleName: 'DateFormat',
                  severity: 'warning',
                  message: `Unparseable date value: "${v}"`,
                  data: row.data,
                  createdBy: job.createdBy
                }
              }
            });
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

    stages.validation = {
      status: 'completed',
      finishedAt: new Date(),
      count: processed
    };

    await ImportJob.findOneAndUpdate({ _id: job._id }, { stages, updatedAt: new Date() });

    // Regenerate dataset profile with real validation scores
    const profile = await generateDatasetProfile(uploadId, req.user?.email || req.user?.id, true);

    res.json({
      message: 'Validation complete',
      processedRows: processed,
      totalErrors,
      totalWarnings,
      qualityScore: profile?.qualityScore ?? null,
      profile
    });
  } catch (error) {
    const job = await ImportJob.findOne({ uploadId: String(req.params.uploadId) });
    if (job) {
      const stages = job.stages ?? {};
      stages.validation = { status: 'failed', error: String(error) };
      await ImportJob.findOneAndUpdate({ _id: job._id }, { stages, updatedAt: new Date() });
    }
    res.status(500).json({ message: 'Validation failed', error: String(error) });
  }
});

export default router;
