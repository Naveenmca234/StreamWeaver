import './config/env';
import express from 'express';
import mongoose from 'mongoose';
import http from 'http';
import path from 'path';
import dns from 'dns';
import { Server } from 'socket.io';
import { MongoMemoryServer } from 'mongodb-memory-server';
import config from './config/env';
import authRoutes from './routes/authRoutes';
import uploadRoutes from './routes/uploadRoutes';
import debugRoutes from './routes/debugRoutes';
import profilingRoutes from './routes/profilingRoutes';
import importRoutes from './routes/importRoutes';
import validationRoutes from './routes/validationRoutes';
import transformedRoutes from './routes/transformedRoutes';
import cleaningRoutes from './routes/cleaningRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import ImportJob from './models/ImportJob';
import { registerSocketHandlers } from './socket/socketHandler';

// On Windows, Node c-ares DNS resolver can default to [ '127.0.0.1' ], breaking SRV lookups for mongodb+srv://
if (process.platform === 'win32') {
  try {
    const servers = dns.getServers();
    if (servers.length === 1 && servers[0] === '127.0.0.1') {
      dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
    }
  } catch {
    // ignore
  }
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

// Explicit CORS headers middleware for development & production
app.use((req, res, next) => {
  const allowedOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  const origin = req.headers.origin;
  if (origin && (origin === allowedOrigin || origin.startsWith('http://localhost:'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Make the Socket.IO server available to routes (req.app.get('io')) so the
// upload pipeline can emit live progress events as it processes a file.
app.set('io', io);

app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/debug', debugRoutes);
app.use('/api/profiling', profilingRoutes);
app.use('/api/cleaning', cleaningRoutes);
app.use('/api/imports', importRoutes);
app.use('/api/validations', validationRoutes);
app.use('/api/transformed', transformedRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Serve the built React client when it's been built (npm run build), so
// the whole app can run from a single process with `npm start`.
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) res.status(404).send('Client build not found. Run "npm run build" first, or use "npm run dev" for local development.');
  });
});

registerSocketHandlers(io);

const PORT = config.port;
const MONGO_URI = config.mongoUri;

const validateMongoWrite = async () => {
  const db = mongoose.connection.db;
  if (!db) throw new Error('MongoDB connection not available');
  const testCollection = db.collection('streamweaver_write_check');
  const result = await testCollection.insertOne({ check: true, createdAt: new Date() });
  await testCollection.deleteOne({ _id: result.insertedId });
};

const startServer = async () => {
  try {
    if (MONGO_URI) {
      try {
        await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 });
      } catch (connErr) {
        if (MONGO_URI.includes('streamweaver.hkpk18x.mongodb.net')) {
          const directUri = MONGO_URI
            .replace('mongodb+srv://', 'mongodb://')
            .replace(
              'streamweaver.hkpk18x.mongodb.net',
              'ac-k14cdig-shard-00-00.hkpk18x.mongodb.net:27017,ac-k14cdig-shard-00-01.hkpk18x.mongodb.net:27017,ac-k14cdig-shard-00-02.hkpk18x.mongodb.net:27017'
            ) + (MONGO_URI.includes('ssl=true') ? '' : (MONGO_URI.includes('?') ? '&ssl=true&authSource=admin' : '?ssl=true&authSource=admin'));
          console.warn('SRV connection attempt failed, trying direct replica set endpoints...');
          await mongoose.connect(directUri, { serverSelectionTimeoutMS: 10000 });
        } else {
          throw connErr;
        }
      }
      const db = mongoose.connection.db;
      const dbHost = mongoose.connection.host || 'Atlas cluster';
      console.log(`[DB] Connected to MongoDB`);
      console.log(`[DB] Database: ${db?.databaseName || 'streamweaver'}`);
      console.log(`[DB] Host: ${dbHost}`);
      await validateMongoWrite();
    } else {
      if (process.env.NODE_ENV !== 'test' && !process.env.ALLOW_MEMORY_DB) {
        throw new Error('MONGO_URI is not configured in server/.env');
      }
      const mongodb = await MongoMemoryServer.create();
      const uri = mongodb.getUri();
      await mongoose.connect(uri);
      console.log('[DB] Connected to MongoDB (Test-only Memory Server)');
      console.log('[DB] Database: test');
    }
  } catch (error) {
    console.error('[DB] Failed to connect to configured MongoDB database:', error instanceof Error ? error.message : String(error));
    if (process.env.NODE_ENV === 'test' || process.env.ALLOW_MEMORY_DB === 'true') {
      console.warn('[DB] Fallback to embedded memory server for automated test run');
      const mongodb = await MongoMemoryServer.create();
      const uri = mongodb.getUri();
      await mongoose.connect(uri);
    } else {
      process.exit(1);
    }
  }

  // Recover interrupted / stuck processing jobs from previous process restarts
  try {
    await ImportJob.updateMany(
      { status: 'processing' },
      { status: 'failed', errorMessage: 'Job interrupted due to server restart', finishedAt: new Date() }
    );
  } catch {
    // ignore
  }

  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
};

startServer();
