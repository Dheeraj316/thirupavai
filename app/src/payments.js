// Payment gateway adapter. `mock` is a test gateway for staging; `razorpay` is the live one (needs your Razorpay keys).
import crypto from 'node:crypto';
import { cfg } from './config.js';

const hmac = (secret, data) => crypto.createHmac('sha256', secret).update(data).digest('hex');
const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

export const gateway = {
  mode: () => cfg.payments.mode,
  // Create the gateway-side order for an intent. Amount is in rupees; Razorpay wants paise.
  async create(intent) {
    if (cfg.payments.mode === 'mock') return { mode: 'mock', ref: 'mock_' + intent.id };
    const { keyId, keySecret } = cfg.payments.razorpay;
    const r = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Basic ' + Buffer.from(keyId + ':' + keySecret).toString('base64') },
      body: JSON.stringify({ amount: intent.amount * 100, currency: 'INR', receipt: intent.id, notes: { intent: intent.id } }), signal: AbortSignal.timeout(10000),
    });
    const j = await r.json(); if (!r.ok) throw new Error('Razorpay: ' + (j.error?.description || r.status));
    return { mode: 'razorpay', ref: j.id, keyId };
  },
  // Send money back to the customer. In mock mode there is nothing to call.
  async refund(paymentId, amount, reason) {
    if (cfg.payments.mode === 'mock') return { id: 'rfnd_mock_' + String(paymentId).slice(-8) };
    const { keyId, keySecret } = cfg.payments.razorpay;
    const r = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/refund`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Basic ' + Buffer.from(keyId + ':' + keySecret).toString('base64') },
      body: JSON.stringify({ amount: amount * 100, speed: 'normal', notes: { reason: String(reason || '').slice(0, 200) } }), signal: AbortSignal.timeout(15000),
    });
    const j = await r.json(); if (!r.ok) throw new Error('Razorpay: ' + (j.error?.description || r.status));
    return { id: j.id };
  },
  // Browser callback after Razorpay checkout: order_id|payment_id signed with the key secret.
  verifyCheckout({ orderId, paymentId, signature }) { return safeEq(hmac(cfg.payments.razorpay.keySecret, orderId + '|' + paymentId), signature); },
  // Server-to-server webhook: raw body signed with the webhook secret.
  verifyWebhook(raw, signature) { return !!cfg.payments.razorpay.webhookSecret && safeEq(hmac(cfg.payments.razorpay.webhookSecret, raw), signature); },
  // Mock gateway outcome from the test UPI id (same convention as the prototype).
  mockOutcome(vpa) { return /^fail/i.test(String(vpa || '')) ? 'failed' : /^pending/i.test(String(vpa || '')) ? 'pending' : 'captured'; },
  hmac,
};
