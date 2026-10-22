# Bella Crosta

Pizza ordering, kitchen, delivery and administration in English and Arabic.
The active app uses Express, Microsoft SQL Server, Knex, Google OAuth, JWT cookies,
Socket.IO, Google Maps (with a backup map), QR delivery confirmation and a PWA shell.

## Run on Windows

Requires Node.js 22+, Microsoft SQL Server, ODBC Driver 18 for SQL Server, and a
Windows account permitted to access the database.

1. Keep your existing .env; use .env.example only when creating a new installation.
2. Confirm SQLSERVER_SERVER=localhost, SQLSERVER_DATABASE=bella_crosta and
   SQLSERVER_AUTH=windows for this workstation.
3. Run:

```powershell
npm.cmd ci
npm.cmd run dev
```

Open **http://localhost:4000**. The launcher creates the project database if needed,
applies migrations, seeds a new empty installation only, and starts Node's watcher.
It uses your existing SQL Server service and Windows Authentication. It does not
change server authentication settings or restart SQL Server. Stop with Ctrl+C.

The migrated installation already contains the existing menu and Google account.
Private backups remain in data/backups. See [SQL Server configuration and migration](docs/sql-server.md).

## Commands

| Command | Purpose |
| --- | --- |
| npm.cmd run dev | Prepare SQL Server and start the development watcher |
| npm.cmd start | Start Express against the configured SQL Server |
| npm.cmd run db:setup | Create/prepare the database; seed only when empty |
| npm.cmd run db:migrate | Apply schema migrations |
| npm.cmd run db:seed | Explicitly restore/update the standard menu; overwrites seeded menu fields |
| npm.cmd run db:import -- export.json | Import a preserved export into an empty target |
| npm.cmd run admin:create -- owner@example.com "Restaurant owner" | Grant administrator access to a Google email |

## Screens

| Route | Purpose |
| --- | --- |
| / | Homepage |
| /menu | Pizza menu and search |
| /builder | Custom pizza |
| /cart, /checkout | Bag and checkout |
| /orders, /track | Customer orders and tracking |
| /addresses | Saved delivery addresses |
| /login | Google sign-in |
| /kitchen | Kitchen workflow |
| /delivery | Assigned deliveries and delivery confirmation |
| /admin | Products, staff, driver assignment and sales |

## Configuration

Google sign-in uses a Web application OAuth client. Set GOOGLE_CLIENT_ID,
GOOGLE_CLIENT_SECRET and GOOGLE_CALLBACK_URL. For development, the callback is
http://localhost:4000/auth/google/callback. Staff roles are managed by the owner;
customers cannot choose their own roles. The development session secret remains
in ignored data/.dev-secret when JWT_SECRET is empty.

See [Google Maps setup](docs/google-maps.md). Automatic location detection requires
browser permission. Delivery pin selections are restricted to Egypt.

Cash and InstaPay are collected **on delivery**. InstaPay is a manual transfer;
the driver checks that money has arrived before confirming delivery. No automated
payment verification or Apple Pay processor is configured.

OneSignal uses ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY when configured.

## Production

Set NODE_ENV=production, HTTPS APP_URL, exact CORS_ORIGINS, SQL Server connection
settings, and a random JWT_SECRET of at least 32 characters. Use an authorized
service identity, trusted TLS certificates and suitable database permissions.
See [SQL Server deployment notes](docs/sql-server.md). Apply schema migrations
before starting the app. Do not use the local development certificate exception
in production.

## Legacy material

The retired database, old `src/` application, database launch scripts, previous
compose file and unused frontend scripts/styles were removed after explicit
authorization and recovery archive verification. Private archives remain in
data/backups. The active entry point is server/app.js and the only active
database configuration is server/db/sqlserver-config.js. Earlier root-level
planning documents describe the historical implementation.
