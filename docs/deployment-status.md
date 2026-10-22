# Deployment requirements

The GitHub source excludes local environment files, development secrets, database exports/backups, temporary tools, browser artifacts and IDE settings.

The current app runs with local Windows-authenticated SQL Server, Socket.IO and uploads stored in `public/uploads`. A complete online deployment needs:

1. A publicly reachable SQL Server with TLS and a dedicated SQL login (`SQLSERVER_AUTH=sql`); a cloud runtime cannot use the Windows identity or localhost database on the developer PC.
2. Persistent image storage, or a persistent backend host. Vercel's function filesystem is not suitable for the existing disk-upload endpoint.
3. A realtime deployment strategy for Socket.IO across instances; confirm runtime support, connection routing and shared room/event delivery before enabling multiple instances.
4. Production secrets configured in the hosting provider, including `JWT_SECRET`, Google OAuth and OneSignal settings. Do not upload `.env` or paste secrets into chat.
5. The final HTTPS URL in `APP_URL`, `CORS_ORIGINS`, `GOOGLE_CALLBACK_URL` and the Google OAuth authorized redirect URI. Apply migrations to the hosted database before starting production; never seed an existing live database automatically.

The application currently exports `{ app, server, start }` from `server/app.js`. It is not a static-only site. Publishing only `public/` will leave authentication, menus, orders and dashboards without their APIs. No fake/static deployment should be reported as a working ordering site.

Vercel deployment remains pending hosted database/storage details and authenticated account access. The existing local app is retained.

References: [Express on Vercel](https://vercel.com/docs/frameworks/backend/express), [Function runtimes/filesystem](https://vercel.com/docs/functions/runtimes), [WebSocket support](https://vercel.com/docs/functions/websockets).
