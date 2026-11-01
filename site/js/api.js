// Connection to the Thirupavai server. /config.js (served by the real server) turns this on; without it the storefront
// runs as the offline demo and keeps everything in the browser. Three modes:
//   demo    — no server; sample data in localStorage (what the smoke tests exercise)
//   staging — real server + database + sign-in, but a test payment gateway
//   live    — real server + real payments
const C = (typeof window !== 'undefined' && window.TP_CONFIG) || { api: false };
export const conf = C;
export const ONLINE = !!C.api;
export const MODE = !ONLINE ? 'demo' : C.paymentsMode === 'razorpay' ? 'live' : 'staging';
export const LIVE = MODE === 'live';
export const biz = { name: 'Thirupavai', gstin: '', supportEmail: '', supportPhone: '', ...(C.business || {}) };
/** pick the wording for the current mode: demo text for the prototype, live text for the real shop (staging = live wording unless given) */
export const T = (demo, live, staging = live) => (MODE === 'demo' ? demo : MODE === 'staging' ? staging : live);

export class ApiError extends Error {
  constructor(status, message, data) { super(message); this.status = status; this.data = data || null; }
}

export async function api(method, url, body, opts = {}) {
  const init = { method, credentials: 'same-origin', headers: { 'x-tp': '1' }, signal: AbortSignal.timeout(20000), ...opts };
  if (body !== undefined) { init.headers['content-type'] = 'application/json'; init.body = JSON.stringify(body); }
  let res;
  try { res = await fetch(url, init); }
  catch { throw new ApiError(0, 'We could not reach the server. Please check your connection and try again.'); }
  let data = null; try { data = await res.json(); } catch { /* empty or non-JSON body */ }
  if (!res.ok || (data && data.ok === false)) {
    throw new ApiError(res.status, data?.error || (res.status === 429 ? 'Too many attempts. Please wait a moment and try again.' : res.status >= 500 ? 'Something went wrong on our side. Please try again.' : 'That did not work. Please try again.'), data);
  }
  return data;
}
export const get = (u) => api('GET', u);
export const post = (u, b = {}) => api('POST', u, b);
export const patch = (u, b = {}) => api('PATCH', u, b);
export const put = (u, b = {}) => api('PUT', u, b);
export const del = (u) => api('DELETE', u);

/** the API reports problems to the page through one event, so views and the store need not import the toast */
export const notifyError = (e) => { try { dispatchEvent(new CustomEvent('tp:error', { detail: e?.message || String(e) })); } catch { /* ignore */ } };

export function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script'); s.src = src; s.async = true; s.onload = () => resolve(); s.onerror = () => reject(new ApiError(0, 'Could not load the payment window. Please check your connection.'));
    document.head.appendChild(s);
  });
}
