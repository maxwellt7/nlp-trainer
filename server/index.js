import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import learnRoutes from './routes/learn.js';
import practiceRoutes from './routes/practice.js';
import hypnosisRoutes from './routes/hypnosis.js';
import audioRoutes from './routes/audio.js';
import profileRoutes from './routes/profile.js';
import { ensureDefaultUser } from './services/profile.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Load .env for local dev; Railway/production injects env vars directly
dotenv.config({ path: join(__dirname, '..', '.env'), quiet: true });

const app = express();

const allowedOrigins = [
  process.env.FRONTEND_URL,
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
    // Allow explicitly listed origins
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
app.use(express.json({ limit: '1mb' }));

app.use('/api/learn', learnRoutes);
app.use('/api/practice', practiceRoutes);
app.use('/api/hypnosis', hypnosisRoutes);
app.use('/api/audio', audioRoutes);
app.use('/api/profile', profileRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Global error handler for uncaught async errors in routes (Express 5 catches these,
// but this provides a clean JSON response instead of HTML)
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
