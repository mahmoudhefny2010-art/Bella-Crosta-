export default function createPage(context) {
  const ctx = context;
  const { app, path, $, esc, tr, api, inEgypt, language, t, local, money, status, setLanguage, page, field, bind, busy, pizzaCard, renderNav, saveCart, productFor, unit, total, add, requireUser, addressFields, addressInput, mountMap, locate, updateDriver, beep, loadScript, toast, renderRoute, user, config, products, cart, socket } = context;

  function builder() {
    const baseId = new URLSearchParams(location.search).get('base') || 'margherita';
    const base = products.find(p => p.id === baseId || p.slug === baseId);
    if (!base || !base.options) return renderRoute('/menu');
    const view = page('Design your pizza', 'Choose a sauce and toppings. Prices update as you go.');
    view.closest('.page').classList.add('builder-page');
    const sauceOptions = base.options.filter(o => o.option_group === 'sauce');
    const toppingOptions = base.options.filter(o => o.option_group === 'extra_topping');
    view.innerHTML = `<div class="split"><img class="builder-photo" src="${esc(base.image_url || '/assets/hero-margherita-v2.png')}" alt="${esc(local(base, 'name'))}"><div class="panel"><span class="eyebrow">32 CM · BELLA CROSTA</span><h3>${tr('Build your own')}</h3><form id="builder-form"><label>${tr('Sauce')}</label><div class="builder-options">${sauceOptions.length ? sauceOptions.map((o, i) => `<label><input type="radio" name="sauce" value="${o.id}" ${i === 0 ? 'checked' : ''}>${esc(local(o, 'name'))} ${o.price_delta_egp ? '+ ' + esc(money(o.price_delta_egp)) : ''}</label>`).join('') : `<p class="empty">${tr('No sauce options available')}</p>`}</div><label>${tr('Toppings')}</label><div class="builder-options">${toppingOptions.length ? toppingOptions.map(o => `<label><input type="checkbox" name="toppings" value="${o.id}">${esc(local(o, 'name'))} + ${esc(money(o.price_delta_egp))}</label>`).join('') : `<p class="empty">${tr('No topping options available')}</p>`}</div><div class="line"><strong>${tr('Total')}</strong><span id="builder-price" class="price"></span></div><button class="primary" type="submit">${tr('Add custom pizza')} +</button></form></div></div>`;
    const chosen = () => [...$('#builder-form').querySelectorAll('input:checked')].map(i => i.value);
    const price = () => { $('#builder-price').textContent = money(base.price_egp + base.options.filter(o => chosen().includes(o.id)).reduce((s, o) => s + o.price_delta_egp, 0)); };
    bind('#builder-form', 'change', price);
    bind('#builder-form', 'submit', e => { e.preventDefault(); add(base.id, chosen(), true); });
    price();
  }

  return builder();
}
