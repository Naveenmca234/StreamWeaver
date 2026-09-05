import { Router, Response } from 'express';
import UploadRow from '../models/UploadRow';
import ImportJob from '../models/ImportJob';
import ValidationRecord from '../models/ValidationRecord';
import { requireAuth, AuthedRequest, createOwnerFilter } from '../middleware/authMiddleware';

const router = Router();
router.use(requireAuth);

export type ColumnProfile = {
  name: string;
  type: 'number' | 'date' | 'string' | 'boolean' | 'unknown';
  totalValues: number;
  missingValues: number;
  missingPercentage: number;
  uniqueValues: number;
  duplicateValues: number;
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  mode?: unknown;
};

export type DatasetProfile = {
  totalRows: number;
  totalColumns: number;
  totalMissingValues: number;
  totalDuplicateRows: number;
  numberNumericColumns: number;
  numberTextColumns: number;
  numberDateColumns: number;
  datasetSize: number;
  qualityScore: number | null;
  rowsWithMissingData: number;
  completeRows: number;
  missingDataPercentage: number;
  qualityBreakdown: {
    completeness: number;
    validity: number | null;
    uniqueness: number;
    consistency: number;
  };
  columns: ColumnProfile[];
};

export async function generateDatasetProfile(
  uploadId: string,
  owner?: string,
  forceRecompute: boolean = false
): Promise<DatasetProfile | null> {
  const ownerFilter = owner ? createOwnerFilter(owner, owner) : {};
  const job = await ImportJob.findOne({ uploadId, ...ownerFilter }).lean() || await ImportJob.findOne({ uploadId }).lean();

  const rowFilter: any = Object.keys(ownerFilter).length ? { uploadId, ...ownerFilter } : { uploadId };
  let totalRows = await UploadRow.countDocuments(rowFilter);
  if (!totalRows) {
    totalRows = await UploadRow.countDocuments({ uploadId });
    if (totalRows) {
      delete rowFilter.$or;
      delete rowFilter.createdBy;
    }
  }

  // Guard: If raw rows were deleted/purged from storage, there is no valid profile
  if (!totalRows) {
    if (job?.profile) {
      await ImportJob.findOneAndUpdate({ uploadId }, { profile: null });
    }
    return null;
  }

  // Return cached profile only if row count strictly matches current raw row count
  if (!forceRecompute && job?.profile && job.profile.totalRows === totalRows && job.profile.numberNumericColumns !== undefined) {
    return job.profile as DatasetProfile;
  }

  const sampleDocs = await UploadRow.find(rowFilter).limit(100).lean();
  const sampleDoc = sampleDocs[0];
  let columnNames: string[] = job?.columns?.length ? job.columns : Object.keys((sampleDoc as any)?.data || {});
  if (!columnNames.length) {
    const colsAgg = await UploadRow.aggregate([
      { $match: rowFilter },
      { $project: { kv: { $objectToArray: '$data' } } },
      { $unwind: '$kv' },
      { $group: { _id: null, keys: { $addToSet: '$kv.k' } } },
      { $project: { _id: 0, keys: 1 } }
    ]).allowDiskUse(true);
    columnNames = (colsAgg[0]?.keys ?? []) as string[];
  }

  // Single aggregation for all column missing counts & dataset size
  const groupStage: any = {
    _id: null,
    totalBsonSize: { $sum: { $bsonSize: '$data' } }
  };
  columnNames.forEach((c) => {
    groupStage['missing_' + c] = {
      $sum: {
        $cond: [
          {
            $or: [
              { $eq: [{ $type: `$data.${c}` }, 'missing'] },
              { $eq: [`$data.${c}`, null] },
              { $eq: [`$data.${c}`, ''] }
            ]
          },
          1,
          0
        ]
      }
    };
  });

  // Flat logical OR array for row-level missing calculation
  const flatOrConditions: any[] = [];
  columnNames.forEach((c) => {
    flatOrConditions.push({ [`data.${c}`]: { $exists: false } });
    flatOrConditions.push({ [`data.${c}`]: null });
    flatOrConditions.push({ [`data.${c}`]: '' });
  });

  const [aggResults, uniqueRowsAgg, missingRowsCount] = await Promise.all([
    UploadRow.aggregate([{ $match: rowFilter }, { $group: groupStage }]).allowDiskUse(true),
    totalRows > 2000
      ? UploadRow.aggregate([
          { $match: rowFilter },
          { $sample: { size: 2000 } },
          { $group: { _id: '$data' } },
          { $count: 'unique' }
        ]).allowDiskUse(true)
      : UploadRow.aggregate([
          { $match: rowFilter },
          { $group: { _id: '$data' } },
          { $count: 'unique' }
        ]).allowDiskUse(true),
    flatOrConditions.length ? UploadRow.countDocuments({ ...rowFilter, $or: flatOrConditions }) : 0
  ]);

  const stats = aggResults[0] || {};
  const datasetSize = stats.totalBsonSize || 0;
  const sampleUnique = uniqueRowsAgg[0]?.unique ?? 0;
  const uniqueRows = totalRows > 2000 ? Math.round((sampleUnique / 2000) * totalRows) : sampleUnique;
  const duplicateRows = Math.max(0, totalRows - uniqueRows);

  // Column statistics
  const columns: ColumnProfile[] = await Promise.all(
    columnNames.map(async (column) => {
      const missingValues = stats['missing_' + column] || 0;
      const uniqueAgg = await UploadRow.aggregate([
        { $match: rowFilter },
        { $group: { _id: `$data.${column}` } },
        { $group: { _id: null, uniqueCount: { $sum: 1 } } }
      ]).allowDiskUse(true);

      const uniqueValues = uniqueAgg[0]?.uniqueCount ?? 0;
      const duplicateValues = Math.max(0, totalRows - uniqueValues);

      // Sample-based type detection
      const sampleVals = sampleDocs
        .map((d: any) => d.data?.[column])
        .filter((v: any) => v !== null && v !== undefined && String(v).trim().length > 0);

      const numMatches = sampleVals.filter((v: any) => {
        if (typeof v === 'number' && Number.isFinite(v)) return true;
        if (typeof v === 'string') {
          const trimmed = v.trim();
          return /^-?\d+(?:\.\d+)?$/.test(trimmed) && !isNaN(Number(trimmed));
        }
        return false;
      });

      const dateMatches = sampleVals.filter((v: any) => {
        if (v instanceof Date) return true;
        if (typeof v === 'string') {
          const trimmed = v.trim();
          if (trimmed.length >= 8 && /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(trimmed)) {
            const d = Date.parse(trimmed);
            return !isNaN(d);
          }
        }
        return false;
      });

      let inferredType: ColumnProfile['type'] = 'string';
      if (sampleVals.length > 0) {
        if (numMatches.length / sampleVals.length >= 0.8) {
          inferredType = 'number';
        } else if (dateMatches.length / sampleVals.length >= 0.8) {
          inferredType = 'date';
        }
      }

      let min: number | undefined;
      let max: number | undefined;
      let mean: number | undefined;
      if (inferredType === 'number') {
        const numValues = sampleVals.map((v: any) => Number(v)).filter((n: number) => !isNaN(n));
        if (numValues.length) {
          min = Math.min(...numValues);
          max = Math.max(...numValues);
          mean = Math.round((numValues.reduce((a: number, b: number) => a + b, 0) / numValues.length) * 100) / 100;
        }
      }

      return {
        name: column,
        type: inferredType,
        totalValues: totalRows,
        missingValues,
        missingPercentage: totalRows ? Math.round((missingValues / totalRows) * 10000) / 100 : 0,
        uniqueValues,
        duplicateValues,
        min,
        max,
        mean
      };
    })
  );

  const totalMissingValues = columns.reduce((sum, col) => sum + col.missingValues, 0);
  const numberNumericColumns = columns.filter((col) => col.type === 'number').length;
  const numberDateColumns = columns.filter((col) => col.type === 'date').length;
  const numberTextColumns = columns.filter((col) => col.type === 'string').length;

  const rowsWithMissingData = missingRowsCount;
  const completeRows = Math.max(0, totalRows - rowsWithMissingData);
  const totalCells = totalRows * (columnNames.length || 1);
  const missingDataPercentage = totalCells > 0
    ? Math.round((totalMissingValues / totalCells) * 100)
    : 0;

  // Compute Completeness (0-100) with full precision
  const completeness = totalCells > 0
    ? Math.max(0, 100 - ((totalMissingValues / totalCells) * 100))
    : 100;

  // Uniqueness & Consistency
  const uniqueness = totalRows > 0
    ? Math.max(0, Math.round(((totalRows - duplicateRows) / totalRows) * 100))
    : 100;
  const consistency = 100 - Math.round(duplicateRows > 0 ? Math.min(20, (duplicateRows / totalRows) * 100) : 0);

  // Check validation state
  const validationStatus = job?.stages?.validation?.status;
  let validityScore: number | null = null;
  let finalQualityScore: number | null = null;

  if (validationStatus === 'completed') {
    const [totalErrors, totalWarnings] = await Promise.all([
      ValidationRecord.countDocuments({ uploadId, severity: 'error' }),
      ValidationRecord.countDocuments({ uploadId, severity: 'warning' })
    ]);

    const warningPenalty = Math.min(30, (totalWarnings / (totalCells || 1)) * 100 * 10);
    const errorPenalty = Math.min(60, (totalErrors / (totalRows || 1)) * 100 * 2.5);
    validityScore = Math.max(0, 100 - errorPenalty - warningPenalty);

    // Mapping score (0-100)
    const mappingKeys = job?.mapping ? Object.keys(job.mapping) : [];
    const mappingScore = mappingKeys.length > 0
      ? Math.min(100, (mappingKeys.length / (columnNames.length || 1)) * 100)
      : 100;

    // Transformation score (0-100)
    const failedRows = job?.failedRows || 0;
    const transformationScore = totalRows > 0
      ? Math.max(0, ((totalRows - failedRows) / totalRows) * 100)
      : 100;

    // Final quality formula: Completeness * 0.40 + Validation * 0.30 + Mapping * 0.15 + Transformation * 0.15
    finalQualityScore = Math.round(
      completeness * 0.40 +
      validityScore * 0.30 +
      mappingScore * 0.15 +
      transformationScore * 0.15
    );
  }

  const profile: DatasetProfile = {
    totalRows,
    totalColumns: columns.length,
    totalMissingValues,
    totalDuplicateRows: duplicateRows,
    numberNumericColumns,
    numberTextColumns,
    numberDateColumns,
    datasetSize,
    qualityScore: finalQualityScore,
    rowsWithMissingData,
    completeRows,
    missingDataPercentage,
    qualityBreakdown: {
      completeness: Math.round(completeness * 100) / 100,
      validity: validityScore !== null ? Math.round(validityScore * 100) / 100 : null,
      uniqueness,
      consistency
    },
    columns
  };

  // Persist into ImportJob
  try {
    await ImportJob.findOneAndUpdate({ uploadId }, { profile });
  } catch (err) {
    console.error('Failed to cache profile in ImportJob:', err);
  }

  return profile;
}

router.get('/', async (req: AuthedRequest, res: Response) => {
  try {
    const { uploadId } = req.query;
    if (typeof uploadId !== 'string' || !uploadId.trim()) {
      return res.status(400).json({ message: 'uploadId query parameter is required' });
    }

    const owner = req.user?.email || req.user?.id;
    const profile = await generateDatasetProfile(uploadId, owner);
    if (!profile) {
      return res.status(404).json({ message: 'No uploaded rows found for this import' });
    }

    res.json({ profile });
  } catch (error) {
    console.error('Profiling error for uploadId:', req.query.uploadId, error);
    res.status(500).json({ message: 'Unable to compute dataset profile', error: String(error) });
  }
});

export default router;
