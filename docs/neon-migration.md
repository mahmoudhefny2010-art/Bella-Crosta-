# Neon cutover — 22 October 2026

## Result

The local application now uses `DB_PROVIDER=postgres` and the existing private `DATABASE_URL`. PostgreSQL 18 on Neon holds all 17 application tables. Row counts and canonical hashes of every row matched the consistent source snapshot before import committed. SQL Server was checked again before switching and was unchanged.

Transferred: 2 categories, 9 products, 4 options, 1 user, 5 role assignments, 1 address, 2 orders, 2 order items, 13 events, 4 delivery tokens, 7 driver locations, 1 push subscription, 1 visitor, 1 page view and 1 checkout retry record. The two existing content tables were empty and remain empty. No source rows were deleted and no account roles, receipt numbers, prices or payment records were reset.

Private JSON and environment backups are under ignored `data/backups/`. They contain private application data; never commit or publish them. PostgreSQL receipt/location/page-view sequences were advanced past imported identifiers to avoid future collisions.

## Application changes

- A separate PostgreSQL migration directory preserves the original SQL Server migration history.
- Database selection is explicit: `DB_PROVIDER=postgres` uses Neon; other existing installations retain SQL Server unless switched.
- PostgreSQL uses TLS certificate/hostname verification for Neon, a small connection pool with no minimum connections and short idle timeouts. It does not activate paid resources.
- UTC dates, Cairo day filters, numeric amounts, JSON fields, transactional row locks, atomic upserts and checkout transaction locks have PostgreSQL implementations.
- SQL Server retains its existing UTC clock and lock implementations for rollback compatibility.
- The Windows-only native SQL driver is optional. PostgreSQL mode does not load it.
- `npm.cmd run dev` retains the private development JWT secret. Google login configuration remains unchanged.

## Checks actually performed

1. Read-only Neon connectivity and empty-target check before copying.
2. Consistent SQL Server export, transactional import and all-row canonical comparisons across every application table.
3. Source snapshot comparison immediately before cutover.
4. Fifteen read-only HTTP checks through the actual Express application, covering public menu/config/content, account/history, kitchen/delivery queues, admin overview/orders/sales, owner orders/analytics and receipt/literal search. All returned 200.
5. Existing order detail, edit revision and receipt metadata remained readable.
6. The running local app on port 4000 returned `{ok:true,database:'postgres'}`.

No new customer orders, payment confirmations or role changes were created for validation. No additional write-workflow or browser regression suite was run in this turn. These read-only checks do not establish maximum load or guarantee uptime/free availability.

## Operations

Use `npm.cmd run db:migrate` for future PostgreSQL schema changes. The import command refuses any target containing application tables; it never overwrites a populated target. Importing the initial snapshot again is unnecessary.

The old SQL database is a preserved snapshot, not a synchronized replica. To roll back after new Neon orders are placed, reconcile/export those newer records first. Changing `DB_PROVIDER` alone would otherwise show the older SQL data.

This cutover does not deploy the site to Vercel or migrate image uploads. Production image storage and deployment/realtime configuration remain separate work. Do not assume a Git push of the current project publishes a complete Vercel backend.
