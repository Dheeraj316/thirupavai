// Entry point. WEB_CONCURRENCY > 1 forks workers (one per CPU core on bigger plans); platforms also scale by adding instances — the app is stateless either way.
import cluster from 'node:cluster';
import { cfg, assertSafe } from './src/config.js';
import { openKV } from './src/kv.js';
import { openDB, db } from './src/db.js';
import { buildApp } from './src/app.js';

assertSafe();

async function start() {
  const kv = await openKV(); await openDB();
  const app = await buildApp({ kv });
  await app.listen({ port: cfg.port, host: '0.0.0.0', backlog: 4096 });
  console.log(`[thirupavai] pid ${process.pid} listening on :${cfg.port} (${cfg.prod ? 'production' : 'development'}, otp=${cfg.otp.mode}, payments=${cfg.payments.mode}, db=${cfg.databaseUrl ? 'postgres' : 'embedded'}, kv=${cfg.redisUrl ? 'redis' : 'memory'})`);
  const stop = async () => { try { await app.close(); await kv.close(); await db.close(); } finally { process.exit(0); } };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
}

if (cluster.isPrimary && cfg.workers > 1 && cfg.databaseUrl) {
  let stopping = false;
  for (let i = 0; i < cfg.workers; i++) cluster.fork();
  cluster.on('exit', (w, code) => {
    if (stopping) { if (!Object.keys(cluster.workers).length) process.exit(0); return; }
    console.error(`[thirupavai] worker ${w.process.pid} exited (${code}); restarting`); setTimeout(() => cluster.fork(), 500);
  });
  // The platform stops an instance with SIGTERM: pass it to every worker so each finishes the requests it is serving (a checkout in progress
  // is never cut off), then exit. After 25 s whatever is left is stopped.
  const drain = () => { if (stopping) return; stopping = true; for (const w of Object.values(cluster.workers)) w.process.kill('SIGTERM'); setTimeout(() => process.exit(0), 25000).unref(); };
  process.on('SIGTERM', drain); process.on('SIGINT', drain);
} else start().catch((e) => { console.error('Failed to start:', e); process.exit(1); });
