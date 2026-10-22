const test = require('node:test');
const assert = require('node:assert/strict');
const { assertTransition, credentials, assertDelivery } = require('../server/services/workflow');
test('Only consecutive order transitions and early cancellation are accepted', () => {
  const states = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
  for (const from of states) for (const to of states) {
    const allowed = (states.indexOf(to) === states.indexOf(from) + 1 && states.indexOf(to) < 6) || (to === 'CANCELLED' && ['PLACED', 'ACCEPTED'].includes(from));
    if (allowed) assert.doesNotThrow(() => assertTransition(from, to), `${from} -> ${to}`);
    else assert.throws(() => assertTransition(from, to), `${from} -> ${to}`);
  }
});
test('QR and manual code accept only an assigned driver with a valid unused token', () => {
  const value = credentials();
  assert.ok(value.token.length >= 32);
  assert.match(value.code, /^\d{6}$/);
  const token = { ...value, expires_at: new Date(Date.now() + 60000), used_at: null };
  const input = { order: { assigned_driver_id: 'driver', status: 'OUT_FOR_DELIVERY' }, token, driverId: 'driver', secret: value.token };
  assert.doesNotThrow(() => assertDelivery(input));
  assert.doesNotThrow(() => assertDelivery({ ...input, secret: value.code }));
  assert.throws(() => assertDelivery({ ...input, driverId: 'another-driver' }));
  assert.throws(() => assertDelivery({ ...input, secret: 'invalid' }));
  assert.throws(() => assertDelivery({ ...input, token: { ...token, used_at: new Date() } }));
  assert.throws(() => assertDelivery({ ...input, token: { ...token, expires_at: new Date(Date.now() - 1) } }));
  assert.throws(() => assertDelivery({ ...input, order: { ...input.order, status: 'DELIVERED' } }));
});
