# Thirupavai

An online store for Kanchipuram sarees, built for a saree shop: a 3D storefront, mobile-OTP sign-in, server-priced checkout, order tracking and an admin console. It runs as one small Fastify server in front of PostgreSQL and Redis.

The storefront is plain JavaScript with Three.js for the 3D parts, with no front-end framework and no build step for the site itself. The server is where the rules live: prices, stock and payments are decided on the server, never in the browser.

> **Status:** a staging copy runs on Render with test payments and on-screen OTP codes. Production waits on things only the shop owner can supply (SMS registration, payment gateway KYC, a domain). The product photos in the repo are AI-generated concept images, not the shop's real catalogue. See [GO-LIVE.md](GO-LIVE.md).

## What it does

- **Storefront:** a scroll-driven 3D silk tunnel on the home page, a shop with grid and draggable 3D ring views, real filters kept in the URL, product pages with zoom, 3D drape and a studio-light switcher, a bag, compare tray and a command palette (`Ctrl+K`).
- **Checkout:** sign in with a mobile OTP, address with PIN validation, server-side price and stock re-check, duplicate-order protection, test-mode payments on staging.
- **Orders:** a seven-stage timeline, order tracking for guests, invoices, support tickets.
- **Admin console:** role-checked access, catalogue and price edits that go live immediately, order handling, refunds, tickets, masked customer data.

## How it is built

| Part | Stack |
|---|---|
| `site/` | JavaScript, CSS, Three.js, WebP images, static files |
| `app/` | Node.js, Fastify 5, PostgreSQL (`pg`), Redis (`ioredis`) |
| Tests | Node test runner, Playwright, autocannon |
| Deploy | Dockerfile, Render blueprint files (`render.*.yaml`) |

```
browser  ->  Fastify server(s)  ->  PostgreSQL   (orders, stock, users)
                    |
                    +----------->  Redis        (sessions, OTP codes, rate limits)
```

The web servers keep no state of their own. Sessions, sign-in codes and rate limits live in Redis and data lives in Postgres, so capacity grows by adding instances.

Things worth looking at in the code:

- `app/src/pricing.js` is the only place a price is ever computed. Whatever the browser sends is ignored.
- `app/src/config.js` takes every setting from the environment and refuses to start in production with an unsafe setup.
- `app/src/db.js` holds the schema and uses row locks so two buyers cannot both get the last piece.
- `app/src/payments.js` verifies payment signatures and webhooks, with a mock gateway for staging.

## Tests and results

| Check | Result |
|---|---|
| Server tests (`npm test` in `app/`): sign-in and OTP limits, server pricing, checkout, double-click safety, last-piece race, refunds, roles, masking, tickets, webhook, production safety checks | 61 / 61 |
| Same tests on a real PostgreSQL 18 and the Redis protocol | 48 / 48, three runs in a row |
| Browser end-to-end with Playwright (sign in, pay, order, guest tracking, last piece sold once, admin moves the order, customer cannot enter admin) | 35 / 35 |
| Load: 10,000 simulated customers signing in across 4 instances sharing one database and one session store | 10,000 / 10,000, zero errors, 13.5 s |

The load figures were measured on one laptop that was also running the load generator, the database and every instance, so they are a floor, not a ceiling. Details, and what is not yet proven, are in [GO-LIVE.md](GO-LIVE.md).

## Run it locally

You need Node.js. The development mode uses an embedded database and an in-memory store, so there is nothing else to install.

```bash
cd app
npm install
npm run build      # copies ../site into public/ and pre-compresses the text files
npm start          # http://127.0.0.1:8080, OTP codes shown on screen, fake payments
npm test           # 61 tests
```

To try the storefront alone as a clickable prototype, run `node server.js` inside `site/` and open http://127.0.0.1:4173.

More commands (real Postgres and Redis, browser end-to-end, load tests) are in [app/README.md](app/README.md).

## Deploying

The `Dockerfile` does a production-only install, builds and starts the server. The `render.*.yaml` files describe the staging, production and load-test environments. Secrets are read from environment variables and are not stored in the repo.

## Repository layout

```
site/      storefront and admin front end (plain JS, Three.js)
app/       Fastify server, tests, load tests
Dockerfile, render.*.yaml   deployment
GO-LIVE.md what is proven, what is missing, the launch steps
```
