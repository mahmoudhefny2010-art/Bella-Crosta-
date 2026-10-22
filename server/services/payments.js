const { fail } = require('./workflow');
// A provider must implement both pricing-independent payment creation and verified callbacks.
// Paymob/Fawry adapters can be registered here when merchant credentials are available.
const providers = new Map([
  ['CASH_ON_DELIVERY', { async create(order) { return { method: 'CASH_ON_DELIVERY', amount: order.total_egp, currency: 'EGP', status: 'DUE_ON_DELIVERY' }; } }],
  ['INSTAPAY_ON_DELIVERY', { async create(order) { return { method: 'INSTAPAY_ON_DELIVERY', amount: order.total_egp, currency: 'EGP', status: 'DUE_ON_DELIVERY' }; } }]
]);
function registerProvider(name, provider) {
  if (['CASH_ON_DELIVERY', 'INSTAPAY_ON_DELIVERY'].includes(name) || typeof provider.create !== 'function' || typeof provider.verifyWebhook !== 'function') throw new Error('Online payment providers require create and verifyWebhook methods.');
  providers.set(name, provider);
}
async function createPayment(order) {
  const provider = providers.get(order.payment_method);
  if (!provider) fail('Payment method is unavailable.', 400);
  return provider.create(order);
}
async function verifyWebhook(name, rawBody, headers) {
  const provider = providers.get(name);
  if (!provider?.verifyWebhook) fail('Payment provider is not configured.', 404);
  const result = await provider.verifyWebhook(rawBody, headers);
  if (!result?.verified) fail('Invalid webhook signature.', 401);
  return result;
}
module.exports = { createPayment, registerProvider, verifyWebhook };
