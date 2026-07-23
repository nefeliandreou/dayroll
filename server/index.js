import express from 'express';
import session from 'express-session';
import connectPg from 'connect-pg-simple';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, initDb } from './db.js';
import { authRouter } from './routes/auth.js';
import { listsRouter } from './routes/lists.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const isProd = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT || 3000);

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  // Free DBs can take a moment to accept connections after provision.
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      await initDb();
      break;
    } catch (err) {
      console.error(`DB init attempt ${attempt}/10 failed:`, err.message);
      if (attempt === 10) throw err;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());

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

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/lists', listsRouter);

  const dist = path.join(root, 'dist');
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
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
