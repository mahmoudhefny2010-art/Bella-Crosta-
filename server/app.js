require('dotenv').config({ quiet: true });
// A development watcher inherits the launcher's original environment. Read the
// current OAuth values again after a restart so .env edits do not stay stale.
if (process.env.NODE_ENV !== 'production') {
  const local = require('dotenv').config({ quiet: true, processEnv: {} }).parsed || {};
  for (const key of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALLBACK_URL', 'GOOGLE_MAPS_API_KEY', 'GOOGLE_MAPS_MAP_ID']) {
    if (Object.hasOwn(local, key)) process.env[key] = local[key].trim();
  }
}
const path = require('node:path');
const fs = require('node:fs/promises');
const { hasRole } = require('./services/roles');
const http = require('node:http');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const passport = require('passport');
const { ZodError } = require('zod');
const db = require('./db');
const { attachUser } = require('./middleware/session');
const orders = require('./services/orders');
const notify = require('./services/notifications');
const publicDir = path.resolve(__dirname, '../public');
const app = express();
const production = process.env.NODE_ENV === 'production';
const appUrl = process.env.APP_URL || 'http://localhost:4000';
const origins = new Set((process.env.CORS_ORIGINS || appUrl).split(',').map(v => v.trim()));
if (production && (!appUrl.startsWith('https://') || (process.env.DB_PROVIDER === 'postgres' ? !process.env.DATABASE_URL : (!process.env.SQLSERVER_SERVER || !process.env.SQLSERVER_DATABASE)) || !process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) throw new Error('Production requires HTTPS APP_URL, database connection settings, and a JWT_SECRET of at least 32 characters.');
if (production) app.set('trust proxy', 1);
app.disable('x-powered-by');
// Map tiles require a Referer identifying the site; only send our origin cross-site.
app.use(helmet({ referrerPolicy: { policy: 'strict-origin-when-cross-origin' }, contentSecurityPolicy: { directives: {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", 'https://cdn.onesignal.com', 'https://api.onesignal.com', ...(process.env.GOOGLE_MAPS_API_KEY ? ["'unsafe-eval'", 'https://maps.googleapis.com', 'https://maps.gstatic.com'] : [])],
  styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  fontSrc: ["'self'", 'https://fonts.gstatic.com'],
  imgSrc: ["'self'", 'https://res.cloudinary.com', 'data:', 'blob:', 'https://tile.openstreetmap.org', 'https://*.googleapis.com', 'https://*.gstatic.com', 'https://*.google.com', 'https://*.googleusercontent.com'],
  connectSrc: ["'self'", 'https://*.onesignal.com', 'https://onesignal.com', 'https://api.onesignal.com', 'https://tile.openstreetmap.org', 'https://*.googleapis.com', 'https://*.gstatic.com', 'https://*.google.com', 'data:', 'blob:'],
  workerSrc: ["'self'", 'blob:'], frameSrc: ["'self'", 'https://*.onesignal.com', 'https://*.google.com'], upgradeInsecureRequests: production ? [] : null
} } }));
app.use((req, res, next) => {
  if (production && !req.secure) return res.redirect(308, appUrl + req.originalUrl);
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('origin') && !origins.has(req.get('origin'))) return res.status(403).json({ message: 'Origin not allowed.' });
  next();
});
app.use(cors({ origin: (origin, cb) => cb(null, !origin || origins.has(origin)), credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(passport.initialize());
app.use(attachUser);
app.use(['/api', '/auth'], rateLimit({ windowMs: 60000, limit: 180, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.use(require('./auth/google'));
app.use('/api', require('./routes/api'));
app.use('/vendor/leaflet', express.static(path.dirname(require.resolve('leaflet/package.json')) + '/dist'));
app.get('/vendor/socket.io.min.js',(req,res)=>res.sendFile(path.dirname(require.resolve('socket.io-client/package.json'))+'/dist/socket.io.min.js'));
app.get('/vendor/html5-qrcode.js', (req, res) => res.sendFile(path.dirname(require.resolve('html5-qrcode/package.json')) + '/html5-qrcode.min.js'));
app.get('/OneSignalSDKWorker.js', (req, res) => { res.type('js').send("importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');"); });
app.get('/manifest.json', async (req,res) => {
  const manifest = JSON.parse(await fs.readFile(path.join(publicDir,'manifest.json'),'utf8'));
  const content = await require('./services/site-content').read(db);
  if (content.customized.includes('site.name')) manifest.name = manifest.short_name = content.settings['site.name'].en;
  if (content.customized.includes('asset.logo')) manifest.icons = [{ src:content.settings['asset.logo'].en, sizes:'any', purpose:'any' }];
  res.set('Cache-Control','no-store').json(manifest);
});
app.use(express.static(publicDir, { index: false, dotfiles: 'deny' }));
for (const route of ['/', '/menu', '/builder', '/cart', '/checkout', '/track', '/orders', '/addresses', '/login', '/kitchen', '/delivery', '/admin', '/owner']) {
  app.get(route, (req, res) => {
    const required = { '/kitchen': ['admin', 'kitchen'], '/delivery': ['driver'], '/admin': ['admin'], '/owner': ['owner'] }[route];
    if (required && !req.currentUser) return res.redirect('/login');
    if (required && !required.some(role => hasRole(req.currentUser, role))) return res.status(403).send('Access denied.');
    res.sendFile(path.join(publicDir, 'pages/app.html'));
  });
}
app.get('/pages/:slug', async (req, res) => {
  const content = await require('./services/site-content').read(db);
  const page = JSON.parse(content.settings.pages.en).find(page => page.slug === req.params.slug && page.published);
  if (!page) return res.status(404).sendFile(path.join(publicDir, 'error.html'));
  res.sendFile(path.join(publicDir, 'pages/app.html'));
});
app.use((req, res) => {
  if (req.accepts('html') && !req.path.startsWith('/api/') && !req.path.startsWith('/auth/')) return res.status(404).sendFile(path.join(publicDir, 'error.html'));
  res.status(404).json({ message: 'Page or endpoint not found.' });
});
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error instanceof ZodError) return res.status(400).json({ message: 'Please check the entered values.', errors: error.issues.map(i => ({ path: i.path.join('.'), message: i.message })) });
  if (error.type === 'entity.parse.failed') return res.status(400).json({ message: 'Invalid JSON body.' });
  if (error.type === 'entity.too.large') return res.status(413).json({ message: 'This request is too large. Save fewer content changes at once.' });
  const sqlCode = Number(error.number || error.code || error.errors?.[0]?.code || error.originalError?.info?.number);
  if (error.name === 'KnexTimeoutError' || error.code === 'ETIMEOUT' || sqlCode === 51000 || sqlCode === 1205 || ['55P03','40P01','57014'].includes(error.code)) {
    res.set('Retry-After','3');
    return res.status(503).json({message:'The order system is busy. Please retry shortly; use the same checkout details to avoid a duplicate order.'});
  }
  if (error.code === '23505' || [2601, 2627].includes(sqlCode)) return res.status(409).json({ message: 'This record already exists.' });
  if (['23503','23514'].includes(error.code) || sqlCode === 547) return res.status(409).json({ message: 'This record conflicts with related data or database rules.' });
  if ((error.status || 500) >= 500 && req.accepts('html') && !req.path.startsWith('/api/') && !req.path.startsWith('/auth/')) return res.status(error.status || 500).sendFile(path.join(publicDir, '500.html'));
  console.error('[request]', error.name, error.code || '', error.status || 500);
  res.status(error.status || 500).json({ message: error.status ? error.message : 'Unable to complete the request.' });
});
let io;
let server;
if (!process.env.VERCEL) {
  server = http.createServer(app);
  io = require('./sockets')(server, [...origins]);
  app.set('io', io);
}
orders.setPublisher(async (order, { notify: shouldNotify = true } = {}) => {
  if (io) {
    io.to('user:' + order.user_id).to('order:' + order.id).to('kitchen').to('admin').to('owner').to('delivery').to('driver:' + order.assigned_driver_id).emit('order', { id: order.id, status: order.status });
  }
  if (shouldNotify) notify(order).catch(error => console.error('[push]', error.name));
});
async function start() {
  try {
    await db.raw('SELECT 1');
    console.log('[database] CONNECTED | Provider: '+db.client.config.client);
  } catch (error) {
    console.error('[database] NOT CONNECTED | Check the configured database service and environment.');
    throw error;
  }
  const port = Number(process.env.PORT || 4000);
  server.listen(port, process.env.HOST || '0.0.0.0', () => console.log(`[server] Bella Crosta ready at http://localhost:${port}`));
}
if (require.main === module) start().catch(error => { console.error('[startup]', error.code || error.message); process.exit(1); });
module.exports = { app, server, start };
