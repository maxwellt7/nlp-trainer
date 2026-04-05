import express from 'express';
import cors from 'cors';
import { clerkMiddleware, getAuth } from '@clerk/express';
import learnRoutes from '../server/routes/learn.js';
import practiceRoutes from '../server/routes/practice.js';
import hypnosisRoutes from '../server/routes/hypnosis.js';
import audioRoutes from '../server/routes/audio.js';
import profileRoutes from '../server/routes/profile.js';
import identityRoutes from '../server/routes/identity.js';
import { ensureDefaultUser } from '../server/services/profile.js';

const app = express();

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (origin.endsWith('.vercel.app')) return callback(null, true);
    if (origin.endsWith('.sovereignty.app')) return callback(null, true);
    if (origin === process.env.FRONTEND_URL) return callback(null, true);
    callback(null, true); // Allow same-origin requests on Vercel
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

// Clerk middleware
if (process.env.CLERK_SECRET_KEY) {
  app.use(clerkMiddleware());
}

// Extract userId from Clerk or fall back to default
const extractUserId = (req, res, next) => {
  if (process.env.CLERK_SECRET_KEY) {
    try {
      const auth = getAuth(req);
      req.userId = auth?.userId || 'default-user';
    } catch {
      req.userId = 'default-user';
    }
  } else {
    req.userId = 'default-user';
  }
  next();
};

app.use('/api', extractUserId);

app.use('/api/learn', learnRoutes);
app.use('/api/practice', practiceRoutes);
app.use('/api/hypnosis', hypnosisRoutes);
app.use('/api/audio', audioRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/identity', identityRoutes);

// Initialize database and default user
try { ensureDefaultUser(); } catch (err) { console.error('DB init error:', err.message); }

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', auth: !!process.env.CLERK_SECRET_KEY });
});

app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
