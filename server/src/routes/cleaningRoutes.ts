import { Router, Response } from 'express';
import UploadRow from '../models/UploadRow';
import ImportJob from '../models/ImportJob';
import { requireAuth, AuthedRequest } from '../middleware/authMiddleware';
import { isMissingValue, parseValue, getColumnStats, normalizeReplacement } from '../utils/dataUtils';
import { generateDatasetProfile } from './profilingRoutes';
const router = Router();
router.use(requireAuth);

type MissingColumnSummary = {
  name: string;
  totalRows: number;
  missingValues: number;
  missingPercentage: number;
  completeCount: number;
  type: 'number' | 'date' | 'string' | 'boolean' | 'unknown';
  sampleValues: unknown[];
};

type MissingDataSummary = {
  totalRows: number;
  rowsWithMissingData: number;
  completeRows: number;
  totalMissingValues: number;
  missingPercentage: number;
};

type StrategyChoice = 'keep' | 'remove' | 'fill' | 'mean' | 'median' | 'mode';

const createJobFilter = (userEmail?: string, userId?: string) => {
  const owners = [userEmail, userId].filter(Boolean) as string[];
  return owners.length ? { createdBy: { $in: owners } } : {};
};

const executeStrategyOnColumn = async (
  uploadId: string,
  owners: string[],
  column: string,
  strategy: StrategyChoice,
  fillValue?: unknown
) => {
  const filter: any = { uploadId, createdBy: { $in: owners } };

  if (strategy === 'remove') {
    await UploadRow.deleteMany({
      uploadId,
      createdBy: { $in: owners },
      $or: [{ [`data.${column}`]: { $exists: false } }, { [`data.${column}`]: null }, { [`data.${column}`]: '' }]
    });
  } else if (strategy !== 'keep') {
    let replacement: any = null;
    if (strategy === 'fill') {
      replacement = normalizeReplacement(fillValue, 'string');
    } else if (strategy === 'mean') {
      const agg = await UploadRow.aggregate([
        { $match: { ...filter, [`data.${column}`]: { $type: 'number' } } },
        { $group: { _id: null, avg: { $avg: `$data.${column}` } } }
      ]).allowDiskUse(true);
      replacement = agg[0]?.avg != null ? Math.round(agg[0].avg * 100) / 100 : null;
    } else if (strategy === 'median') {
      const sampleAgg = await UploadRow.aggregate([
        { $match: { ...filter, [`data.${column}`]: { $type: 'number' } } },
        { $sample: { size: 1000 } },
        { $project: { v: `$data.${column}` } }
      ]).allowDiskUse(true);
      const vals = sampleAgg
        .map((s: any) => Number(s.v))
        .filter((v: number) => Number.isFinite(v))
        .sort((a: number, b: number) => a - b);
      if (vals.length) {
        const mid = Math.floor(vals.length / 2);
        replacement = vals.length % 2 === 1 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
      }
    } else if (strategy === 'mode') {
      const modeAgg = await UploadRow.aggregate([
        { $match: { ...filter, [`data.${column}`]: { $nin: [null, ''] } } },
        { $group: { _id: `$data.${column}`, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 1 }
      ]).allowDiskUse(true);
      replacement = modeAgg[0]?._id ?? null;
    }

    if (replacement !== null || strategy === 'fill') {
      await UploadRow.updateMany(
        {
          ...filter,
          $or: [{ [`data.${column}`]: { $exists: false } }, { [`data.${column}`]: null }, { [`data.${column}`]: '' }]
        },
        { $set: { [`data.${column}`]: replacement } }
      );
    }
  }
};

router.get('/', async (req: AuthedRequest, res: Response) => {
  try {
    const { uploadId } = req.query;
    if (typeof uploadId !== 'string' || !uploadId.trim()) {
      return res.status(400).json({ message: 'uploadId query parameter is required' });
    }

    const owners = [req.user?.email, req.user?.id].filter(Boolean) as string[];
    const filter: any = { uploadId, createdBy: { $in: owners } };
    const job = await ImportJob.findOne({ uploadId, ...createJobFilter(req.user?.email, req.user?.id) }).lean();
    if (!job) return res.status(404).json({ message: 'Import job not found' });

    let totalRows = await UploadRow.countDocuments(filter);
    if (!totalRows && owners.length) {
      const fallbackCount = await UploadRow.countDocuments({ uploadId });
      if (fallbackCount) {
        delete filter.createdBy;
        totalRows = fallbackCount;
      }
    }

    // get column names via aggregation
    const colsAgg = await UploadRow.aggregate([
      { $match: filter },
      { $project: { kv: { $objectToArray: '$data' } } },
      { $unwind: '$kv' },
      { $group: { _id: null, keys: { $addToSet: '$kv.k' } } },
      { $project: { _id: 0, keys: 1 } }
    ]).allowDiskUse(true);
    const allColumnNames: string[] = (colsAgg[0]?.keys ?? []) as string[];
    const selectedColumnNames = Array.isArray(job.selectedColumns) && job.selectedColumns.length
      ? job.selectedColumns.filter((column) => allColumnNames.includes(column))
      : allColumnNames;

    if (!totalRows) {
      return res.json({
        summary: { totalRows: 0, rowsWithMissingData: 0, completeRows: 0, totalMissingValues: 0, missingPercentage: 0 },
        columns: [],
        strategies: job.cleaningStrategies ?? {}
      });
    }

    let totalMissingValues = 0;
    const columns: MissingColumnSummary[] = [];

    for (const column of selectedColumnNames) {
      const missingValues = await UploadRow.countDocuments({
        ...filter,
        $or: [{ [`data.${column}`]: { $exists: false } }, { [`data.${column}`]: null }, { [`data.${column}`]: '' }]
      });
      totalMissingValues += missingValues;

      // sample up to 3 non-missing values
      const sample = await UploadRow.aggregate([
        { $match: { ...filter, [`data.${column}`]: { $nin: [null, ''] } } },
        { $project: { v: `$data.${column}` } },
        { $limit: 3 }
      ]).allowDiskUse(true);

      const typeAgg = await UploadRow.aggregate([
        { $match: filter },
        { $project: { t: { $type: `$data.${column}` } } },
        { $group: { _id: '$t', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 1 }
      ]).allowDiskUse(true);
      const predominantType = typeAgg[0]?._id ?? 'string';

      columns.push({
        name: column,
        totalRows,
        missingValues,
        missingPercentage: totalRows ? Math.round((missingValues / totalRows) * 10000) / 100 : 0,
        completeCount: totalRows - missingValues,
        type:
          predominantType === 'double' || predominantType === 'int' || predominantType === 'long'
            ? 'number'
            : predominantType === 'date'
              ? 'date'
              : 'string',
        sampleValues: (sample.map((s: any) => s.v) ?? []).slice(0, 3)
      });
    }

    // rows with any missing column
    const orConditions = selectedColumnNames.map((c) => ({ [`data.${c}`]: { $in: [null, ''] } }));
    const rowsWithMissingData = orConditions.length
      ? await UploadRow.countDocuments({ ...filter, $or: orConditions })
      : 0;

    const summary: MissingDataSummary = {
      totalRows,
      rowsWithMissingData,
      completeRows: Math.max(0, totalRows - rowsWithMissingData),
      totalMissingValues,
      missingPercentage: totalRows > 0 ? Math.round((rowsWithMissingData / totalRows) * 10000) / 100 : 0
    };

    res.json({ summary, columns, strategies: job.cleaningStrategies ?? {} });
  } catch (error) {
    res.status(500).json({ message: 'Unable to load missing data summary', error: String(error) });
  }
});

// POST /api/cleaning/:uploadId/apply -> Apply strategy for a single column
router.post('/:uploadId/apply', async (req: AuthedRequest, res: Response) => {
  try {
    const uploadId = String(req.params.uploadId);
    const { columnName, strategy, fillValue } = req.body;

    if (!uploadId || !columnName || !strategy) {
      return res.status(400).json({ message: 'uploadId, columnName, and strategy are required' });
    }

    const owners = [req.user?.email, req.user?.id].filter(Boolean) as string[];
    const job = await ImportJob.findOne({ uploadId, ...createJobFilter(req.user?.email, req.user?.id) });
    if (!job) return res.status(404).json({ message: 'Import job not found' });

    await executeStrategyOnColumn(uploadId, owners, columnName, strategy, fillValue);

    const updatedStrategies = {
      ...(job.cleaningStrategies ?? {}),
      [columnName]: { strategy, fillValue: String(fillValue ?? '') }
    };

    const stages = job.stages ?? {};
    stages.cleaning = { status: 'completed', finishedAt: new Date() };
    stages.validation = { status: 'pending' };

    const rowFilter = { uploadId, ...createJobFilter(req.user?.email, req.user?.id) };
    const newTotalRows = await UploadRow.countDocuments(rowFilter);

    await ImportJob.findOneAndUpdate(
      rowFilter,
      { cleaningStrategies: updatedStrategies, stages, totalRows: newTotalRows, updatedAt: new Date() }
    );

    // Regenerate profile with updated data
    await generateDatasetProfile(uploadId, req.user?.email || req.user?.id, true);

    res.json({ message: `Strategy applied to ${columnName} successfully` });
  } catch (error) {
    res.status(500).json({ message: 'Failed to apply cleaning strategy', error: String(error) });
  }
});

// POST /api/cleaning/:uploadId/apply-all -> Apply multiple column strategies in batch
router.post('/:uploadId/apply-all', async (req: AuthedRequest, res: Response) => {
  try {
    const uploadId = String(req.params.uploadId);
    const { strategies } = req.body;

    if (!uploadId || !strategies || typeof strategies !== 'object') {
      return res.status(400).json({ message: 'uploadId and strategies object are required' });
    }

    const owners = [req.user?.email, req.user?.id].filter(Boolean) as string[];
    const job = await ImportJob.findOne({ uploadId, ...createJobFilter(req.user?.email, req.user?.id) });
    if (!job) return res.status(404).json({ message: 'Import job not found' });

    for (const [colName, stratObj] of Object.entries(strategies as Record<string, any>)) {
      if (stratObj && stratObj.strategy && stratObj.strategy !== 'keep') {
        await executeStrategyOnColumn(uploadId, owners, colName, stratObj.strategy, stratObj.fillValue);
      }
    }

    const stages = job.stages ?? {};
    stages.cleaning = { status: 'completed', finishedAt: new Date() };
    stages.validation = { status: 'pending' };

    const rowFilter = { uploadId, ...createJobFilter(req.user?.email, req.user?.id) };
    const newTotalRows = await UploadRow.countDocuments(rowFilter);

    await ImportJob.findOneAndUpdate(
      rowFilter,
      { cleaningStrategies: strategies, stages, totalRows: newTotalRows, updatedAt: new Date() }
    );

    // Regenerate profile with updated data
    await generateDatasetProfile(uploadId, req.user?.email || req.user?.id, true);

    res.json({ message: 'All cleaning strategies applied successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to apply cleaning strategies', error: String(error) });
  }
});

// Legacy POST / for backward compatibility
router.post('/', async (req: AuthedRequest, res: Response) => {
  try {
    const { uploadId, column, strategy, fillValue } = req.body;
    if (!uploadId || !column || !strategy) {
      return res.status(400).json({ message: 'uploadId, column, and strategy are required' });
    }

    const owners = [req.user?.email, req.user?.id].filter(Boolean) as string[];
    await executeStrategyOnColumn(uploadId, owners, column, strategy, fillValue);

    const rowFilter = { uploadId, ...createJobFilter(req.user?.email, req.user?.id) };
    const newTotalRows = await UploadRow.countDocuments(rowFilter);

    const job = await ImportJob.findOne(rowFilter);
    const stages = job?.stages ?? {};
    stages.validation = { status: 'pending' };

    await ImportJob.findOneAndUpdate(
      rowFilter,
      { stages, totalRows: newTotalRows, updatedAt: new Date() }
    );

    await generateDatasetProfile(uploadId, req.user?.email || req.user?.id, true);

    res.json({ message: 'Missing data strategy applied' });
  } catch (error) {
    res.status(500).json({ message: 'Could not apply missing data strategy', error: String(error) });
  }
});

export default router;
