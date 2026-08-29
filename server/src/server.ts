import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import http from 'http';
import path from 'path';
import dns from 'dns';
import { Server } from 'socket.io';
import { MongoMemoryServer } from 'mongodb-memory-server';
import authRoutes from './routes/authRoutes';
import uploadRoutes from './routes/uploadRoutes';
import debugRoutes from './routes/debugRoutes';
import profilingRoutes from './routes/profilingRoutes';
import importRoutes from './routes/importRoutes';
import validationRoutes from './routes/validationRoutes';
import transformedRoutes from './routes/transformedRoutes';
import cleaningRoutes from './routes/cleaningRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import { registerSocketHandlers } from './socket/socketHandler';

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// On Windows, Node c-ares DNS resolver can default to [ '127.0.0.1' ], breaking SRV lookups for mongodb+srv://
if (process.platform === 'win32') {
  try {
    const servers = dns.getServers();
    if (servers.length === 1 && servers[0] === '127.0.0.1') {
      dns.setServers(['172.16.1.246', '172.16.1.247', '172.16.1.248']);
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

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

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
        await mongoose.connect(MONGO_URI);
      } catch (connErr) {
        if (MONGO_URI.includes('streamweaver.hkpk18x.mongodb.net')) {
          const directUri = MONGO_URI
            .replace('mongodb+srv://', 'mongodb://')
            .replace(
              'streamweaver.hkpk18x.mongodb.net',
              'ac-k14cdig-shard-00-00.hkpk18x.mongodb.net:27017,ac-k14cdig-shard-00-01.hkpk18x.mongodb.net:27017,ac-k14cdig-shard-00-02.hkpk18x.mongodb.net:27017'
            ) + (MONGO_URI.includes('ssl=true') ? '' : (MONGO_URI.includes('?') ? '&ssl=true&authSource=admin' : '?ssl=true&authSource=admin'));
          console.warn('SRV connection attempt failed, trying direct replica set endpoints...');
          await mongoose.connect(directUri);
        } else {
          throw connErr;
        }
      }
      console.log('MongoDB connected using environment URI');
      await validateMongoWrite();
    } else {
      const mongodb = await MongoMemoryServer.create();
      const uri = mongodb.getUri();
      await mongoose.connect(uri);
      console.log('MongoDB connected using embedded memory server');
    }
  } catch (error) {
    console.warn('MongoDB unavailable or not writable, continuing with local auth fallback:', error);
    try {
      await mongoose.disconnect();
    } catch {
      // ignore
    }
    const mongodb = await MongoMemoryServer.create();
    const uri = mongodb.getUri();
    await mongoose.connect(uri);
    console.log('MongoDB connected using embedded memory server');
  }

  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
};

startServer();
