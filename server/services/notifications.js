async function notifyCustomer(order) {
  if (!process.env.ONESIGNAL_APP_ID || !process.env.ONESIGNAL_REST_API_KEY || !order.user_id) return;
  const response = await fetch('https://api.onesignal.com/notifications', {
    method: 'POST',
    signal: AbortSignal.timeout(8000),
    headers: { Authorization: 'Key ' + process.env.ONESIGNAL_REST_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: process.env.ONESIGNAL_APP_ID, include_aliases: { external_id: [order.user_id] }, target_channel: 'push', headings: { en: 'Bella Crosta', ar: 'بيلا كروستا' }, contents: { en: `${order.order_number}: ${order.status.replaceAll('_', ' ')}`, ar: `${order.order_number}: ${({ PLACED: 'تم الطلب', ACCEPTED: 'تم القبول', PREPARING: 'قيد التحضير', READY: 'جاهز', OUT_FOR_DELIVERY: 'في الطريق', DELIVERED: 'تم التسليم', CANCELLED: 'ملغي' })[order.status]}` }, url: (process.env.APP_URL || 'http://localhost:4000') + '/track?id=' + order.id })
  });
  if (!response.ok) console.error('[push] Provider rejected notification:', response.status);
}

async function notifyOffer(product) {
  if (!process.env.ONESIGNAL_APP_ID || !process.env.ONESIGNAL_REST_API_KEY) return { sent: false, reason: 'not_configured' };
  const baseUrl = (process.env.APP_URL || 'http://localhost:4000').replace(/\/$/, '');
  try {
    const response = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      signal: AbortSignal.timeout(8000),
      headers: { Authorization: 'Key ' + process.env.ONESIGNAL_REST_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        app_id: process.env.ONESIGNAL_APP_ID,
        target_channel: 'push',
        included_segments: ['Subscribed Users'],
        headings: { en: 'A Bella Crosta offer!', ar: 'عرض من بيلا كروستا!' },
        contents: {
          en: `${product.name}: now EGP ${product.sale_price_egp} (was EGP ${product.price_egp}).`,
          ar: `${product.name_ar || product.name}: دلوقتي ${product.sale_price_egp} جنيه بدل ${product.price_egp} جنيه.`
        },
        url: `${baseUrl}/menu`
      })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('[push] Offer notification rejected:', response.status);
      return { sent: false, reason: 'provider_error' };
    }
    return { sent: true, recipients: Number(result.recipients || 0) };
  } catch (error) {
    console.error('[push] Offer notification failed:', error.name);
    return { sent: false, reason: 'provider_error' };
  }
}

async function notify(order) {
  if (!process.env.ONESIGNAL_APP_ID || !process.env.ONESIGNAL_REST_API_KEY) return;
  const customer = notifyCustomer(order);
  const staff = (async () => {
    let ids = [];
    let url = '/kitchen';
    let message;
    if (order.status === 'PLACED') {
      const db = require('../db');
      const users = await db('users').where({is_active:true}).whereExists(function () {
        this.select('*').from('user_roles').whereRaw('user_roles.user_id = users.id').whereIn('role',['kitchen','admin']);
      }).select('id');
      ids = users.map(user => String(user.id)).filter(id => id !== String(order.user_id));
      message = order.order_number + ': new ' + (order.fulfillment_type === 'PICKUP' ? 'pickup' : 'delivery') + ' order';
    } else if (order.status === 'READY' && order.fulfillment_type !== 'PICKUP' && order.assigned_driver_id) {
      ids = [String(order.assigned_driver_id)];url = '/delivery';message = order.order_number + ': ready for delivery pickup';
    }
    if (!ids.length) return;
    const response = await fetch('https://api.onesignal.com/notifications', {
      method:'POST',signal:AbortSignal.timeout(8000),
      headers:{Authorization:'Key '+process.env.ONESIGNAL_REST_API_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({app_id:process.env.ONESIGNAL_APP_ID,include_aliases:{external_id:ids},target_channel:'push',headings:{en:'Bella Crosta'},contents:{en:message},url:(process.env.APP_URL || 'http://localhost:4000').replace(/\/$/,'')+url})
    });
    if (!response.ok) console.error('[push] Staff notification rejected:',response.status);
  })();
  const results = await Promise.allSettled([customer,staff]);
  for (const result of results) if (result.status === 'rejected') console.error('[push] Notification failed:',result.reason?.name || 'Error');
}
module.exports = notify;
module.exports.offer = notifyOffer;
