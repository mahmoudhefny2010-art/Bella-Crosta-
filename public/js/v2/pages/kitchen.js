import { receiptNumber } from '../receipt.js';
export default function createPage(ctx) {
  const { esc, tr, api, local, page, bind, busy, requireUser, toast } = ctx;

  async function kitchen() {
    if (!requireUser()) return;
    ctx.kitchenPages ||= {PLACED:1,ACCEPTED:1,PREPARING:1,READY:1};
    const requestVersion = ctx.kitchenRequest = (ctx.kitchenRequest || 0) + 1;
    const { orders, totals, pages, limit } = await api('/api/kitchen/orders?' + new URLSearchParams(ctx.kitchenPages));
    if (requestVersion !== ctx.kitchenRequest) return;
    ctx.kitchenPages = pages;
    const pagination = state => totals[state] <= limit ? '' : `<div class="kitchen-pagination"><button type="button" data-kitchen-state="${state}" data-page="${pages[state]-1}" ${pages[state] <= 1 ? 'disabled' : ''}>${ctx.language === 'ar' ? 'السابق' : 'Previous'}</button><span>${pages[state]} / ${Math.max(1,Math.ceil(totals[state]/limit))}</span><button type="button" data-kitchen-state="${state}" data-page="${pages[state]+1}" ${pages[state]*limit >= totals[state] ? 'disabled' : ''}>${ctx.language === 'ar' ? 'التالي' : 'Next'}</button></div>`;
    const states = ['PLACED', 'ACCEPTED', 'PREPARING'];
    const labels = ['New orders', 'Accepted', 'Preparing'];
    const buttons = ['Accept', 'Prepare', 'Mark ready'];
    const ready = orders.filter(order => order.status === 'READY');
    const orderCard = order => {
      const index = states.indexOf(order.status);
      const next = [...states, 'READY'][index + 1];
      return `<article class="order-card"><h4>${esc(receiptNumber(order))}</h4><p>${esc(order.customer_name)} · ${esc(new Date(order.created_at).toLocaleTimeString())}</p>${order.items.map(item => `<p>${item.quantity} × ${esc(local(item, 'product_name'))}<br>${item.options.map(option => esc(local(option, 'name'))).join(', ')}</p>`).join('')}${order.notes ? `<p class="notice">${esc(order.notes)}</p>` : ''}<div class="actions">${index >= 0 ? `<button class="primary small" data-status="${next}" data-order="${order.id}">${tr(buttons[index])}</button>` : `<span class="badge">${tr('Ready for pickup')}</span>`}${index >= 0 && index < 2 ? `<button class="small danger" data-status="CANCELLED" data-order="${order.id}">${tr('Cancel')}</button>` : ''}</div></article>`;
    };
    const view = page('Kitchen');
    view.closest('.page').classList.add('kitchen-page');
    view.innerHTML = `<div class="kitchen-board"><div class="kitchen-toolbar"><span>${tr('Active orders')} <strong>${totals.PLACED + totals.ACCEPTED + totals.PREPARING}</strong></span><button id="sound" type="button" aria-pressed="${Boolean(ctx.soundContext)}">${tr(ctx.soundContext ? 'Sound enabled' : 'Enable order sound')}</button></div><div class="kanban kitchen-active">${states.map((state, index) => {
      const matching = orders.filter(order => order.status === state);
      return `<section class="column" data-stage="${state}"><div class="kitchen-column-heading"><h3>${tr(labels[index])}</h3><span class="kitchen-count">${totals[state]}</span></div>${matching.map(orderCard).join('') || `<p class="kitchen-column-empty">${tr('No orders in this column.')}</p>`}${pagination(state)}</section>`;
    }).join('')}</div><section class="kitchen-done" aria-labelledby="kitchen-done-title"><div class="kitchen-done-heading"><h3 id="kitchen-done-title">${tr('Done')} <span class="badge">${totals.READY}</span></h3><p>${tr('Ready for pickup')}</p></div><div class="kitchen-done-orders">${ready.map(orderCard).join('') || `<p class="kitchen-done-empty">${tr('No ready orders yet.')}</p>`}</div>${pagination('READY')}</section></div>`;
    view.querySelectorAll('[data-kitchen-state]').forEach(button => button.addEventListener('click',async()=>{
      try { await busy(button,async()=>{ctx.kitchenPages[button.dataset.kitchenState]=Number(button.dataset.page);await kitchen();}); }
      catch(error){toast(error.message);}
    }));
    bind('#sound', 'click', () => {
      ctx.soundContext ||= new (window.AudioContext || window.webkitAudioContext)();
      ctx.soundContext.resume();
      const soundButton = view.querySelector('#sound');
      soundButton.textContent = tr('Sound enabled');
      soundButton.setAttribute('aria-pressed', 'true');
      toast('Sound enabled');
    });
    document.querySelectorAll('[data-status]').forEach(button => button.addEventListener('click', async () => {
      try {
        await busy(button, () => api('/api/kitchen/orders/' + button.dataset.order + '/status', { method: 'PATCH', body: { status: button.dataset.status } }));
        await kitchen();
      } catch (error) { toast(error.message); }
    }));
  }

  return kitchen();
}
