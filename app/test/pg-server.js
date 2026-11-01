// A real PostgreSQL server for local testing (the embedded PGlite used by default is a single-connection stand-in).
//   node test/pg-server.js            -> starts Postgres 18 on :5439 with a throw-away data folder, prints the DATABASE_URL, runs until stopped
//   DATABASE_URL=postgres://postgres:tp@127.0.0.1:5439/tp npm test          (the whole API suite, against real Postgres + a connection pool)
//   DATABASE_URL=... node server.js                                          (the server, against real Postgres)
import EmbeddedPostgres from 'embedded-postgres';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const port = Number(process.env.PGPORT || 5439);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-pg-'));
const pg = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'tp', port, persistent: false, initdbFlags: ['--encoding=UTF8', '--locale=C'], onLog: () => {}, onError: (e) => console.error('[pg]', String(e).slice(0, 200)) });
await pg.initialise(); await pg.start(); await pg.createDatabase('tp');
console.log(`READY postgres://postgres:tp@127.0.0.1:${port}/tp   (data: ${dir})`);
const stop = async () => { try { await pg.stop(); } catch { /* already down */ } fs.rmSync(dir, { recursive: true, force: true }); process.exit(0); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
setInterval(() => {}, 1 << 30);
