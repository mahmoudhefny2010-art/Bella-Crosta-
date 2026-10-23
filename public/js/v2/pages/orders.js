import { receiptNumber } from '../receipt.js';
import { openOrderEditor } from '../order-editor.js';
export default function createPage(context) {
  const ctx = context;
  const { app, path, $, esc, tr, api, inEgypt, language, t, local, money, status, setLanguage, page, field, bind, busy, pizzaCard, renderNav, saveCart, productFor, unit, total, add, requireUser, addressFields, addressInput, mountMap, locate, updateDriver, beep, loadScript, toast, renderRoute, user, config, products, cart, socket } = context;

async function history() {
  if (!requireUser()) return;
  const { orders } = await api('/api/orders/mine');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayOrders = orders.filter(o => new Date(o.created_at) >= today);
  page(tr('Last orders')).innerHTML = todayOrders.length ? todayOrders.map(o => `<article class="panel"><div class="line"><h3>${esc(receiptNumber(o))}</h3><span class="badge">${esc(status(o.status))}</span></div><p>${esc(new Date(o.created_at).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-EG'))} · ${esc(money(o.total_egp))}</p><a class="button primary" href="/track?id=${o.id}">${tr('Track')} ↗</a></article>`).join('') : `<p class="empty">${tr('No orders today.')}</p>`;
}

async function tracking() {
  if (!requireUser()) return;
  const id = new URLSearchParams(location.search).get('id');
  if (!id) { location.href = '/orders'; return; }
  const { order } = await api('/api/orders/' + encodeURIComponent(id));
  ctx.activeOrder = order;
  socket?.emit('watch', id);
  const steps = ['PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'];
  const view = page('Track your order');
  view.innerHTML = `<div class="split"><div><div class="panel"><div class="line"><h3>${esc(receiptNumber(order))}</h3><p>${tr(order.payment_method === 'INSTAPAY_ON_DELIVERY' ? 'InstaPay on delivery' : 'Cash on delivery')}</p><span class="badge">${esc(status(order.status))}</span></div><ul class="timeline">${steps.map(s => { const event = order.events.find(e => e.status === s); return `<li class="${event ? 'done' : ''}">${esc(status(s))}${event ? `<small>${esc(new Date(event.created_at).toLocaleString(language === 'ar' ? 'ar-EG' : 'en-EG'))}</small>` : ''}</li>`; }).join('')}</ul>${order.status === 'CANCELLED' ? `<p class="danger">${esc(status(order.status))}</p>` : ''}${['PLACED', 'ACCEPTED'].includes(order.status) ? `<button id="cancel-order" class="danger">${tr('Cancel order')}</button>` : ''}</div><div class="panel"><h3>${tr('Delivery confirmation')}</h3><p>${tr('Show this code to your driver when you receive your order.')}</p><div id="delivery-code"></div>${order.status === 'OUT_FOR_DELIVERY' ? `<button id="generate-code" class="primary">${tr('Generate delivery code')}</button>` : `<p>${tr('Delivery codes are available after pickup.')}</p>`}</div></div><aside><div class="panel"><h3>${tr('Live location')}</h3><div id="map" class="map"></div><p>${esc(order.address_snapshot.address_line)} · ${esc(order.address_snapshot.landmark)}</p></div><div class="panel">${order.items.map(i => `<div class="line"><span>${i.quantity} × ${esc(local(i, 'product_name'))}</span><strong>${esc(money(i.line_total_egp))}</strong></div>`).join('')}<div class="line"><span>${tr('Total')}</span><span class="price">${esc(money(order.total_egp))}</span></div></div></aside></div>`;
  await mountMap([Number(order.address_snapshot.latitude), Number(order.address_snapshot.longitude)]);
  if(order.status==='PLACED') {
    const editButton=document.createElement('button');
    editButton.type='button';editButton.id='edit-order';editButton.textContent=language==='ar'?'تعديل الطلب':'Edit order';
    view.querySelector('#cancel-order').before(editButton);
    editButton.addEventListener('click',async()=>{
      try {await busy(editButton,()=>openOrderEditor(ctx,order,tracking));}catch(error){toast(error.message);}
    });
  }
  if (order.location) updateDriver(order.location);
  bind('#generate-code', 'click', async e => busy(e.target, async () => { const data = await api('/api/orders/' + id + '/code', { method: 'POST' }); $('#delivery-code').innerHTML = `<img class="qr" src="${esc(data.qr)}" alt="QR"><div class="code" dir="ltr">${esc(data.code)}</div>`; e.target.textContent = t('Generate a new code'); }));
  bind('#cancel-order', 'click', async () => { if (!confirm(t('Cancel this order?'))) return; await api('/api/orders/' + id + '/cancel', { method: 'PATCH' }); tracking(); });
}

  return path === '/track' ? tracking() : history();
}
