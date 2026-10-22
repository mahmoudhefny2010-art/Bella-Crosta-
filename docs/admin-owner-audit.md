# Admin content and owner workspace

## Audit and implementation (22 October 2026)

The application uses Express, Knex, SQL Server, cookie authentication, Google sign-in, multi-role accounts, Socket.IO and a JavaScript frontend. Existing products, offers, orders, kitchen, delivery, account menus, admin tools and sales exports are retained.

The existing `site_settings` and `site_copy` tables were empty. The content editor now uses those tables; missing settings preserve the original public website defaults. Default hero, feature and brand-strip markup was compared with the saved pre-change source and matched. Public layouts and styling were retained.

### Website administrator

Open `/admin`, then **Website content**, or `/admin?tab=content`.

- Edit header navigation, hero copy and images, home section visibility, footer details and links.
- Manage built-in page titles, safe custom pages with draft/published states, and English/Arabic text overrides.
- Upload/select images using the existing image upload backend.
- Manage delivery fee and whether new orders are accepted. Checkout validates these settings again on the server.
- Existing product, staff, order and sales tools remain available.

Custom pages support text and images rather than executable HTML. Settings, URLs, images, page slugs, publication state and payload sizes are validated on the backend. Draft pages are excluded from public content and return 404 publicly.

### Shop owner

Assign **Owner** using the existing admin **Staff** role editor, then open `/owner`. The account menu shows the owner dashboard for assigned accounts. Owner access is not granted automatically to administrators or any particular email.

The separate workspace provides orders, kitchen status, active-driver assignment, filtered analytics and Excel export. Dates use Cairo order-creation dates. Excel exports every matching order across pagination, up to 10,000 rows, with Summary/Orders sheets, column widths, filters, frozen headers and numeric currency cells. The live kitchen view displays up to 100 active orders; Orders provides the paginated history.

| Capability | Admin role | Owner role alone |
| --- | --- | --- |
| Existing admin tools, staff roles, website content, image uploads | Yes | No |
| Separate owner API and workspace | Only if also assigned Owner | Yes |
| Business order details, kitchen progression, driver assignment, analytics/export | Existing admin tools retained | Yes |
| Driver pickup or customer delivery confirmation bypass | No | No |

Explicitly assigning multiple roles retains the existing combined-role behavior. Owner endpoints return business data and do not expose website settings, staff management, source code or configuration secrets. Driver pickup and customer QR/manual confirmation continue to use the original workflow.

## Database change

`202610240006_owner_role.js` expands the existing `users` and `user_roles` check constraints to allow `owner`. No new tables, seed data, account assignments or order changes are required. Rollback refuses while owner assignments exist. Existing migration files are retained.

## Validation

- `npm.cmd test`: six passing unit tests covering workflow, QR, Google errors, owner separation and content validation.
- `npm.cmd run test:admin-owner`: real SQL Server tests in a generated temporary database, migrated and seeded independently of the live database, plus headless Chrome browser coverage. The database and uploaded fixture images are removed afterward.
- Coverage includes authorization, status transitions, invalid/inactive driver assignment, realtime order events, Cairo date boundaries, pagination, analytics, actual XLSX rows and escaping, content persistence, draft privacy, upload validation, dynamic fees/order pause, existing product offers, addresses and checkout.
- Browser checks cover admin saves appearing publicly, safe text rendering, real file download, English/Arabic and desktop/mobile overflow checks. Screenshots and sample workbooks are in `artifacts/`.
- Regression testing found and fixed an existing checkout map-resize call that referenced the DOM element instead of the map adapter. The page context now exposes the adapter explicitly.

The integration test creates and drops only its own randomly named database. It requires SQL Server permissions to create a temporary database and installed Chrome. Legacy integration scripts were not run against live data.

## Delivery payment extension

Migration `202610240007_delivery_payment.js` adds payment status, amount received, calculated change, payment timestamp and collecting driver to existing orders. Historical payments remain `UNCONFIRMED`; new orders start `UNPAID`. Existing orders are preserved.

The assigned driver must confirm payment received alongside the customer's QR or manual code. Cash must cover the stored order total; the server calculates change, validates amounts and records payment and delivery together in one transaction. InstaPay requires the driver to verify receipt, and records the order total. This is a staff receipt confirmation, not an automatic bank verification.

Delivery includes All active orders (oldest first), My deliveries and My completed deliveries, with 50 orders per page. All active drivers can view the shared queue, but pickup, GPS updates and delivery/payment confirmation remain restricted to the assigned driver. Owner/admin assignment can change while an order is out for delivery; completed and cancelled orders cannot be reassigned. The previous driver immediately loses permission to complete that order.

Payment status and receipt details appear in owner/admin order cards and are available in Excel reports. The earlier integration run predates this extension; no additional tests were run for this follow-up.
