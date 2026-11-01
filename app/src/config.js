// All runtime settings come from environment variables (see ../.env.example). Production refuses to start in an unsafe mode.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const env = process.env;
const prod = env.NODE_ENV === 'production';
const num = (v, d) => (v === undefined || v === '' ? d : Number(v));

export const cfg = {
  prod,
  port: num(env.PORT, 8080),
  staticDir: path.resolve(env.STATIC_DIR || path.join(here, '..', 'public')),
  databaseUrl: env.DATABASE_URL || '',            // empty -> embedded PGlite (development and tests only)
  pgPool: num(env.PG_POOL_MAX, 20),
  pgSsl: env.PGSSL === '0' ? false : prod,        // managed Postgres needs TLS
  redisUrl: env.REDIS_URL || '',                  // empty -> in-memory store (single instance only)
  secret: env.APP_SECRET || (prod ? '' : 'dev-secret-change-me'),
  sessionDays: num(env.SESSION_DAYS, 30),
  workers: num(env.WEB_CONCURRENCY, 1),
  otp: {
    mode: env.OTP_MODE || (prod ? 'sms' : 'demo'),   // demo = code is returned in the API response (never allowed in production)
    ttl: 300, maxAttempts: 3, lockSeconds: 600,
    perMobile: num(env.OTP_PER_MOBILE, 4),          // sends per 10 minutes for one number
    perIp: num(env.OTP_PER_IP, 300),                // sends per 10 minutes for one IP (mobile networks share IPs)
    dailyCap: num(env.OTP_DAILY_CAP, 200000),       // hard stop on SMS spend
  },
  sms: { provider: env.SMS_PROVIDER || 'msg91', authKey: env.MSG91_AUTHKEY || '', templateId: env.MSG91_TEMPLATE_ID || '', sender: env.MSG91_SENDER || 'THIRPV' },
  payments: {
    mode: env.PAYMENTS_MODE || (prod ? 'razorpay' : 'mock'),   // mock = test gateway, razorpay = real
    allowMock: env.ALLOW_MOCK_PAYMENTS === '1',
    razorpay: { keyId: env.RAZORPAY_KEY_ID || '', keySecret: env.RAZORPAY_KEY_SECRET || '', webhookSecret: env.RAZORPAY_WEBHOOK_SECRET || '' },
  },
  seedAdminMobile: (env.SEED_ADMIN_MOBILE || '').replace(/\D/g, '').slice(-10),
  ipLimit: num(env.API_RATE_PER_MIN, 900),          // API requests per IP per minute
  trustProxy: env.TRUST_PROXY !== '0',
  publicUrl: env.PUBLIC_URL || '',
  // shown to customers (footer, invoices, help); set these before going live
  business: { name: env.BUSINESS_NAME || 'Thirupavai', gstin: env.GSTIN || '', supportEmail: env.SUPPORT_EMAIL || '', supportPhone: env.SUPPORT_PHONE || '' },
};

export function assertSafe() {
  const bad = [];
  if (prod && !cfg.secret) bad.push('APP_SECRET is required in production');
  // Test sign-in codes and the fake payment gateway exist for the staging site only. They need an explicit switch AND a public address that says "staging",
  // so a leftover setting can never switch them on for the real shop (demo codes in API responses would let anyone sign in as anyone).
  const host = (() => { try { return new URL(cfg.publicUrl).hostname; } catch { return ''; } })();     // judged on the host name only, not on the path or query
  const staging = /staging|^localhost$|^127\.0\.0\.1$/i.test(host);
  if (prod && cfg.otp.mode === 'demo') {
    if (env.ALLOW_DEMO_OTP !== '1') bad.push('OTP_MODE=demo would return login codes in API responses — not allowed in production (staging only: ALLOW_DEMO_OTP=1)');
    else if (!staging) bad.push('ALLOW_DEMO_OTP=1 is only accepted when PUBLIC_URL is a staging address (it contains "staging")');
  }
  if (prod && cfg.otp.mode === 'sms' && !cfg.sms.authKey) bad.push('MSG91_AUTHKEY (or another SMS provider key) is required for OTP_MODE=sms');
  if (prod && cfg.payments.mode === 'mock') {
    if (!cfg.payments.allowMock) bad.push('PAYMENTS_MODE=mock needs ALLOW_MOCK_PAYMENTS=1 (staging only)');
    else if (!staging) bad.push('ALLOW_MOCK_PAYMENTS=1 is only accepted when PUBLIC_URL is a staging address (it contains "staging")');
  }
  if (prod && cfg.payments.mode === 'razorpay' && !(cfg.payments.razorpay.keyId && cfg.payments.razorpay.keySecret)) bad.push('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required for PAYMENTS_MODE=razorpay');
  if (prod && !cfg.databaseUrl) bad.push('DATABASE_URL is required in production');
  if (prod && !cfg.redisUrl && env.ALLOW_MEMORY_KV !== '1') bad.push('REDIS_URL is required in production (sessions and rate limits must be shared between instances)');
  if (bad.length) { console.error('Refusing to start:\n - ' + bad.join('\n - ')); process.exit(1); }
}
