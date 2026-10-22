# Bella Crosta

Pizza ordering, kitchen, delivery and administration in English and Arabic.
The active app uses Express, Neon PostgreSQL (with a retained SQL Server fallback), Knex, Google OAuth, JWT cookies,
Socket.IO, Google Maps (with a backup map), QR delivery confirmation and a PWA shell.

## Run on Windows

Requires Node.js 22+ and the existing private Neon connection configuration.

1. Keep your existing .env; use .env.example only when creating a new installation.
2. Use `DB_PROVIDER=postgres` and the private `DATABASE_URL` in `.env`.
3. Run:

```powershell
npm.cmd ci
npm.cmd run dev
```

Open **http://localhost:4000**. In PostgreSQL mode, the launcher starts Node's watcher
and retains the existing development session secret. It does not seed or overwrite
the migrated Neon data. Apply schema changes explicitly with `npm.cmd run db:migrate`.
Stop with Ctrl+C. SQL Server mode retains the original setup launcher and requires
SQL Server, ODBC Driver 18 and Windows database access.

The migrated installation already contains the existing menu and Google account.
Private backups remain in data/backups. See [Neon migration](docs/neon-migration.md)
and the retained [SQL Server configuration](docs/sql-server.md).

## Commands

| Command | Purpose |
| --- | --- |
| npm.cmd run dev | Start development for the selected database provider |
| npm.cmd start | Start Express against the selected database provider |
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

Vercel runs the existing Express API as a serverless function and serves the
static frontend from `public/`. Set `DB_PROVIDER=postgres`, the Neon
`DATABASE_URL`, `NODE_ENV=production`, `APP_URL` and `CORS_ORIGINS` to the
deployed HTTPS origin, and a random `JWT_SECRET` of at least 32 characters.
Configure the existing Google OAuth, Maps, OneSignal and Cloudinary variables
in Vercel's Production environment. Set `GOOGLE_CALLBACK_URL` to
`https://<deployment-host>/auth/google/callback` and register that callback in
Google Cloud. `ONESIGNAL_SITE_URL` must match the production origin and the
same origin must be configured in the OneSignal dashboard. The app uses
database polling for cross-instance order updates on Vercel. Builds do not run
migrations or seed data; apply PostgreSQL migrations explicitly with
`npm.cmd run db:migrate` before routing customers to a new deployment.

## Legacy material

Neon PostgreSQL is the active hosted database. SQL Server configuration and
migrations remain available for existing local installations. Private database
exports and local development secrets are ignored by Git in `data/`.
