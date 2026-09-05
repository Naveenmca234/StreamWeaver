import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthedRequest extends Request {
  user?: { id: string; role: 'user' | 'admin'; email: string };
}

export const requireAuth = (req: AuthedRequest, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  const token = header && header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Authentication token is required.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'devsecret') as { id: string; role: 'user' | 'admin'; email: string };
    req.user = { id: payload.id, role: payload.role, email: payload.email };
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};
export const createOwnerFilter = (email?: string, id?: string) => {
  const conditions: any[] = [];
  if (id && typeof id === 'string' && id.trim()) {
    conditions.push({ createdBy: id.trim() });
  }
  if (email && typeof email === 'string' && email.trim()) {
    const normalized = email.trim().toLowerCase();
    const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    conditions.push({ createdBy: normalized });
    conditions.push({ createdBy: { $regex: new RegExp(`^${escaped}$`, 'i') } });
  }
  return conditions.length ? { $or: conditions } : {};
};
