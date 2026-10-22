export default function createPage(context) {
  const ctx = context;
  const { app, path, $, esc, tr, api, inEgypt, language, t, local, money, status, setLanguage, page, field, bind, busy, pizzaCard, renderNav, saveCart, productFor, unit, total, add, requireUser, addressFields, addressInput, mountMap, locate, updateDriver, beep, loadScript, toast, renderRoute, user, config, products, cart, socket } = context;

function cartPage() {
  const view = page('Your bag');
  view.closest('.page').classList.add('cart-page');
  if (!cart.length) { view.innerHTML = `<div class="empty"><p>${tr('Your bag is empty.')}</p><a class="button primary" href="/menu">${tr('Continue shopping')}</a></div>`; return; }
  view.innerHTML = `<div class="split cart-layout"><div class="panel">${cart.map((item, i) => { const p = productFor(item); return `<div class="line cart-item">${p.image_url ? `<img src="${esc(p.image_url)}" alt="" width="70" height="70" loading="lazy">` : `<span aria-hidden="true"></span>`}<div><h3>${item.custom ? tr('Custom pizza') : esc(local(p, 'name'))}</h3><p>${p.options.filter(o => item.optionIds.includes(o.id)).map(o => esc(local(o, 'name'))).join(', ')}</p><div class="qty"><button data-qty="${i}" data-delta="-1" aria-label="${tr('Decrease quantity')} ${esc(local(p, 'name'))}">−</button><span>${item.quantity}</span><button data-qty="${i}" data-delta="1" aria-label="${tr('Increase quantity')} ${esc(local(p, 'name'))}">+</button><button class="small danger" data-remove="${i}">${tr('Remove')}</button></div></div><span class="price">${esc(money(unit(item) * item.quantity))}</span></div>`; }).join('')}</div><div class="panel cart-summary"><h3>${tr('Your order')}</h3><div class="line"><span>${tr('Subtotal')}</span><span>${esc(money(total()))}</span></div><div class="line"><span>${tr('Delivery fee')}</span><span>${esc(money(config.deliveryFee))}</span></div><div class="line"><strong>${tr('Total')}</strong><strong class="price">${esc(money(total() + config.deliveryFee))}</strong></div><a class="button primary" href="/checkout">${tr('Checkout')} ↗</a></div></div>`;
  document.querySelectorAll('[data-qty]').forEach(b => b.addEventListener('click', () => { const i = Number(b.dataset.qty); cart[i].quantity = Math.max(1, Math.min(20, cart[i].quantity + Number(b.dataset.delta))); saveCart(); cartPage(); }));
  document.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', () => { cart.splice(Number(b.dataset.remove), 1); saveCart(); cartPage(); }));
}

  return cartPage();
}
