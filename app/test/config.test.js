// Production must refuse to start in any unsafe setup. Each case boots config.js in a child process with a hostile environment.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const GOOD = { NODE_ENV: 'production', APP_SECRET: 'x'.repeat(40), DATABASE_URL: 'postgres://u:p@db/tp', REDIS_URL: 'redis://r:6379', OTP_MODE: 'sms', MSG91_AUTHKEY: 'k', PAYMENTS_MODE: 'razorpay', RAZORPAY_KEY_ID: 'rzp_live_x', RAZORPAY_KEY_SECRET: 's', PUBLIC_URL: 'https://www.thirupavai.example' };
const run = (env) => {
  const clean = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...env };
  return spawnSync(process.execPath, ['--input-type=module', '-e', "import('./src/config.js').then((m) => m.assertSafe())"], { cwd: root, env: clean, encoding: 'utf8' });
};

describe('assertSafe()', () => {
  it('accepts a complete production configuration', () => { const r = run(GOOD); assert.equal(r.status, 0, r.stderr); });
  const cases = [
    ['no APP_SECRET', { APP_SECRET: '' }, /APP_SECRET/],
    ['demo OTP (codes would appear in API responses)', { OTP_MODE: 'demo' }, /OTP_MODE=demo/],
    ['SMS mode with no provider key', { MSG91_AUTHKEY: '' }, /MSG91_AUTHKEY/],
    ['mock payments without the staging switch', { PAYMENTS_MODE: 'mock' }, /ALLOW_MOCK_PAYMENTS/],
    ['Razorpay without keys', { RAZORPAY_KEY_ID: '' }, /RAZORPAY_KEY_ID/],
    ['no database', { DATABASE_URL: '' }, /DATABASE_URL/],
    ['no Redis (sessions would not be shared between instances)', { REDIS_URL: '' }, /REDIS_URL/],
  ];
  for (const [name, patch, re] of cases) it('refuses to start with ' + name, () => { const r = run({ ...GOOD, ...patch }); assert.equal(r.status, 1); assert.match(r.stderr, re); });
  const STAGING = { PUBLIC_URL: 'https://staging.thirupavai.example', OTP_MODE: 'demo', ALLOW_DEMO_OTP: '1', PAYMENTS_MODE: 'mock', ALLOW_MOCK_PAYMENTS: '1' };
  it('lets a staging site use test codes and the mock gateway when both are switched on', () => { const r = run({ ...GOOD, ...STAGING }); assert.equal(r.status, 0, r.stderr); });
  it('refuses test codes on a site whose address is not staging, even with the switch on', () => { const r = run({ ...GOOD, ...STAGING, PUBLIC_URL: 'https://www.thirupavai.example' }); assert.equal(r.status, 1); assert.match(r.stderr, /ALLOW_DEMO_OTP/); });
  it('refuses the mock gateway on a site whose address is not staging, even with the switch on', () => { const r = run({ ...GOOD, PAYMENTS_MODE: 'mock', ALLOW_MOCK_PAYMENTS: '1' }); assert.equal(r.status, 1); assert.match(r.stderr, /ALLOW_MOCK_PAYMENTS/); });
  it('refuses test codes with no PUBLIC_URL at all', () => { const r = run({ ...GOOD, ...STAGING, PUBLIC_URL: '' }); assert.equal(r.status, 1); });
  it('never complains in development', () => { const r = run({ NODE_ENV: 'development' }); assert.equal(r.status, 0, r.stderr); });
});
