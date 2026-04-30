import express from 'express';
import cors from 'cors';
import { clerkMiddleware, getAuth } from '@clerk/express';
import learnRoutes from '../server/routes/learn.js';
import practiceRoutes from '../server/routes/practice.js';
import hypnosisRoutes from '../server/routes/hypnosis.js';
import audioRoutes from '../server/routes/audio.js';
import profileRoutes from '../server/routes/profile.js';
import identityRoutes from '../server/routes/identity.js';
import gamificationRoutes from '../server/routes/gamification.js';
import quizRoutes from '../server/routes/quiz.js';
import ghlRoutes from '../server/routes/ghl.js';
import analyticsRoutes from '../server/routes/analytics.js';
import provisionRoutes from '../server/routes/provision.js';
import stripeWebhookRoutes from '../server/routes/stripe-webhook.js';
import emailRoutes from '../server/routes/email.js';
import { ensureDefaultUser, ensureUser } from '../server/services/profile.js';

const app = express();

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://heart.sovereignty.app',
  'http://localhost:5173',
  'http://localhost:4173',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (origin.endsWith('.vercel.app')) return callback(null, true);
    if (origin.endsWith('.sovereignty.app')) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));

app.use('/api/stripe-webhook', stripeWebhookRoutes);
app.use(express.json({ limit: '1mb' }));

if (process.env.CLERK_SECRET_KEY) {
  app.use(clerkMiddleware());
}

try {
  ensureDefaultUser();
} catch (err) {
  console.error('DB init error:', err.message);
}

const extractUserId = (req, res, next) => {
  if (process.env.CLERK_SECRET_KEY) {
    try {
      const auth = getAuth(req);
      req.userId = auth?.userId || null;
      if (req.userId) {
        try {
          ensureUser(req.userId);
        } catch (ensureErr) {
          console.error('ensureUser error:', ensureErr.message);
        }
      }
    } catch (err) {
      console.error('extractUserId error:', err.message);
      req.userId = null;
    }
  } else {
    req.userId = 'default-user';
    try {
      ensureUser('default-user');
    } catch (ensureErr) {
      console.error('ensureUser fallback error:', ensureErr.message);
    }
  }
  next();
};

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', auth: !!process.env.CLERK_SECRET_KEY });
});

app.use('/api', extractUserId);
app.use('/api/learn', learnRoutes);
app.use('/api/practice', practiceRoutes);
app.use('/api/hypnosis', hypnosisRoutes);
app.use('/api/audio', audioRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/identity', identityRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/ghl', ghlRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/provision-access', provisionRoutes);
app.use('/api/email', emailRoutes);

app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
