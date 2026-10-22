// Disposable records only. Requires the local dev database and app to be running.
require('dotenv').config({ quiet: true });
process.env.JWT_SECRET ||= require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../data/.dev-secret'), 'utf8');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { io } = require('socket.io-client');
const db = require('../server/db');
const { signInToken } = require('../server/middleware/session');
const base = process.env.TEST_URL || 'http://localhost:4000';
const ids = [];
let orderId, socket, productId;
const actors = {};
async function request(path, actor = 'customer', method = 'GET', body, expected = 200) {
  const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(actors[actor] ? { Cookie: 'bella_session=' + actors[actor].token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await res.json().catch(() => ({}));
  assert.equal(res.status, expected, path + ': ' + JSON.stringify(data));
  return data;
}
async function run() {
  for (const [name, role] of Object.entries({ customer: 'customer', other: 'customer', kitchen: 'kitchen', driver: 'driver', otherDriver: 'driver', admin: 'admin' })) {
    const [u] = await db('users').insert({ name: 'Test ' + name, email: crypto.randomUUID() + '@example.invalid', role }).returning('*');
    ids.push(u.id); actors[name] = { ...u, token: signInToken(u) };
  }
  const menu = await request('/api/menu');
  const baseProduct = menu.products.find(p => p.slug === 'margherita');
  assert.equal(baseProduct.price_egp, 300);
  await request('/api/orders/mine', 'anonymous', 'GET', null, 401);
  await request('/api/kitchen/orders', 'customer', 'GET', null, 403);
  const address = { label: 'Test address', address_line: 'Test street, building 1', landmark: 'Test landmark', floor: '2', apartment: '4', phone: '01031252519', latitude: 30.228, longitude: 31.48, is_default: true };
  const saved = await request('/api/addresses', 'customer', 'POST', address, 201);
  await request('/api/addresses/' + saved.address.id, 'other', 'PUT', address, 404);
  const created = await request('/api/orders', 'customer', 'POST', { customerName: 'Test customer', addressId: saved.address.id, items: [{ productId: baseProduct.id, quantity: 2, optionIds: [], custom: false }] }, 201);
  orderId = created.order.id;
  assert.equal(created.order.total_egp, 600 + Number(process.env.DELIVERY_FEE_EGP || 35));
  await request('/api/orders/' + orderId, 'other', 'GET', null, 404);
  await request('/api/orders', 'customer', 'POST', { customerName: 'Test', address, items: [{ productId: baseProduct.id, quantity: 1, price: 1 }] }, 400);
  console.log('Phase 2: auth boundaries, address ownership, database pricing, order creation PASS');
  socket = io(base, { extraHeaders: { Cookie: 'bella_session=' + actors.customer.token }, reconnection: false });
  await new Promise((resolve, reject) => { socket.on('connect', resolve); socket.on('connect_error', reject); setTimeout(() => reject(new Error('Socket timeout')), 6000).unref(); });
  const event = new Promise(resolve => socket.once('order', resolve));
  await request('/api/kitchen/orders/' + orderId + '/status', 'kitchen', 'PATCH', { status: 'READY' }, 409);
  await request('/api/kitchen/orders/' + orderId + '/status', 'kitchen', 'PATCH', { status: 'ACCEPTED' });
  assert.equal((await event).id, orderId);
  await request('/api/kitchen/orders/' + orderId + '/status', 'kitchen', 'PATCH', { status: 'PREPARING' });
  await request('/api/orders/' + orderId + '/cancel', 'customer', 'PATCH', null, 409);
  await request('/api/kitchen/orders/' + orderId + '/status', 'kitchen', 'PATCH', { status: 'READY' });
  console.log('Phase 3: authenticated realtime, kitchen transitions, late cancellation rejection PASS');
  await request('/api/admin/orders/' + orderId + '/assign', 'admin', 'PATCH', { driverId: actors.driver.id });
  await request('/api/delivery/orders/' + orderId + '/pickup', 'otherDriver', 'PATCH', null, 403);
  await request('/api/delivery/orders/' + orderId + '/pickup', 'driver', 'PATCH');
  const code = await request('/api/orders/' + orderId + '/code', 'customer', 'POST');
  assert.ok(code.qr.startsWith('data:image/png;base64,'));
  const confirmation = { orderId, secret: code.token, latitude: 30.228, longitude: 31.48 };
  await request('/api/delivery/confirm', 'otherDriver', 'POST', confirmation, 403);
  await request('/api/delivery/location', 'driver', 'POST', { orderId, latitude: 30.229, longitude: 31.481 });
  const raw = await db('delivery_tokens').where({ order_id: orderId }).whereNull('used_at').first();
  assert.notEqual(raw.token_hash, code.token);
  await db('delivery_tokens').where({ id: raw.id }).update({ expires_at: new Date(Date.now() - 1000) });
  await request('/api/delivery/confirm', 'driver', 'POST', confirmation, 409);
  const replacement = await request('/api/orders/' + orderId + '/code', 'customer', 'POST');
  const delivered = await request('/api/delivery/confirm', 'driver', 'POST', { ...confirmation, secret: replacement.code });
  assert.equal(delivered.order.status, 'DELIVERED');
  await request('/api/delivery/confirm', 'driver', 'POST', { ...confirmation, secret: replacement.token }, 409);
  assert.equal((await db('order_events').where({ order_id: orderId })).length, 6);
  assert.ok(await db('driver_locations').where({ order_id: orderId }).first());
  console.log('Phase 4: driver assignment, GPS, QR hash storage, expiry, manual code, token burn PASS');
  await request('/api/push/subscribers', 'customer', 'POST', { subscriptionId: 'test-' + crypto.randomUUID() });
  await request('/api/admin/products', 'customer', 'GET', null, 403);
  const categories = (await request('/api/admin/products', 'admin')).categories;
  const product = { category_id: categories[0].id, name: 'Temporary Test', name_ar: 'اختبار مؤقت', slug: 'test-' + crypto.randomUUID(), price_egp: 400 };
  productId = (await request('/api/admin/products', 'admin', 'POST', product, 201)).product.id;
  await request('/api/admin/products/' + productId, 'admin', 'PUT', { ...product, price_egp: 410 });
  await request('/api/admin/products/' + productId, 'admin', 'DELETE'); productId = null;
  await request('/api/admin/users/' + actors.other.id, 'customer', 'PATCH', { role: 'admin', is_active: true }, 403);
  await request('/api/admin/users/' + actors.other.id, 'admin', 'PATCH', { role: 'kitchen', is_active: true });
  const sales = await request('/api/admin/sales', 'admin'); assert.ok(sales.revenue >= delivered.order.total_egp);
  console.log('Phase 5/7: push registration, product CRUD, admin-only role changes, sales PASS');
}
run().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => {
  socket?.disconnect();
  if (orderId) await db('orders').where({ id: orderId }).del();
  if (productId) await db('products').where({ id: productId }).del();
  if (ids.length) await db('users').whereIn('id', ids).del();
  await db.destroy();
});
