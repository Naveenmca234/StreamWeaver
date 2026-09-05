import { Router, Response } from 'express';
import TransformedRow from '../models/TransformedRow';
import ImportJob from '../models/ImportJob';
import { requireAuth, AuthedRequest, createOwnerFilter } from '../middleware/authMiddleware';

const router = Router();
router.use(requireAuth);

router.get('/latest', async (req: AuthedRequest, res: Response) => {
  try {
    const ownerFilter = createOwnerFilter(req.user?.email, req.user?.id);
    const job = await ImportJob.findOne(ownerFilter).sort({ createdAt: -1 }).lean();
    if (!job) return res.status(404).json({ message: 'No imports found' });

    const rows = await TransformedRow.find({ uploadId: job.uploadId }).sort({ rowNumber: 1 }).limit(1000).lean();
    res.json({ uploadId: job.uploadId, rows });
  } catch (error) {
    res.status(500).json({ message: 'Could not load latest transformed rows', error: String(error) });
  }
});

router.get('/:uploadId', async (req: AuthedRequest, res: Response) => {
  try {
    const { uploadId } = req.params;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(2000, Math.max(1, Number(req.query.limit) || 1000));
    const skip = (page - 1) * limit;

    const ownerFilter = { uploadId, ...createOwnerFilter(req.user?.email, req.user?.id) };
    const job = await ImportJob.findOne(ownerFilter).lean();
    if (!job) return res.status(404).json({ message: 'Import not found' });

    const [totalRows, rows] = await Promise.all([
      TransformedRow.countDocuments({ uploadId }),
      TransformedRow.find({ uploadId }).sort({ rowNumber: 1 }).skip(skip).limit(limit).lean()
    ]);

    res.json({ rows, totalRows, page, limit });
  } catch (error) {
    res.status(500).json({ message: 'Could not load transformed rows', error: String(error) });
  }
});

export default router;
