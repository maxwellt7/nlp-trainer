import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { clerkMiddleware, requireAuth, getAuth } from '@clerk/express';
import learnRoutes from './routes/learn.js';
import practiceRoutes from './routes/practice.js';
import hypnosisRoutes from './routes/hypnosis.js';
import audioRoutes from './routes/audio.js';
import profileRoutes from './routes/profile.js';
import identityRoutes from './routes/identity.js';
import gamificationRoutes from './routes/gamification.js';
import quizRoutes from './routes/quiz.js';
import { ensureDefaultUser } from './services/profile.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Load .env for local dev; Railway/production injects env vars directly
dotenv.config({ path: join(__dirname, '..', '.env'), quiet: true });

const app = express();

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://heart.sovereignty.app',
  'http://localhost:5173',
  'http://localhost:4173',
].filter(Boolean);

// Initialize database and default user
try {
  const userId = ensureDefaultUser();
  console.log(`Database initialized. Default user: ${userId}`);
} catch (err) {
  console.error('Database initialization error:', err.message);
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (health checks, server-to-server, curl)
    if (!origin) return callback(null, true);
    // Allow any *.vercel.app preview deployment
    if (origin.endsWith('.vercel.app')) return callback(null, true);
    // Allow any *.sovereignty.app subdomain
    if (origin.endsWith('.sovereignty.app')) return callback(null, true);
    // Allow explicitly listed origins
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

// Clerk middleware — makes auth available on all routes but doesn't enforce it
if (process.env.CLERK_SECRET_KEY) {
  app.use(clerkMiddleware());
  console.log('Clerk authentication enabled');
} else {
  console.warn('CLERK_SECRET_KEY not set — authentication disabled');
}

// Health check (public, no auth required)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', auth: !!process.env.CLERK_SECRET_KEY });
});

// Middleware to extract userId from Clerk auth or fall back to default
const extractUserId = (req, res, next) => {
  if (process.env.CLERK_SECRET_KEY) {
    try {
      const auth = getAuth(req);
      if (auth && auth.userId) {
        req.userId = auth.userId;
      } else {
        // Not authenticated — use default user for now
        req.userId = 'default-user';
      }
    } catch {
      req.userId = 'default-user';
    }
  } else {
    req.userId = 'default-user';
  }
  next();
};

// Apply userId extraction to all API routes
app.use('/api', extractUserId);

// Mount routes
app.use('/api/learn', learnRoutes);
app.use('/api/practice', practiceRoutes);
app.use('/api/hypnosis', hypnosisRoutes);
app.use('/api/audio', audioRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/identity', identityRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/quiz', quizRoutes);

// Global error handler
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
