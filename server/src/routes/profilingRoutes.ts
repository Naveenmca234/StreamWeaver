import { Router, Response } from 'express';
import UploadRow from '../models/UploadRow';
import ImportJob from '../models/ImportJob';
import { requireAuth, AuthedRequest } from '../middleware/authMiddleware';

const router = Router();
router.use(requireAuth);

type ColumnProfile = {
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
  q1?: number;
  q3?: number;
  iqr?: number;
  outlierCount?: number;
  outlierPercentage?: number;
};

type DatasetProfile = {
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
  qualityBreakdown: {
    completeness: number;
    validity: number;
    uniqueness: number;
    consistency: number;
  };
  columns: ColumnProfile[];
};

import { isMissingValue, parseValue, getValueType } from '../utils/dataUtils';


const calculateStats = (values: (number | Date | string | boolean | null)[]) => {
  const nonMissing = values.filter((v) => v !== null) as (number | Date | string | boolean)[];
  const numeric = nonMissing.filter((v): v is number => typeof v === 'number');
  const dates = nonMissing.filter((v): v is Date => v instanceof Date);
  const counts = new Map<string, number>();
  nonMissing.forEach((value) => {
    const key = typeof value === 'object' ? String((value as Date).toISOString()) : String(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  const sortedNumeric = [...numeric].sort((a, b) => a - b);
  const modeEntry = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
  const inferredType: ColumnProfile['type'] = numeric.length ? 'number' : dates.length ? 'date' : nonMissing.length ? 'string' : 'string';
  return {
    uniqueValues: counts.size,
    duplicateValues: nonMissing.length - counts.size,
    min: sortedNumeric.length ? sortedNumeric[0] : undefined,
    max: sortedNumeric.length ? sortedNumeric[sortedNumeric.length - 1] : undefined,
    mean: sortedNumeric.length ? sortedNumeric.reduce((sum, value) => sum + value, 0) / sortedNumeric.length : undefined,
    median: sortedNumeric.length
      ? sortedNumeric.length % 2 === 1
        ? sortedNumeric[(sortedNumeric.length - 1) / 2]
        : (sortedNumeric[sortedNumeric.length / 2 - 1] + sortedNumeric[sortedNumeric.length / 2]) / 2
      : undefined,
    mode: modeEntry ? modeEntry[0] : undefined,
    type: inferredType
  };
};

const createQualityScore = (profile: DatasetProfile) => {
  const completeness = profile.totalRows > 0 ? 100 - Math.round((profile.totalMissingValues / (profile.totalRows * profile.totalColumns)) * 100) : 100;
  const uniqueness = profile.totalRows > 0 ? Math.round(((profile.totalRows - profile.totalDuplicateRows) / profile.totalRows) * 100) : 100;
  const validity = 100;
  const consistency = 100 - Math.round(profile.totalDuplicateRows > 0 ? Math.min(20, (profile.totalDuplicateRows / profile.totalRows) * 100) : 0);
  const score = Math.round((completeness + validity + uniqueness + consistency) / 4);
  return {
    score: Math.max(0, Math.min(100, score)),
    breakdown: { completeness, validity, uniqueness, consistency }
  };
};

export async function generateDatasetProfile(uploadId: string, owner?: string, forceRecompute: boolean = false): Promise<DatasetProfile | null> {
  const owners = [owner].filter(Boolean) as string[];
  const job = await ImportJob.findOne({ uploadId }).lean();

  const rowFilter: any = owners.length ? { uploadId, createdBy: { $in: owners } } : { uploadId };
  let totalRows = await UploadRow.countDocuments(rowFilter);
  if (!totalRows && owners.length) {
    totalRows = await UploadRow.countDocuments({ uploadId });
    if (totalRows) {
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

  // Fast single aggregation for all columns missing values & dataset size
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

  const orConditions = columnNames.map((c) => ({
    $or: [
      { [`data.${c}`]: { $exists: false } },
      { [`data.${c}`]: null },
      { [`data.${c}`]: '' }
    ]
  }));

  const [aggResults, uniqueRowsAgg, missingRowsCount] = await Promise.all([
    UploadRow.aggregate([{ $match: rowFilter }, { $group: groupStage }]).allowDiskUse(true),
    UploadRow.aggregate([
      { $match: rowFilter },
      { $group: { _id: '$data' } },
      { $count: 'unique' }
    ]).allowDiskUse(true),
    orConditions.length ? UploadRow.countDocuments({ ...rowFilter, $or: orConditions }) : 0
  ]);

  const stats = aggResults[0] || {};
  const datasetSize = stats.totalBsonSize || 0;
  const uniqueRows = uniqueRowsAgg[0]?.unique ?? 0;
  const duplicateRows = totalRows - uniqueRows;

  // In parallel, get column unique values and determine schema types from actual data
  const columns: ColumnProfile[] = await Promise.all(
    columnNames.map(async (column) => {
      const missingValues = stats['missing_' + column] || 0;
      const uniqueAgg = await UploadRow.aggregate([
        { $match: rowFilter },
        { $group: { _id: `$data.${column}` } },
        { $group: { _id: null, uniqueCount: { $sum: 1 } } }
      ]).allowDiskUse(true);

      const uniqueValues = uniqueAgg[0]?.uniqueCount ?? 0;
      const duplicateValues = totalRows - uniqueValues;

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
  const completeRows = totalRows - rowsWithMissingData;
  const missingDataPercentage = totalRows && columnNames.length
    ? Math.round((totalMissingValues / (totalRows * columnNames.length)) * 100)
    : 0;

  const profile: DatasetProfile = {
    totalRows,
    totalColumns: columns.length,
    totalMissingValues,
    totalDuplicateRows: duplicateRows,
    numberNumericColumns,
    numberTextColumns,
    numberDateColumns,
    datasetSize,
    qualityScore: 0,
    rowsWithMissingData,
    completeRows,
    missingDataPercentage,
    qualityBreakdown: { completeness: 0, validity: 0, uniqueness: 0, consistency: 0 },
    columns
  };

  const quality = createQualityScore(profile);
  profile.qualityScore = quality.score;
  profile.qualityBreakdown = quality.breakdown;

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
