const crypto = require('node:crypto');
const sequence = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'];
function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }
function assertTransition(from, to) {
  if (to === 'CANCELLED' && ['PLACED', 'ACCEPTED'].includes(from)) return;
  if (sequence.indexOf(to) !== sequence.indexOf(from) + 1 || !sequence.includes(from) || !sequence.includes(to)) fail('This status transition is not allowed.', 409);
}
function digest(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function credentials() {
  const token = crypto.randomBytes(32).toString('base64url');
  const code = crypto.randomInt(0, 1000000).toString().padStart(6, '0');
  return { token, code, token_hash: digest(token), manual_code_hash: digest(code) };
}
function assertDelivery({ order, token, driverId, secret, now = new Date() }) {
  if (!token || token.used_at || new Date(token.expires_at) <= now) fail('Delivery code expired or already used.', 409);
  if (order.assigned_driver_id !== driverId || order.status !== 'OUT_FOR_DELIVERY') fail('Order is not assigned to this driver for delivery.', 403);
  const expected = /^\d{6}$/.test(secret) ? token.manual_code_hash : token.token_hash;
  if (!crypto.timingSafeEqual(Buffer.from(digest(secret)), Buffer.from(expected))) fail('Invalid delivery code.', 400);
}
module.exports = { fail, assertTransition, digest, credentials, assertDelivery, sequence };
