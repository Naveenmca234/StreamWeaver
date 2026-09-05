import { Router, Response } from 'express';
import UploadRow from '../models/UploadRow';
import { requireAuth, AuthedRequest } from '../middleware/authMiddleware';
import mongoose from 'mongoose';

const router = Router();

router.get('/db-stats-public', async (_req, res: Response) => {
  try {
    const db = mongoose.connection.db;
    if (!db) return res.status(500).json({ message: 'MongoDB connection not available' });
    const dbStats = await db.stats();
    const cols = await db.listCollections().toArray();
    
    const collections: Record<string, number> = {};
    for (const c of cols) {
      collections[c.name] = await db.collection(c.name).countDocuments();
    }

    const jobs = await db.collection('importjobs').find({}, {
      projection: { uploadId: 1, fileName: 1, createdBy: 1, totalRows: 1, status: 1, createdAt: 1 }
    }).toArray();

    const users = await db.collection('users').find({}, {
      projection: { email: 1, name: 1, role: 1, createdAt: 1 }
    }).toArray();

    const uploadRowOwners = await db.collection('uploadrows').distinct('createdBy');
    const transformedRowOwners = await db.collection('transformedrows').distinct('createdBy');
    const importedRowOwners = await db.collection('importedrows').distinct('createdBy');

    res.json({ dbStats, collections, jobs, users, uploadRowOwners, transformedRowOwners, importedRowOwners });
  } catch (error) {
    res.status(500).json({ message: 'Could not load DB stats', error: String(error) });
  }
});

router.use(requireAuth);

router.get('/upload-rows', async (req: AuthedRequest, res: Response) => {
  try {
    const { uploadId } = req.query;
    const owners = [req.user?.email, req.user?.id].filter(Boolean) as string[];
    const filter: any = owners.length ? { createdBy: { $in: owners } } : {};

    if (typeof uploadId === 'string' && uploadId.trim().length > 0) {
      filter.uploadId = uploadId;
    }

    const rows = await UploadRow.find(filter).sort({ rowNumber: 1 }).limit(1000).lean();
    const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row.data ?? {}))));
    res.json({ count: rows.length, rows, columns });
  } catch (error) {
    res.status(500).json({ message: 'Could not load upload rows', error: String(error) });
  }
});

export default router;
