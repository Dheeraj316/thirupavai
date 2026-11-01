// PostgreSQL access. Production uses a pooled `pg` connection to DATABASE_URL; development/tests use embedded PGlite (same SQL).
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { cfg } from './config.js';

export const STAGES = ['Confirmed', 'Processing', 'Packed', 'Dispatched', 'In transit', 'Out for delivery', 'Delivered'];
export const DEFAULT_ROLES = {
  'Super Admin': { catalogue: 'full', orders: 'full', payments: 'full', refunds: 'full', pii: 'full', support: 'full', audit: 'full', roles: 'full' },
  'Store Manager': { catalogue: 'full', orders: 'full', payments: 'view', refunds: 'full', pii: 'mask', support: 'full', audit: 'view', roles: 'none' },
  'Product Manager': { catalogue: 'full', orders: 'none', payments: 'none', refunds: 'none', pii: 'none', support: 'none', audit: 'none', roles: 'none' },
  'Order Manager': { catalogue: 'view', orders: 'full', payments: 'view', refunds: 'none', pii: 'mask', support: 'view', audit: 'none', roles: 'none' },
  'Customer Support': { catalogue: 'view', orders: 'view', payments: 'none', refunds: 'none', pii: 'mask', support: 'full', audit: 'none', roles: 'none' },
  'Finance Manager': { catalogue: 'none', orders: 'view', payments: 'full', refunds: 'full', pii: 'mask', support: 'none', audit: 'view', roles: 'none' },
  'Read-only Auditor': { catalogue: 'view', orders: 'view', payments: 'view', refunds: 'view', pii: 'mask', support: 'view', audit: 'view', roles: 'view' },
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, mobile TEXT UNIQUE NOT NULL, name TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT now(), last_login TIMESTAMPTZ);
CREATE TABLE IF NOT EXISTS staff (mobile TEXT PRIMARY KEY, role TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, val JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, sku TEXT NOT NULL, price INTEGER NOT NULL, stock INTEGER NOT NULL, active BOOLEAN NOT NULL DEFAULT true, ovr JSONB NOT NULL DEFAULT '{}', updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE SEQUENCE IF NOT EXISTS order_seq START 100001;
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY, key TEXT UNIQUE, user_id INTEGER REFERENCES users(id), customer JSONB NOT NULL, address JSONB NOT NULL, items JSONB NOT NULL, totals JSONB NOT NULL,
  delivery TEXT NOT NULL, payment JSONB NOT NULL, stage INTEGER NOT NULL DEFAULT 0, history JSONB NOT NULL, awb TEXT, qc JSONB NOT NULL DEFAULT '[]', coupon TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS orders_user_idx ON orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_created_idx ON orders (created_at DESC);
CREATE TABLE IF NOT EXISTS intents (id TEXT PRIMARY KEY, user_id INTEGER NOT NULL, payload JSONB NOT NULL, amount INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'created', gateway_ref TEXT, order_id TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS intents_ref_idx ON intents (gateway_ref);
CREATE TABLE IF NOT EXISTS tickets (id TEXT PRIMARY KEY, data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS audit (id SERIAL PRIMARY KEY, at TIMESTAMPTZ NOT NULL DEFAULT now(), by TEXT NOT NULL, action TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '');
`;

let impl;
export const db = {
  query: (t, p) => impl.query(t, p),
  tx: (fn) => impl.tx(fn),
  close: () => impl.close(),
  async ping() { await impl.query('SELECT 1'); return true; },
};

export async function openDB() {
  if (cfg.databaseUrl) {
    const { default: pg } = await import('pg');
    const pool = new pg.Pool({ connectionString: cfg.databaseUrl, max: cfg.pgPool, idleTimeoutMillis: 30000, connectionTimeoutMillis: 8000, ssl: cfg.pgSsl ? { rejectUnauthorized: false } : undefined });
    pool.on('error', (e) => console.error('[pg]', e.message));
    impl = {
      query: (t, p) => pool.query(t, p),
      async tx(fn) { const c = await pool.connect(); try { await c.query('BEGIN'); const r = await fn({ query: (t, p) => c.query(t, p) }); await c.query('COMMIT'); return r; } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); } },
      close: () => pool.end(),
    };
  } else {
    const { PGlite } = await import('@electric-sql/pglite');
    const lite = new PGlite();   // in-memory; development and tests only
    impl = { query: (t, p) => lite.query(t, p), tx: (fn) => lite.transaction((t) => fn({ query: (q, p) => t.query(q, p) })), close: () => lite.close() };
  }
  const enc = (await impl.query('SHOW server_encoding')).rows[0].server_encoding;      // names, addresses and "→" in the audit trail need UTF-8
  if (enc !== 'UTF8') throw new Error(`The database encoding is ${enc}; it must be UTF8. Create the database with ENCODING 'UTF8'.`);
  // one instance at a time migrates and seeds (advisory lock) so several instances can boot together
  await impl.tx(async (t) => {
    if (cfg.databaseUrl) await t.query('SELECT pg_advisory_xact_lock(7391)');
    for (const stmt of SCHEMA.split(';').map((x) => x.trim()).filter(Boolean)) await t.query(stmt);
    await seed(t);
  });
  return db;
}

async function seed(q) {
  // catalogue: the site's data.js is the seed; after that the database owns price, stock and visibility
  const mod = await import(pathToFileURL(path.join(cfg.staticDir, 'js', 'data.js')).href);
  for (const p of mod.PRODUCTS) await q.query('INSERT INTO products (id, sku, price, stock, active) VALUES ($1,$2,$3,$4,true) ON CONFLICT (id) DO NOTHING', [p.id, p.sku, p.price, p.stock ?? 1]);
  await q.query("INSERT INTO settings (key, val) VALUES ('roles', $1::jsonb) ON CONFLICT (key) DO NOTHING", [JSON.stringify(DEFAULT_ROLES)]);
  if (cfg.seedAdminMobile) await q.query("INSERT INTO staff (mobile, role) VALUES ($1,'Super Admin') ON CONFLICT (mobile) DO NOTHING", [cfg.seedAdminMobile]);
}
