export default function createPage(context) {
  const ctx = context;
  const { app, path, $, esc, tr, api, inEgypt, language, t, local, money, status, setLanguage, page, field, bind, busy, pizzaCard, renderNav, saveCart, productFor, unit, total, add, requireUser, addressFields, addressInput, mountMap, locate, updateDriver, beep, loadScript, toast, renderRoute, user, config, products, cart, socket } = context;

function builder() {
  const base = products.find(p => p.slug === 'margherita');
  if (!base) return renderRoute('/menu');
  const view = page('Design your pizza', 'Choose a sauce and toppings. Prices update as you go.');
  view.closest('.page').classList.add('builder-page');
  view.innerHTML = `<div class="split"><img class="builder-photo" src="${esc(base.image_url)}" alt="${esc(local(base, 'name'))}"><div class="panel"><span class="eyebrow">32 CM · BELLA CROSTA</span><h3>${tr('Build your own')}</h3><form id="builder-form"><label>${tr('Sauce')}</label><div class="builder-options">${base.options.filter(o => o.option_group === 'sauce').map((o, i) => `<label><input type="radio" name="sauce" value="${o.id}" ${i === 0 ? 'checked' : ''}>${esc(local(o, 'name'))} ${o.price_delta_egp ? '+ ' + esc(money(o.price_delta_egp)) : ''}</label>`).join('')}</div><label>${tr('Toppings')}</label><div class="builder-options">${base.options.filter(o => o.option_group === 'extra_topping').map(o => `<label><input type="checkbox" name="toppings" value="${o.id}">${esc(local(o, 'name'))} + ${esc(money(o.price_delta_egp))}</label>`).join('')}</div><div class="line"><strong>${tr('Total')}</strong><span id="builder-price" class="price"></span></div><button class="primary" type="submit">${tr('Add custom pizza')} +</button></form></div></div>`;
  const chosen = () => [...$('#builder-form').querySelectorAll('input:checked')].map(i => i.value);
  const price = () => { $('#builder-price').textContent = money(base.price_egp + base.options.filter(o => chosen().includes(o.id)).reduce((s, o) => s + o.price_delta_egp, 0)); };
  bind('#builder-form', 'change', price);
  bind('#builder-form', 'submit', e => { e.preventDefault(); add(base.id, chosen(), true); });
  price();
}

  return builder();
}
