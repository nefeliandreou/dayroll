import pg from 'pg';

const { Pool } = pg;

function sslOption() {
  if (process.env.DATABASE_SSL === 'false') return false;
  if (process.env.DATABASE_SSL === 'true') return { rejectUnauthorized: false };

  // Render external DB hosts need SSL; internal hosts (dpg-…-a) do not.
  try {
    const host = new URL(process.env.DATABASE_URL).hostname;
    if (host.endsWith('render.com')) return { rejectUnauthorized: false };
  } catch {
    // ignore bad URL; connection will fail later with a clearer error
  }
  return false;
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslOption(),
});

export async function initDb() {
  // No Postgres extensions required — UUIDs are generated in the app.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS todos (
      id UUID PRIMARY KEY,
      owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      completed BOOLEAN NOT NULL DEFAULT FALSE,
      day DATE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      rolled_count INT NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS todos_owner_day_idx ON todos(owner_id, day);

    CREATE TABLE IF NOT EXISTS list_shares (
      id UUID PRIMARY KEY,
      owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      shared_with_email TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (owner_id, shared_with_email)
    );

    CREATE INDEX IF NOT EXISTS list_shares_email_idx ON list_shares(shared_with_email);
  `);
}

export async function query(text, params) {
  return pool.query(text, params);
}
