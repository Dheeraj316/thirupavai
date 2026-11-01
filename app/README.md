# Thirupavai server

Fastify 5 + PostgreSQL + Redis. Serves the storefront (`../site`, copied to `public/`) and the JSON API under `/api`. Stateless: sessions, sign-in codes and rate limits live in Redis, data in Postgres, so more instances = more capacity.

```
npm install
npm run build          # copies ../site -> public/ and pre-compresses the text files
npm start              # development: embedded database + in-memory store, sign-in codes shown on screen, fake payments
npm test               # 61 tests (embedded database)
```

Open http://127.0.0.1:8080. In development the first Super Admin is whoever you put in `SEED_ADMIN_MOBILE`.

## Testing against the real stack

```
node test/pg-server.js                         # a real PostgreSQL on :5439 (throw-away data folder)
node test/redis-lite.js                        # a tiny Redis-protocol server on :6390 (stand-in; proves our commands, not Redis performance)
TEST_DATABASE_URL=postgres://postgres:tp@127.0.0.1:5439/tp TEST_REDIS_URL=redis://127.0.0.1:6390 npm test
DATABASE_URL=... REDIS_URL=... node server.js  # run the server on them
node ../site/tools/smoke_online.js http://127.0.0.1:8080/    # browser end-to-end (needs a fresh database each run)
```

## Load tests

```
node test/endpoints.js                                      # raw speed of single endpoints
node test/pg-rate.js                                        # raw speed of the sign-in database write
node test/load.js http://127.0.0.1:8101 http://127.0.0.1:8102 --users 10000 --concurrency 1000
```
`load.js` takes several base URLs (instances behind a load balancer) and sends each customer's requests to *different* ones. Start the server with `OTP_PER_IP`, `API_RATE_PER_MIN`, `OTP_DAILY_CAP` raised (see the header of `test/load.js`). For the 10,000-at-once test on staging use `test/k6-login-storm.js` from a separate machine. See `../GO-LIVE.md`.

## Layout

| | |
|---|---|
| `server.js` | entry; `WEB_CONCURRENCY` > 1 forks workers (needs a database) and drains them on shutdown |
| `src/config.js` | every setting comes from the environment; production refuses to start in an unsafe setup |
| `src/app.js` | all routes: auth, catalogue, checkout, orders, admin, tickets, webhook |
| `src/db.js` | schema, seed, Postgres pool (embedded PGlite for development and tests) |
| `src/kv.js` | Redis (production) or in-memory store |
| `src/pricing.js` | the only place a price is ever computed — the browser's numbers are ignored |
| `src/payments.js` | Razorpay orders, signature checks, refunds; a mock gateway for staging |
| `scripts/build-public.js` | storefront → `public/` |
| `.env.example` | every setting, documented |
