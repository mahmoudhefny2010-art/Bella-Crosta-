# Delivery checklist

Status recorded after local implementation and testing on 22 October 2026. **Implemented** means code exists; provider/device/deployment checks are reported separately.

| Brief | Status | Evidence / remaining dependency |
|---|---|---|
| 1. Name, tagline, phone, EGP, dark brand colors | Implemented | Header, hero, footer, menu and checkout |
| 1. Anton, Fraunces, Poppins, Cairo | Implemented | Google Fonts stylesheet with fallback fonts; remote font availability depends on client connection |
| 1. English/Arabic, RTL, logical CSS, saved language | Implemented/tested | Desktop/mobile RTL browser tests; menu, forms, status text and UI labels localized |
| 1. Mobile-first layouts | Implemented/tested | 390px and 1440px browser checks and screenshots |
| 2. Plain HTML/CSS/JS, ES modules, shared fetch wrapper | Implemented | public/pages/app.html, public/js/v2/api.js |
| 2. Express and PostgreSQL/Knex | Implemented/tested | Active server/app.js, migrations, seed; PGlite for local development |
| 2. Socket.IO | Implemented/tested | Authenticated rooms and order event integration test |
| 2. OneSignal external_id=user.id | Implemented; live check pending | Requires restaurant OneSignal keys/origin and device permission |
| 2. Manifest, install, offline shell | Implemented/tested | Service worker activation and offline navigation verified; actual installation depends on browser criteria |
| 2. Google OAuth + JWT httpOnly Secure cookie | Implemented; provider check pending | Requires Google client ID/secret and matching callback; session/ownership tests use disposable signed test fixtures |
| 2. Leaflet/OSM, qrcode, html5-qrcode | Implemented | Map and QR generation tested; real camera scanning needs a phone check |
| 3. Customer home/menu/builder/cart/checkout/tracking/history/addresses | Implemented/tested | Browser submits/cancels order; API ownership/validation tests |
| 3. Kitchen Kanban, realtime, sound, status buttons | Implemented/tested | Auth and transitions tested; sound enabled by explicit browser click |
| 3. Driver assignment/address/map/pickup/GPS/QR | Implemented/tested at API level | Eight second GPS sharing and scanner wired; physical camera/GPS verification pending |
| 3. Admin menu CRUD, availability, staff roles, daily sales | Implemented/tested | Product CRUD, role assignment and sales tests |
| 4. Sequential workflow, early cancellation, actor/time event records | Implemented/tested | Transition matrix unit test and end-to-end API flow |
| 4. Timeline and realtime updates | Implemented/tested | Tracking view and Socket.IO tests |
| 4. Push for each status change | Implemented; live check pending | Provider call is conditional on keys; delivery not claimed without configured OneSignal account |
| 5. Random token, hash-only storage, expiry, manual backup | Implemented/tested | 32 random bytes; two hour expiry; QR regeneration invalidates old credentials |
| 5. Assigned driver, one-time burn, delivered event/GPS, rate limit | Implemented/tested | Wrong driver, expiry and replay rejected; server state/GPS confirmed |
| 6. Nine real products, confirmed prices, EN/AR descriptions | Implemented/tested | Margherita 300, Bella 330, Napoli 450 EGP; nine seeded products |
| 6. product_options and custom JSON | Implemented/tested | Sauces and priced extras, server recalculation, option snapshots |
| 7A. Hero headline/photo, moving slice, scroll, tilt, steam, glow | Implemented | Photographic slice uses clipping of supplied photo; reduced-motion fallback included |
| 7B. Pinned seven-step build using independent transparent photo layers | Pending assets | Explicitly paused under brief's missing-asset rule; exact list in public/assets/napoli/REQUIRED-ASSETS.md |
| 7B. Ingredient drop/spiral/oregano/oil animations and checklist/progress | Pending assets | Not represented as complete by a composite-image crossfade |
| 7C. Builder choices, price updates, saved options | Implemented | Custom product/options saved by server |
| 7C. Photographic toppings landing on pizza | Pending assets | Same transparent ingredient assets required |
| 7D. Menu cards with price and Add | Implemented/tested | All nine products shown |
| 7D. A real photograph for every pizza | Partial | Five photographs missing: Pepperoni, Pastrami, Beef Bacon, Spicy Honey Diavola, Marinara |
| 8. All eleven required tables, foreign keys and indexes | Implemented/tested | Four Knex migration files; status/user indexes and constraints |
| 9. Required auth/menu/customer/kitchen/delivery/admin endpoints | Implemented/tested | Endpoint table in README; QR pickup/confirm and RBAC tested |
| 9. user/kitchen/driver/order socket rooms | Implemented/tested | Cookie authentication and authorized order subscriptions |
| 10. Cash on delivery, server pricing, payment extension boundary | Implemented | server/services/payments.js; no online processor or unsigned webhook enabled |
| 11. Zod, parameterized queries, RBAC, Helmet, CORS, limits, secrets, HTTPS | Implemented/tested | Active server/app.js and role/ownership tests; npm audit reported zero known vulnerabilities after dependency cleanup |
| 12. Required active folder structure | Implemented | server controllers/routes/middleware/services/sockets/db, public pages/css/js/assets |
| 12. README, env example, OAuth/OneSignal setup, deployment guides | Implemented | README, deploy Nginx/systemd templates, docker-compose.yml |
| 12. Automated status/QR tests | Passing | npm test, npm run test:integration |
| 12. Production deployment and live external acceptance | Not performed | Requires deployment target/domain, real credentials, phone check and missing photographs |

## Phase results

1. Local PostgreSQL started, schema migrated, nine products seeded, menu returned 200 and correct prices.
2. Address ownership, database pricing, customer order creation/history and browser checkout/cancellation passed. Live Google OAuth awaits keys.
3. Kitchen access rejection, allowed transitions, rejected skipped states and realtime delivery passed.
4. Assignment, pickup, GPS logging, QR generation, expiry, manual code and token replay checks passed. Real camera/GPS hardware checks remain.
5. Arabic/RTL, language persistence, service worker and offline navigation passed at 390px/1440px. Push subscription storage passed; live push awaits keys.
6. Hero and functional builder implemented. Pinned build and topping photos paused for assets as required. No claim of full Phase 6 completion.
7. Admin APIs/screens, unit/integration/browser tests, README and deployment templates completed locally. No public deployment performed.

The app is runnable locally. Full visual/provider acceptance is incomplete until the listed inputs and real-device checks are available.
