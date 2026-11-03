# Thirupavai — going live

This is the real shop: the same storefront and admin as the prototype, now backed by a server, a database, SMS sign-in, real payments and a role-checked admin console.
Everything below is split into **what has been proven**, **what only you can supply**, and **the steps**.

---

## 1. What has been proven (and how)

| Check | Result |
|---|---|
| Server tests (`cd app && npm test`) — sign-in, OTP limits, server-side pricing, checkout, double-click safety, last-piece race, refunds, roles, masking, tickets, webhook, production safety checks | **61 / 61** |
| Same tests on a **real PostgreSQL 18** (connection pool, real row locks) and the Redis protocol | **48 / 48**, three runs in a row |
| Browser end-to-end (`site/tools/smoke_online.js`): sign in by code, pay, order, guest tracking, last piece sold to one buyer, admin moves the order, price edit goes live, customer can't enter admin | **35 / 35** — also against the production-mode build on a fresh database |
| Offline demo build (`site/tools/smoke.js`) — unchanged | **61 / 61** |
| **Load: 10,000 customers sign in** (request code → verify → session → catalogue), spread over 4 server instances sharing one database and one session store, 1,000 in flight at a time | **10,000 / 10,000, 0 errors, 13.5 s, slowest step under 2.7 s** |
| Load: 10,000 customers all in flight in the same instant, one server process | 10,000 / 10,000, 0 errors, drained in 15–18 s (waits of 5–9 s during the spike) |
| One process, single endpoints | 17–20 k requests/s for catalogue/session/health, 6.7 k/s for the home page, ~4 k/s for "send code" (with Redis) |

**Read the load numbers honestly.** They were measured on one laptop that was also running the load generator, the database, the cache and every server instance, over one network stack — so they are a *floor*, not a ceiling. When I pushed all 10,000 customers into the same instant across 4 instances, the laptop itself ran out of network buffers (Windows `ENOBUFS`), which says nothing about the app. The real proof is the staging load test in section 4, run from a separate machine.

What "handles 10,000 at once" means here: the web servers keep **no state** (sessions, codes and limits live in Redis; data in Postgres), so capacity grows by adding instances. One process sustained ~650 full sign-ins/s while sharing the laptop; the plan in `render.production.yaml` runs 3 instances × 2 processes on a real 2-core machine each.

**Not yet proven** (needs the real accounts): real Redis and Render Postgres over TLS, a real SMS arriving, a real Razorpay payment and webhook, the Docker image itself (I could not run Docker here; I replayed its steps exactly — clean copy, production-only install, build, boot in production mode — and they pass), Linux multi-process mode.

---

## 2. What only you can supply — these block launch

1. **Accounts** (you create them; I never see passwords): GitHub (to hold the code), Render (to host it), MSG91 (SMS), Razorpay (payments). For Render and GitHub, send me an invite or a deploy token and I can run the deployment; or do the 6 clicks in section 3 yourself.
2. **SMS in India needs DLT registration** (TRAI rule): register the business as an entity, the sender ID (e.g. `THIRPV`) and the OTP message template on a DLT portal, then give the template id to MSG91. This takes days, so start it first. Until then use staging (codes shown on screen).
3. **Razorpay KYC and live keys**: business documents → live `key_id` / `key_secret`, then a webhook secret. Webhook URL: `https://<your-domain>/api/payments/webhook`, events `payment.captured` and `order.paid`.
4. **Business facts for the footer and invoices**: legal name, GSTIN, support email and phone (`BUSINESS_NAME`, `GSTIN`, `SUPPORT_EMAIL`, `SUPPORT_PHONE`).
5. **Policy pages**: shipping, returns, privacy and terms are drafted in `site/js/views/misc.js` (`SHOP_PAGES`) from how the system actually behaves. **They are not legal advice — have your lawyer review and replace them.**
6. **Real product copy and photography**: descriptions in `site/js/data.js` were placeholders (the shop hides the word "Sample" but the text is still generic), and the images are AI-generated concept imagery. Replace with licensed or original photographs and real descriptions, weaves, lengths and care notes.
7. **The domain**: the name you will use (and its DNS). Until it is yours, the site runs on `*.onrender.com`.
8. **Returns and shipping rules**: "7-day return, final-sale add-ons, free standard / ₹350 express" are in the text and the pricing code — confirm they are your real rules.

## 3. Deploy (once the accounts exist)

1. Put this folder on GitHub (`.gitignore` already leaves out the film, deck and design work).
2. Render → **New → Blueprint** → pick the repo → it reads `render.yaml` and creates the staging site, its database and its key-value store (Singapore). Enter the mobile number of the first Super Admin when asked. `render.yaml` uses paid plans (Render asks for a card). To try staging at no cost, set **Blueprint Path** to `render.staging-free.yaml` instead: same app and switches on Render's free plans — good for the acceptance list below, not for the load test (the free web server sleeps when idle, the free database expires after 30 days).
3. Open `https://thirupavai-staging.onrender.com`. Staging shows sign-in codes on screen and uses a fake payment gateway, so nothing real is charged or texted. (The server *refuses* to run test codes or fake payments on any address that does not contain "staging".)
4. Run the staging acceptance list (section 4). When it passes, create the real shop: **New → Blueprint → Blueprint file path `render.production.yaml`**, fill in the secrets it asks for, add the custom domain, press **Deploy**. Production never deploys by itself.
5. In Razorpay, add the webhook; in the admin console (`/#/admin`) sign in with the seeded number and add your staff under **Roles & security → Staff access**.

## 4. Staging acceptance list

- [ ] Sign in with a new number, buy a piece with `success@upi`, see the order; try `fail@upi` and see no order is made.
- [ ] Two phones race for the last piece: exactly one wins.
- [ ] In admin: move the order Processing → Packed (checklist) → Dispatched; the customer's page shows it within 20 s.
- [ ] Edit a price in admin; the shop shows it on the next page open, and checkout charges it.
- [ ] A staff member with *Customer Support* sees masked phone numbers and cannot move orders.
- [ ] **Load test from a separate machine** (k6 Cloud or any cloud VM — not a laptop): `k6 run -e BASE=https://thirupavai-staging.onrender.com -e VUS=10000 app/test/k6-login-storm.js`. For the duration of the test set `OTP_PER_IP`, `API_RATE_PER_MIN`, `OTP_DAILY_CAP`, `OTP_PER_MOBILE` to very large values on staging (the abuse guards would block one address) and restore them after. **Pass = under 0.5 % errors, p95 < 1.5 s, p99 < 3 s.** If it misses, add instances or move the database up a plan, and repeat.
- [ ] Never run that test against production.

### 4b. The 10,000-user load test — plan (not yet run at full size)

**Free-plan check already done (2026-11-03, `thirupavai-staging.onrender.com`, one free instance, default abuse limits):** 200 customers with 20 in flight — 200/200 signed in, 0 errors, slowest step 1.3 s; 100 customers all at once — 100/100 signed in, 0 errors, "request code" p99 3.2 s (3 s is the pass mark). This only shows the free instance is healthy and fast at small scale; it says nothing about 10,000 users, and the free web server sleeps when idle and has a fraction of a CPU. The full test below needs the paid copy.


1. **Paid copy of staging, ready to deploy: `render.loadtest.yaml`** (3 web instances of `1c-2g`, Postgres `1c-2g`, key-value `1g`, abuse limits already raised, address `thirupavai-staging-load.onrender.com`). In Render: New → Blueprint → this repository → Blueprint file path `render.loadtest.yaml`. Render asks for a card for paid plans; you add it. Billing is per second. Render's pricing pages could not be read automatically, so check the monthly total shown on the Blueprint page before pressing Apply (the plan names are Render's own; third-party lists suggest roughly $100–150 a month for this size, i.e. a few dollars for a few hours). **Delete the Blueprint's services as soon as the test is done.**
2. **The abuse limits are raised in that copy only** (`OTP_PER_IP`, `API_RATE_PER_MIN`, `OTP_DAILY_CAP`, `OTP_PER_MOBILE`). Never copy them to production.
3. **Run the load from outside the servers.** From a PC with Node: `node app/test/load.js https://thirupavai-staging-load.onrender.com --users 10000 --concurrency 2000` (10,000 customers each request a code, sign in, read their session and the catalogue; prints errors and p50/p95/p99 per step and exits 1 on a miss). For a harder, many-address test use k6: `k6 run -e BASE=https://thirupavai-staging-load.onrender.com -e VUS=10000 app/test/k6-login-storm.js` from k6 Cloud or a cloud machine (10,000 virtual users for about 2 minutes is roughly 330 VU-hours; k6 Cloud's free plan includes 500 VU-hours a month, but whether it allows 10,000 at once has not been confirmed; pay-as-you-go is about $0.15 per VU-hour).
4. **Pass mark:** under 0.5 % errors, 95 % of requests under 1.5 s and 99 % under 3 s. If it misses, add instances (`numInstances`) or a bigger database, then repeat.
5. **Also run the user journeys** (`site/tools/journeys.js`) against the same staging while it is under load: they show what a real shopper feels, not just the numbers.

## 5. Operating it

- **Before a sale or campaign**: raise `numInstances` (or turn on Render autoscaling, a Pro-workspace feature) a day ahead; check database connections: `instances × WEB_CONCURRENCY × PG_POOL_MAX` must stay under the database limit (put pgbouncer in front if you need more — Render offers `connectionPool: pgbouncer`).
- **Put a CDN in front** (Cloudflare or similar): the static files are fingerprint-less but pre-compressed and cache-friendly, and a CDN removes most browsing traffic from the servers.
- **Backups**: use a Postgres plan with daily backups (and point-in-time recovery if you can); test a restore once.
- **Monitoring**: add an uptime monitor on `/healthz` (liveness) and `/readyz` (database + Redis), and an error tracker (Sentry) — the server logs errors as JSON to Render's log stream.
- **Money**: refunds in the admin console call Razorpay's refund API and are claimed atomically (two clicks cannot refund twice). A payment that succeeds while the customer's browser dies is completed by the webhook.
- **Secrets**: rotate `RAZORPAY_KEY_SECRET` / `MSG91_AUTHKEY` if they are ever exposed; they live only in Render's environment.

## 6. Known limits (honest list)

- **No outbound messages yet**: no order-status SMS/email/WhatsApp, and support replies are saved on the ticket — staff must contact the customer by phone/email. The "Alerts sent" panel is hidden online so the page does not claim notifications that are not sent.
- **No courier integration**: the AWB number is typed by staff (or auto-filled `AWB-<order>`); tracking is by stage, not live GPS.
- **No GST invoice PDF**: the invoice is an on-screen, printable summary.
- **Admin lists the latest 500 orders**; dashboard totals come from the database and are exact. Search/paging beyond 500 is a later step.
- **Video-consult, back-in-stock and newsletter sign-ups arrive as support tickets** (channels "Visit request", "Notify me", "Newsletter") — your team must act on them.
- `npm audit` reports 3 moderate advisories in a file-glob helper used by the static-file plugin; it only matters if untrusted patterns reach it, which they do not. Fixing it means a breaking downgrade; revisit when the plugin updates.
