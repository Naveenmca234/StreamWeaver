import { Router, Response } from 'express';
import ImportJob from '../models/ImportJob';
import UploadRow from '../models/UploadRow';
import TransformedRow from '../models/TransformedRow';
import ImportedRow from '../models/ImportedRow';
import MemorySample from '../models/MemorySample';
import ValidationRecord from '../models/ValidationRecord';
import { requireAuth, AuthedRequest, createOwnerFilter } from '../middleware/authMiddleware';
import { runTransform } from '../services/sandboxService';

const router = Router();
router.use(requireAuth);

type MappingEntry = string | { source: string; transformCode?: string };

const createJobFilter = (userEmail?: string, userId?: string) => createOwnerFilter(userEmail, userId);

const TRANSFORM_BATCH_SIZE = 5000;
const IMPORT_BATCH_SIZE = 5000;

const normalizeMapping = (raw: unknown): Record<string, MappingEntry> => {
  if (!raw || typeof raw !== 'object') return {};

  if (Array.isArray(raw)) {
    return raw.reduce<Record<string, MappingEntry>>((acc, item) => {
      if (item && typeof item === 'object' && 'source' in item && typeof item.source === 'string' && typeof (item as any).dest === 'string' && (item as any).dest.trim()) {
        acc[(item as any).dest] = { source: item.source, transformCode: typeof (item as any).transformCode === 'string' ? (item as any).transformCode : undefined };
      } else if (item && typeof item === 'object' && 'source' in item && typeof item.source === 'string' && typeof (item as any).target === 'string' && (item as any).target.trim()) {
        acc[(item as any).target] = { source: item.source, transformCode: typeof (item as any).transformCode === 'string' ? (item as any).transformCode : undefined };
      }
      return acc;
    }, {});
  }

  return Object.entries(raw as Record<string, unknown>).reduce<Record<string, MappingEntry>>((acc, [dest, value]) => {
    if (typeof value === 'string') {
      acc[dest] = value;
    } else if (value && typeof value === 'object' && 'source' in value && typeof (value as any).source === 'string') {
      acc[dest] = {
        source: (value as any).source,
        transformCode: typeof (value as any).transformCode === 'string' ? (value as any).transformCode : undefined
      };
    }
    return acc;
  }, {});
};

router.get('/', async (req: AuthedRequest, res: Response) => {
  try {
    const jobs = await ImportJob.find(createJobFilter(req.user?.email, req.user?.id)).sort({ updatedAt: -1, createdAt: -1 }).limit(50).lean();
    res.json({ jobs });
  } catch (error) {
    res.status(500).json({ message: 'Could not load import history', error: String(error) });
  }
});

router.get('/latest', async (req: AuthedRequest, res: Response) => {
  try {
    const job = await ImportJob.findOne(createJobFilter(req.user?.email, req.user?.id)).sort({ updatedAt: -1, createdAt: -1 }).lean();
    if (!job) return res.status(404).json({ message: 'No imports found' });
    res.json({ job });
  } catch (error) {
    res.status(500).json({ message: 'Could not load latest import', error: String(error) });
  }
});

router.get('/:uploadId', async (req: AuthedRequest, res: Response) => {
  try {
    const { uploadId } = req.params;
    const job = await ImportJob.findOne({ uploadId, ...createJobFilter(req.user?.email, req.user?.id) }).lean();
    if (!job) return res.status(404).json({ message: 'Import not found' });
    res.json({ job });
  } catch (error) {
    res.status(500).json({ message: 'Could not load import', error: String(error) });
  }
});

router.get('/:uploadId/mapping', async (req: AuthedRequest, res: Response) => {
  try {
    const { uploadId } = req.params;
    const job = await ImportJob.findOne({ uploadId, ...createJobFilter(req.user?.email, req.user?.id) }).lean();
    if (!job) return res.status(404).json({ message: 'Import not found' });
    res.json({ mapping: job.mapping ?? {}, job });
  } catch (error) {
    res.status(500).json({ message: 'Could not load mapping', error: String(error) });
  }
});

// Memory audit summary for an upload
router.get('/:uploadId/audit', async (req: AuthedRequest, res: Response) => {
  try {
    const { uploadId } = req.params;
    const samples = await MemorySample.find({ uploadId }).sort({ ts: 1 }).lean();
    if (!samples.length) return res.json({ samples: [], summary: null });

    const peakRss = Math.max(...samples.map((s: any) => s.rss));
    const peakHeap = Math.max(...samples.map((s: any) => s.heapUsed));
    const avgRss = Math.round(samples.reduce((a: number, b: any) => a + b.rss, 0) / samples.length);
    const avgHeap = Math.round(samples.reduce((a: number, b: any) => a + b.heapUsed, 0) / samples.length);

    const memoryLimitMB = Number(process.env.MEMORY_AUDIT_LIMIT_MB ?? '500');
    const peakRssMB = Math.round(peakRss / 1024 / 1024);
    const pass = peakRssMB <= memoryLimitMB;

    const summary = { peakRss, peakHeap, avgRss, avgHeap, samples: samples.length };
    res.json({ summary, memoryLimitMB, peakRssMB, pass, samples });
  } catch (error) {
    res.status(500).json({ message: 'Unable to load memory audit', error: String(error) });
  }
});

const handleSaveMapping = async (req: AuthedRequest, res: Response) => {
  try {
    const { uploadId } = req.params;
    const { mapping } = req.body;

    if (!mapping || typeof mapping !== 'object') {
      return res.status(400).json({ message: 'Mapping payload is required' });
    }

    const normalizedMapping = normalizeMapping(mapping);
    const jobRecord = await ImportJob.findOne({ uploadId, ...createJobFilter(req.user?.email, req.user?.id) });
    if (!jobRecord) return res.status(404).json({ message: 'Import not found' });

    // Clean up old transformed rows since mapping schema has changed
    await TransformedRow.deleteMany({ uploadId });

    const stages = jobRecord.stages ?? {};
    stages.mapping = { status: 'completed', finishedAt: new Date() };
    stages.transformation = { status: 'pending' };
    stages.validation = { status: 'pending' };

    let updatedProfile = jobRecord.profile;
    if (updatedProfile) {
      updatedProfile = { ...updatedProfile, qualityScore: null };
    }

    const job = await ImportJob.findOneAndUpdate(
      { uploadId, ...createJobFilter(req.user?.email, req.user?.id) },
      { mapping: normalizedMapping, stages, profile: updatedProfile, updatedAt: new Date() },
      { new: true }
    ).lean();

    res.json({ job, mapping: normalizedMapping, message: 'Mapping saved successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Could not update mapping', error: String(error) });
  }
};

router.post('/:uploadId/mapping', handleSaveMapping);
router.patch('/:uploadId/mapping', handleSaveMapping);

router.patch('/:uploadId/columns', async (req: AuthedRequest, res: Response) => {
  try {
    const { uploadId } = req.params;
    const { selectedColumns } = req.body;

    if (!Array.isArray(selectedColumns) || selectedColumns.some((column) => typeof column !== 'string')) {
      return res.status(400).json({ message: 'selectedColumns must be an array of strings' });
    }

    const job = await ImportJob.findOneAndUpdate(
      { uploadId, ...createJobFilter(req.user?.email, req.user?.id) },
      { selectedColumns, updatedAt: new Date() },
      { new: true }
    ).lean();

    if (!job) return res.status(404).json({ message: 'Import not found' });
    res.json({ job });
  } catch (error) {
    res.status(500).json({ message: 'Could not update selected columns', error: String(error) });
  }
});

const applyMapping = async (row: Record<string, unknown>, mapping: Record<string, MappingEntry>) => {
  const output: Record<string, unknown> = {};
  const errors: string[] = [];

  for (const [dest, entry] of Object.entries(mapping)) {
    const source = typeof entry === 'string' ? entry : entry.source;
    const transformCode = typeof entry === 'string' ? undefined : entry.transformCode;
    const rawValue = row?.[source];

    if (transformCode) {
      const result = await runTransform(transformCode, rawValue, row);
      if (result.success) {
        output[dest] = result.value;
      } else {
        output[dest] = rawValue;
        errors.push(`${dest}: ${result.error}`);
      }
    } else {
      output[dest] = rawValue;
    }
  }

  return { output, errors };
};

router.post('/:uploadId/transform', async (req: AuthedRequest, res: Response) => {
  const { uploadId } = req.params;
  try {
    const job = await ImportJob.findOne({ uploadId, ...createJobFilter(req.user?.email, req.user?.id) }).lean();
    if (!job) return res.status(404).json({ message: 'Import not found' });
    if (!job.mapping || !Object.keys(job.mapping).length) {
      return res.status(400).json({ message: 'Mapping must be saved before transformation' });
    }

    const mapping = normalizeMapping(job.mapping);
    const cursor = UploadRow.find({ uploadId }).sort({ rowNumber: 1 }).cursor();
    await TransformedRow.deleteMany({ uploadId });

    const io = req.app.get('io');
    const totalRows = job.totalRows || 0;
    let transformedRows = 0;
    let failedRows = 0;
    let batchOps: any[] = [];
    const sandboxErrors: string[] = [];
    const start = Date.now();

    for await (const row of cursor) {
      const { output, errors } = await applyMapping(row.data ?? {}, mapping);
      if (errors.length) {
        sandboxErrors.push(...errors.map((e) => `Row ${row.rowNumber} - ${e}`));
      }
      batchOps.push({ insertOne: { document: { uploadId, rowNumber: row.rowNumber, transformedData: output } } });
      transformedRows += 1;
      if (errors.length) failedRows += 1;

      if (batchOps.length >= TRANSFORM_BATCH_SIZE) {
        await TransformedRow.bulkWrite(batchOps, { ordered: false });
        batchOps = [];
      }

      if (io && totalRows > 0 && transformedRows % 100 === 0) {
        const elapsedSeconds = Math.max((Date.now() - start) / 1000, 0.001);
        io.to(uploadId).emit('import-progress', {
          uploadId,
          stage: 'transform',
          progress: Math.min(100, Math.round((transformedRows / totalRows) * 100)),
          totalRows,
          rowsProcessed: transformedRows,
          rowsFailed: failedRows,
          rowsPerSecond: Math.round(transformedRows / elapsedSeconds),
          durationMs: Math.round(elapsedSeconds * 1000),
          batchSize: TRANSFORM_BATCH_SIZE
        });
      }
    }

    if (batchOps.length) {
      await TransformedRow.bulkWrite(batchOps, { ordered: false });
    }

    const stages = job.stages ?? {};
    stages.transformation = {
      status: failedRows > 0 && failedRows === totalRows ? 'failed' : 'completed',
      finishedAt: new Date(),
      count: transformedRows,
      error: sandboxErrors[0]
    };
    stages.validation = { status: 'pending' };

    const overallStatus = failedRows > 0 && failedRows === totalRows ? 'failed' : 'completed';

    await ImportJob.findOneAndUpdate(
      { uploadId, ...createJobFilter(req.user?.email, req.user?.id) },
      {
        transformedAt: new Date(),
        failedRows,
        stages,
        status: overallStatus,
        errorMessage: sandboxErrors[0] || undefined,
        updatedAt: new Date()
      }
    );

    if (io) {
      const elapsedSeconds = Math.max((Date.now() - start) / 1000, 0.001);
      io.to(uploadId).emit('import-progress', {
        uploadId,
        stage: 'transform',
        progress: 100,
        totalRows,
        rowsProcessed: transformedRows,
        rowsFailed: failedRows,
        rowsPerSecond: Math.round(transformedRows / elapsedSeconds),
        durationMs: Math.round(elapsedSeconds * 1000),
        batchSize: TRANSFORM_BATCH_SIZE
      });
    }

    res.json({
      message: 'Transformation complete',
      transformedCount: transformedRows,
      failedRows,
      sandboxErrors: sandboxErrors.slice(0, 20)
    });
  } catch (error) {
    await ImportJob.findOneAndUpdate(
      { uploadId, ...createJobFilter(req.user?.email, req.user?.id) },
      {
        status: 'failed',
        errorMessage: String(error),
        'stages.transformation': { status: 'failed', error: String(error) },
        updatedAt: new Date()
      }
    );
    res.status(500).json({ message: 'Could not transform rows', error: String(error) });
  }
});

router.post('/:uploadId/import', async (req: AuthedRequest, res: Response) => {
  try {
    const { uploadId } = req.params;
    const job = await ImportJob.findOne({ uploadId, ...createJobFilter(req.user?.email, req.user?.id) }).lean();
    if (!job) return res.status(404).json({ message: 'Import not found' });

    const totalRows = await TransformedRow.countDocuments({ uploadId });
    if (!totalRows) {
      return res.status(404).json({ message: 'No transformed rows available for import. Please run transformation first.' });
    }

    const cursor = TransformedRow.find({ uploadId }).sort({ rowNumber: 1 }).cursor();
    await ImportedRow.deleteMany({ uploadId });

    const io = req.app.get('io');
    let importedRows = 0;
    let batchOps: any[] = [];
    const start = Date.now();

    for await (const row of cursor) {
      batchOps.push({ insertOne: { document: { uploadId, rowNumber: row.rowNumber, data: row.transformedData, createdBy: job.createdBy } } });
      importedRows += 1;

      if (batchOps.length >= IMPORT_BATCH_SIZE) {
        await ImportedRow.bulkWrite(batchOps, { ordered: false });
        batchOps = [];
      }

      if (io && importedRows % 100 === 0) {
        const elapsedSeconds = Math.max((Date.now() - start) / 1000, 0.001);
        io.to(uploadId).emit('import-progress', {
          uploadId,
          stage: 'import',
          progress: Math.min(100, Math.round((importedRows / totalRows) * 100)),
          totalRows,
          rowsProcessed: importedRows,
          rowsFailed: 0,
          rowsPerSecond: Math.round(importedRows / elapsedSeconds),
          durationMs: Math.round(elapsedSeconds * 1000),
          batchSize: IMPORT_BATCH_SIZE
        });
      }
    }

    if (batchOps.length) {
      await ImportedRow.bulkWrite(batchOps, { ordered: false });
    }

    const stages = job.stages ?? {};
    stages.ingestion = { status: 'completed', finishedAt: new Date(), count: importedRows };

    await ImportJob.findOneAndUpdate(
      { uploadId, ...createJobFilter(req.user?.email, req.user?.id) },
      { importedAt: new Date(), importedRows, stages, status: 'completed', updatedAt: new Date() }
    );

    if (io) {
      const elapsedSeconds = Math.max((Date.now() - start) / 1000, 0.001);
      io.to(uploadId).emit('import-progress', {
        uploadId,
        stage: 'import',
        progress: 100,
        totalRows,
        rowsProcessed: importedRows,
        rowsFailed: 0,
        rowsPerSecond: Math.round(importedRows / elapsedSeconds),
        durationMs: Math.round(elapsedSeconds * 1000),
        batchSize: IMPORT_BATCH_SIZE
      });
    }

    res.json({ message: 'Commit to warehouse complete', importedRows, totalRows });
  } catch (error) {
    res.status(500).json({ message: 'Could not import rows', error: String(error) });
  }
});

// Stream Export (CSV & JSON) for Raw and Transformed data
router.get('/:uploadId/export', async (req: AuthedRequest, res: Response) => {
  try {
    const { uploadId } = req.params;
    const type = req.query.type === 'transformed' ? 'transformed' : 'raw';
    const format = req.query.format === 'json' ? 'json' : 'csv';

    const job = await ImportJob.findOne({ uploadId, ...createJobFilter(req.user?.email, req.user?.id) }).lean();
    if (!job) return res.status(404).json({ message: 'Import not found' });

    const baseName = job.fileName ? job.fileName.replace(/\.[^/.]+$/, '') : 'dataset';
    const exportFileName = `${baseName}_${type}.${format}`;

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${exportFileName}"`);

      res.write('[\n');
      let first = true;

      if (type === 'transformed') {
        const cursor = TransformedRow.find({ uploadId }).sort({ rowNumber: 1 }).cursor();
        for await (const row of cursor) {
          if (!first) res.write(',\n');
          res.write(JSON.stringify(row.transformedData || {}));
          first = false;
        }
      } else {
        const cursor = UploadRow.find({ uploadId }).sort({ rowNumber: 1 }).cursor();
        for await (const row of cursor) {
          if (!first) res.write(',\n');
          res.write(JSON.stringify(row.data || {}));
          first = false;
        }
      }

      res.write('\n]');
      res.end();
      return;
    }

    // CSV export
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${exportFileName}"`);

    const escapeCsv = (val: unknown): string => {
      if (val === null || val === undefined) return '';
      const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    if (type === 'transformed') {
      const sample = await TransformedRow.findOne({ uploadId }).lean();
      const headers = sample?.transformedData ? Object.keys(sample.transformedData) : [];
      res.write(headers.map(escapeCsv).join(',') + '\n');

      const cursor = TransformedRow.find({ uploadId }).sort({ rowNumber: 1 }).cursor();
      for await (const row of cursor) {
        const data = row.transformedData || {};
        res.write(headers.map((h) => escapeCsv(data[h])).join(',') + '\n');
      }
    } else {
      const sample = await UploadRow.findOne({ uploadId }).lean();
      const headers = sample?.data ? Object.keys(sample.data) : job.columns || [];
      res.write(headers.map(escapeCsv).join(',') + '\n');

      const cursor = UploadRow.find({ uploadId }).sort({ rowNumber: 1 }).cursor();
      for await (const row of cursor) {
        const data = row.data || {};
        res.write(headers.map((h) => escapeCsv(data[h])).join(',') + '\n');
      }
    }

    res.end();
  } catch (error) {
    res.status(500).json({ message: 'Export failed', error: String(error) });
  }
});

// Delete an entire import dataset and related records
router.delete('/:uploadId', async (req: AuthedRequest, res: Response) => {
  try {
    const { uploadId } = req.params;
    const force = req.query.force === 'true';
    const ownerFilter = { uploadId, ...createJobFilter(req.user?.email, req.user?.id) };
    let job = await ImportJob.findOne(ownerFilter).lean();

    if (!job && force && req.user?.role === 'admin') {
      job = await ImportJob.findOne({ uploadId }).lean();
      if (!job) return res.status(404).json({ message: 'Import not found' });
    }

    if (!job) return res.status(404).json({ message: 'Import not found' });

    const errors: string[] = [];
    try {
      await UploadRow.deleteMany({ uploadId });
    } catch (e: any) {
      errors.push(`UploadRow: ${e?.message ?? String(e)}`);
    }

    try {
      await TransformedRow.deleteMany({ uploadId });
    } catch (e: any) {
      errors.push(`TransformedRow: ${e?.message ?? String(e)}`);
    }

    try {
      await ImportedRow.deleteMany({ uploadId });
    } catch (e: any) {
      errors.push(`ImportedRow: ${e?.message ?? String(e)}`);
    }

    try {
      await ValidationRecord.deleteMany({ uploadId });
    } catch (e: any) {
      errors.push(`ValidationRecord: ${e?.message ?? String(e)}`);
    }

    try {
      await MemorySample.deleteMany({ uploadId });
    } catch (e: any) {
      errors.push(`MemorySample: ${e?.message ?? String(e)}`);
    }

    try {
      await ImportJob.deleteOne({ uploadId });
    } catch (e: any) {
      errors.push(`ImportJob: ${e?.message ?? String(e)}`);
    }

    if (errors.length) {
      return res.status(500).json({ message: 'Failed to delete some records', details: errors });
    }

    res.json({ message: 'Import and related data deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Could not delete import', error: String(error) });
  }
});

export default router;
