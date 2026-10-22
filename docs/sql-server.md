# Microsoft SQL Server

The active application uses Microsoft SQL Server exclusively. SSMS is the client
used to view the database; the running SQL Server service stores the data.

## This workstation

- SSMS server name: `localhost` (default instance `DESKTOP-I3P8NGR`).
- Authentication: **Windows Authentication**.
- Database: **bella_crosta**.
- SQL Server authentication mode and services were left unchanged.
- Node.js connects using `msnodesqlv8` and the installed ODBC Driver 18.
- The app must run as a Windows identity authorized to access this database.

```powershell
npm.cmd run dev
```

The launcher applies migrations, seeds a new empty installation only, and starts
the watcher. It preserves existing menu edits and the development session secret.
It does not launch a separate database server or container.

## Data migration

The existing consistent export was imported transactionally, preserving original
IDs, Google account linkage, Arabic text, prices and timestamps. All fields and
counts matched before commit: 2 categories, 9 products, 4 options and 1 user.
The other 7 application tables were empty.

Private recovery files are ignored by source control:

- `data/backups/pre-sqlserver-*.json`: the complete exported records.
- `data/backups/latest-export-path.txt`: the exact export location.
- `data/backups/pre-sqlserver.env`: the previous private configuration.

`npm.cmd run db:import -- path/to/export.json` imports an export into an **empty**
SQL Server target. It refuses to overwrite an existing database's records.

The retired embedded database directory `data/postgres` was deleted after explicit
database-cleanup authorization. Its recovery archive is
`data/backups/retired-database-code.zip`; all 1,111 archived files were compared
by SHA-256 before the database files were removed.

After explicit authorization to delete the old code, `src/`, the previous
database launch scripts, stale launcher lock and old compose file were removed.
Their contents remain in the verified recovery archive above. Unused legacy
frontend JavaScript/CSS files were separately archived in
`data/backups/retired-frontend-code.zip`, compared by SHA-256, and removed.

## Schema and queries

- UUIDs use `uniqueidentifier` and `NEWID()`.
- Arabic and other text use Unicode columns.
- JSON is stored as `nvarchar(max)` with `ISJSON` constraints and decoded by the
  database layer for the existing frontend API.
- UTC timestamps use `SYSUTCDATETIME()`; sales dates use Egypt's time zone.
- Transactional upserts use SQL Server key-range locks.
- Foreign keys use `NO ACTION` to avoid multiple cascade paths. Address/product
  deletion explicitly preserves order snapshots and removes relevant links.
- `server/db/windows-client.js` retains Knex's SQL Server compiler and schema
  response contract while using native ODBC transactions and parameter binding.
  Knex is pinned because this adapter depends on its internal dialect API.

## Production / an existing SQL login

Use your already configured SQL Server authentication policy. For SQL login
connections set `SQLSERVER_AUTH=sql`, `SQLSERVER_SERVER`, `SQLSERVER_DATABASE`,
`SQLSERVER_USER`, `SQLSERVER_PASSWORD`, and optionally `SQLSERVER_PORT` or
`SQLSERVER_INSTANCE`. This path uses Tedious rather than Windows integrated auth.

Use a trusted TLS certificate with `SQLSERVER_ENCRYPT=true` and
`SQLSERVER_TRUST_CERTIFICATE=false`. Provision the database and a dedicated app
identity with suitable permissions; run migrations using a deployment identity.
Do not run production with a workstation administrator identity.

Official references:

- https://learn.microsoft.com/en-us/sql/connect/node-js/step-3-proof-of-concept-connecting-to-sql-using-node-js
- https://github.com/TimelordUK/node-sqlserver-v8
