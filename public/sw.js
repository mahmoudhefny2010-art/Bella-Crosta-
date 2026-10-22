const VERSION = 'bella-v2-84';
const SHELL = [
  '/offline.html', '/error.html', '/500.html', '/js/theme.js', '/js/status-page.js', '/css/bella.css', '/css/polish.css', '/css/pages/home.css', '/css/pages/menu.css', '/css/pages/cart.css',
  '/css/pages/checkout.css', '/css/pages/orders.css', '/css/pages/addresses.css', '/css/pages/builder.css', '/css/pages/kitchen.css',
  '/css/pages/delivery.css', '/css/pages/admin.css', '/css/pages/login.css', '/css/sections/hero.css', '/css/sections/brand-strip.css',
  '/css/sections/napoli-feature.css', '/js/v2/api.js', '/js/v2/i18n.js', '/js/v2/app.js', '/js/v2/excel.js', '/js/v2/pages/home.js', '/js/v2/pages/menu.js',
  '/js/v2/pages/cart.js', '/js/v2/pages/checkout.js', '/js/v2/pages/orders.js', '/js/v2/pages/addresses.js', '/js/v2/pages/builder.js',
  '/js/v2/pages/kitchen.js', '/js/v2/pages/delivery.js', '/js/v2/pages/admin.js', '/js/v2/pages/login.js', '/js/v2/sections/hero.js', '/js/v2/sections/brand-strip.js',
  '/js/v2/sections/napoli-feature.js', '/assets/logo.png', '/assets/icon-192.png', '/assets/icon-512.png', '/js/v2/admin-workspace.js',
  '/js/v2/site-content.js', '/js/v2/live.js', '/js/v2/payment-summary.js', '/js/v2/receipt.js', '/js/v2/order-editor.js', '/js/v2/sections/repeat-order.js', '/js/v2/pages/content-editor.js', '/js/v2/pages/content-page.js', '/js/v2/pages/owner.js', '/css/pages/content-page.css', '/css/pages/owner.css',
  ...['grid','package','users','shopping-bag','bar-chart-2','search','refresh-cw','external-link','log-out','moon','globe','arrow-left','arrow-right','menu','x','sliders','check-circle'].map(name => `/assets/admin/${name}.svg`)
];
self.addEventListener('install', event => { event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('bella-') && key !== VERSION).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/') || url.pathname.includes('OneSignal') || url.pathname.startsWith('/socket.io/')) return;
  if (request.mode === 'navigate') { event.respondWith(fetch(request).catch(() => caches.match('/offline.html'))); return; }
  if (!SHELL.includes(url.pathname)) return;
  event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
});
