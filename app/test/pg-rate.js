// How fast can this Postgres take the sign-in write (INSERT a new customer)? Usage: DATABASE_URL=... node test/pg-rate.js [rows=10000] [connections=80]
import pg from 'pg';
const url = process.env.DATABASE_URL || 'postgres://postgres:tp@127.0.0.1:5439/tp';
const rows = Number(process.argv[2] || 10000), conns = Number(process.argv[3] || 80);
const pool = new pg.Pool({ connectionString: url, max: conns });
const base = 800000000 + Math.floor(Math.random() * 90000000);
const run = async (label, sql, args) => {
  const t0 = performance.now(); let next = 0;
  await Promise.all(Array.from({ length: conns }, async () => { for (;;) { const i = next++; if (i >= rows) return; await pool.query(sql, args(i)); } }));
  const s = (performance.now() - t0) / 1000; console.log(label.padEnd(44), (rows / s).toFixed(0).padStart(7), 'queries/s', `(${s.toFixed(1)} s for ${rows})`);
};
await run('INSERT new customer (as the app does)', 'INSERT INTO users (mobile, last_login) VALUES ($1, now()) ON CONFLICT (mobile) DO UPDATE SET last_login = now() RETURNING id, mobile, name', (i) => ['9' + String(base + i)]);
await run('SELECT returning customer (read only)', 'SELECT id, mobile, name, last_login FROM users WHERE mobile=$1', (i) => ['9' + String(base + i)]);
await pool.end();
