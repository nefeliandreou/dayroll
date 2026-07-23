import express from 'express';
import session from 'express-session';
import connectPg from 'connect-pg-simple';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { pool, initDb } from './db.js';
import { authRouter } from './routes/auth.js';
import { listsRouter } from './routes/lists.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const isProd = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT || 3000);

function logDbTarget() {
  try {
    const u = new URL(process.env.DATABASE_URL);
    console.log(`DB target host=${u.hostname} port=${u.port || 5432} db=${u.pathname}`);
  } catch (err) {
    console.error('DATABASE_URL is not a valid URL');
  }
}

async function waitForDb() {
  for (let attempt = 1; attempt <= 15; attempt++) {
    try {
      await initDb();
      console.log('Database ready');
      return;
    } catch (err) {
      console.error(`DB init attempt ${attempt}/15 failed:`, err.message);
      if (attempt === 15) throw err;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  logDbTarget();

  const dist = path.join(root, 'dist');
  if (!fs.existsSync(path.join(dist, 'index.html'))) {
    console.error(`Missing ${dist}/index.html — build may have failed`);
    process.exit(1);
  }

  // Start listening immediately so Render health checks can pass.
  const app = express();
  let ready = false;

  app.set('trust proxy', 1);
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.status(200).json({ ok: true, ready });
  });

  // Block API until DB is ready (health stays green).
  app.use('/api', (req, res, next) => {
    if (req.path === '/health') return next();
    if (!ready) return res.status(503).json({ error: 'Starting up, try again in a moment' });
    next();
  });

  const PgSession = connectPg(session);
  app.use(
    session({
      store: new PgSession({
        pool,
        tableName: 'session',
        createTableIfMissing: true,
      }),
      name: 'dayroll.sid',
      secret: process.env.SESSION_SECRET || 'dev-only-change-me',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: isProd,
        maxAge: 1000 * 60 * 60 * 24 * 30,
      },
    })
  );

  app.use('/api/auth', authRouter);
  app.use('/api/lists', listsRouter);

  app.use(express.static(dist));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    res.sendFile(path.join(dist, 'index.html'), (err) => {
      if (err) next(err);
    });
  });

  app.listen(port, '0.0.0.0', () => {
    console.log(`Dayroll listening on :${port}`);
  });

  await waitForDb();
  ready = true;
  console.log('Dayroll ready to serve traffic');
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
