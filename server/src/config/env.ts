import dotenv from 'dotenv';
import path from 'path';

// Load .env files in deterministic order
dotenv.config({ path: path.resolve(__dirname, '../../../server/.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

export const config = {
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGO_URI || '',
  jwtSecret: process.env.JWT_SECRET || 'devsecret',
  uploadBatchSize: Number(process.env.UPLOAD_BATCH_SIZE || 5000),
  memoryAuditLimitMb: Number(process.env.MEMORY_AUDIT_LIMIT_MB || 150),
  progressThrottleMs: Number(process.env.PROGRESS_THROTTLE_MS || 300),
  allowedEmailDomains: process.env.ALLOWED_EMAIL_DOMAINS || '',
  nodeEnv: process.env.NODE_ENV || 'development'
};

export default config;
