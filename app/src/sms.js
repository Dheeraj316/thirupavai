// SMS delivery for one-time codes. Swap the provider here without touching the rest of the app.
import { cfg } from './config.js';

export async function sendOtp(mobile, code) {
  if (cfg.otp.mode === 'demo') return { demo: true };
  if (cfg.sms.provider === 'msg91') {
    const qs = new URLSearchParams({ template_id: cfg.sms.templateId, mobile: '91' + mobile, authkey: cfg.sms.authKey, otp: code, realTimeResponse: '1' });
    const r = await fetch('https://control.msg91.com/api/v5/otp?' + qs, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(8000) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.type === 'error') throw new Error('SMS provider rejected the request: ' + (j.message || r.status));
    return { provider: 'msg91' };
  }
  throw new Error('Unknown SMS provider: ' + cfg.sms.provider);
}
