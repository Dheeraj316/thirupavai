# THIRUPAVAI — Clickable 3D Saree Store (concept prototype)

A working, clickable prototype of the Thirupavai store **and** its admin console. It runs entirely on your PC with sample data. **It is not a live shop**: no real payments, couriers, SMS, email or customer data are involved.

## Run it
Double-click `start.bat` (needs Node.js) → opens http://127.0.0.1:4173
Or: `node server.js` in this folder. No install step; no internet needed.

Use **Reset demo data** (top bar) any time to return to the starting sample.

## What you can try (storefront)
| Area | What works |
|---|---|
| Home | Lotus golden-thread intro (skippable) → arched hero with kinetic type and a rotating badge → marquee → **scroll-driven 3D silk tunnel** (camera flies through six real cloth panels; click one to open that saree) → pinned **horizontal "houses of silk" track** → new arrivals, edits, craft parallax, newsletter |
| Shop | **Grid / 3D Ring toggle** — the ring is a draggable, inertia-driven carousel in real CSS 3D space (drag, swipe, arrow keys, Prev/Next). **Real filters** — fabric, colour, occasion, collection, price range, in-stock, search; counts update; filters live in the URL; sort; applied-filter chips; empty state; mobile filter sheet |
| Product | The page **re-tints the living silk backdrop to the saree's colour**. 4–6 images per saree, thumbnails, keyboard arrows, swipe, full-screen lightbox, **hover zoom lens**, tilt + moving glare, **Photos / 3D drape toggle** (simulated cloth, drag to tilt), specs, add-ons (fall & pico, stitching, gift), **PIN-code check**, wishlist, video-consult request, authenticity-passport sample, **sticky buy bar** once the main button scrolls away, related items, product structured data |
| Bag | Drawer with quantity, coupon (`FESTIVE5`, `WELCOME10` over ₹25,000), totals; works without login |
| Checkout | **Mobile-OTP sign-in at checkout** (bag preserved; the demo OTP is shown on screen), address with PIN validation and city auto-fill, delivery options, **test-mode payment**, server-style stock/price re-check, **duplicate-order protection** |
| Order | Gold-thread celebration on confirm, 7-stage timeline, dark route map with a glowing travelled path and a pulsing vehicle marker, alerts feed, invoice, "Need help?" (creates a support ticket) |
| Other | Our Story (scroll-linked weave zoom), wishlist, account/track-an-order, FAQs, shipping/returns/privacy/terms/security pages, contact form |

**Test payments:** UPI `success@upi` (paid), `fail@upi` (declined — bag kept, no order), `pending@upi` (order held until the gateway callback). Card `4111 1111 1111 1111` approved, `4000 0000 0000 0002` declined. Card numbers/CVV are never stored.

## Advanced options (new)
| Feature | What it does |
|---|---|
| **Find my saree** (floating pill, bottom-left) | A three-question stylist — occasion, up to two colours, budget — that ranks the catalogue and shows your top three with a match % and the reasons, plus a link to the pre-filtered shop. |
| **Command palette** (`Ctrl/⌘ + K`) | Jump to any page, open the bag, start the stylist, switch the shop between Grid and 3D Ring, or find a saree by typing — arrow keys + Enter. |
| **Compare** (icon on every card) | Pick up to three sarees; a tray slides up and opens a side-by-side table (fabric, weave, colour, care, returns, availability, lowest-price badge) with Add to bag. |
| **Light studio** (product page) | Re-light the saree in Daylight / Candlelight / Wedding hall / Moonlit — the photo, the 3D drape and the living backdrop all change. |
| **Ambient sound** (equaliser button) | Optional synthesized tanpura drone and soft temple bells (no audio files; off until you press it). |
| **Gold scroll thread** | A slim gold thread on the right edge that fills as you scroll. |

## Design direction — "one motif, in a dark room"
The look is **art-directed, not templated**. Two ideas from the Taste/Impeccable design skills drive it: *one motif* and *the dark room*.

- **One motif, from the subject.** The stepped *gopuram* profile of a Kanchipuram temple border is the only shape the system uses, at four scales: the hero's stepped arch (and the same arch on the craft and story images), the stepped corners of the silk slabs and edit tiles, the woven border strip that frames the marquee and tops the footer, and the small glyph that is the arrow on buttons and the bullet in lists. Defined once in `css/atelier.css` (`--step`, `--zg`, `--zgtile`).
- **The dark room.** One brown-black ground; photographs are the brightest things on screen; the WebGL silk is a room tone (55% opacity, a few motes of zari), not the subject. No glass, no glow, no gradient text, no hairline boxes — tone steps instead. Gold appears only as flat zari on actions and the motif.
- **The name as monument.** The first screen is the wordmark at full width, cropped by the bottom edge, with the arch photograph and a five-word line (*Tradition, woven into tomorrow.*) above it. The header logo and the floating dock appear only once you scroll past it.
- **Type.** Bricolage Grotesque (visible stroke contrast, a hand-cut feel) for display; Hanken Grotesk for text. No tracked capitals, eyebrows, index numbers, italic accent words or outlined type anywhere.
- **One signature motion.** Images are revealed through *warp slats* — vertical strips that open like threads on a loom (`.warp`, a registered `--slat` property) — instead of fading and rising on every section.

Layer order: `site.css` → `noir.css` → `extras.css` → `motion.css` → **`atelier.css`** (last; it overrides the earlier skins). Page weight is kept low on purpose: images are resized WebP (7.1 MB → 2.3 MB), and three.js (~2 MB) is fetched only on first interaction or after the page has settled (`js/gate.js`).

Lighthouse (local, Chrome 13.6): desktop 100 / 100 / 100 / 100, mobile 86 / 100 / 100 / 100 (performance / accessibility / best practices / SEO).

Accessibility and low-power behaviour: `prefers-reduced-motion` stops the backdrop, curtain, cursor effects and auto-rotation; devices with ≤2 CPU cores or narrow screens run a lighter backdrop; if WebGL is unavailable the site falls back to flat dark styling and static image strips — everything stays usable.

## Admin console — http://127.0.0.1:4173/#/admin
It shares the same data as the shop (also across browser tabs).
- **Dashboard** — sales, orders, pending payments, dispatch queue, low stock, revenue chart, payment states.
- **Orders** — board by stage; open an order to run the real workflow: start processing → packing checklist (cannot pack until all ticked) → create shipment (one AWB, cannot be duplicated) → in transit → out for delivery → delivered. Refunds need a refunding role. **Every step shows up live on the customer's tracking page.**
- **Products** — edit price, stock, description, publish/hide, **drag to reorder images** (or `[` / `]` on a focused image), alt text. Changes appear on the storefront immediately.
- **Payments** — reconciliation view, simulate a gateway callback (a repeated callback is ignored), refund, CSV export without personal data.
- **Support** — inbox (contact form, "Need help?" and seed tickets), order context, reply, resolve.
- **Roles & security** — editable access matrix (Super Admin row locked), masked customer data, audit log of important changes.
- Use the **Role** menu to act as Store Manager, Product Manager, Order Manager, Customer Support, Finance Manager or Read-only Auditor and see permissions enforced.

## Honest limits (what this is *not* yet)
- No server or database: data lives in your browser (`localStorage`). Two people cannot share it.
- Payments, OTP/SMS, courier rates and tracking, maps and notifications are **simulated**. Role checks are in the browser; in a real build they must be enforced on the server for every request.
- Images are AI-generated concept images plus your supplied references — replace with original or licensed photography before launch. The 3D silk gallery and drape preview are **simulated cloth built from photos**, not real 360° product scans.
- Prices, stock, descriptions, GST, policies, domain (`thirupavai.in` unconfirmed) and the Silk Mark / GI passport are placeholders. Nothing here claims certification, security compliance, reviews or sales.
- Hindi/Tamil/Telugu language switch, WhatsApp opt-in alerts, bridal appointments and AR try-on are in the upgrade roadmap, not in this prototype.

## Path to production (suggested)
1. Board sign-off on brand, catalogue, platform (custom Next.js storefront vs a Shopify-class backend).
2. Real catalogue and photography; verified craft content.
3. Server, database and auth provider; merchant account → payment gateway in test mode first (signature + webhook verification, idempotency); courier/aggregator for serviceability and tracking.
4. Move role enforcement, pricing, stock and payment status to the server; audit logs; backups.
5. Security review, accessibility and performance testing, legal pages reviewed, go-live checklist.

## Tech notes
Vanilla JS modules (no build step), three.js for the backdrop and cloth (vendored in `vendor/`), fonts bundled locally. Key files: `js/stage.js` (persistent silk backdrop), `js/fx.js` (cursor, kinetic text, tilt, silk-curtain transition, gold-thread burst), `js/cloth.js` (silk tunnel + drape viewer), `js/extras.js` + `js/compare.js` (stylist, palette, compare, sound, scroll thread), `css/noir.css` (the dark design layer over `css/site.css`) and `css/extras.css`. `tools/smoke.js` runs 61 end-to-end browser checks (needs the Playwright install in `../film/node_modules` and the server running). `tools/overflow.js` checks mobile layouts; `tools/look.js` takes screenshots (in Git Bash prefix with `MSYS_NO_PATHCONV=1` so `#/` routes aren't mangled).

## Checks and film tooling
- `node tools/smoke.js` (61 checks), `node tools/overflow.js <width>`, and `node tools/tells.js` — a rendered-page audit for AI-look tells (glass, glow, gradient or outlined text, tracked capitals, italic accents, index numbering, ornament glyphs, hairline frames).
- The promo film is built in `../video` (real GPU capture of this site + scenes, `assemble.js`, `audio/`); deliverables land in `../deliverables`.


## Two ways to run this storefront

- **Offline demo** — `node server.js 4173` here. Sample data in the browser, no backend. `node tools/smoke.js` (61 checks).
- **The real shop** — served by `../app`, which also answers `/config.js` with `window.TP_CONFIG={"api":true,...}`. The same code then talks to the server: sign-in by SMS code, prices and stock from the database, server-checked checkout, orders and the admin console on real data. `js/api.js` decides the mode (`demo` / `staging` / `live`); `T(demo, live, staging)` picks the wording. `node tools/smoke_online.js` (35 checks). Deploy notes: `../GO-LIVE.md`.
