export default function createPage(context) {
  const ctx = context;
  const { app, path, $, esc, tr, api, inEgypt, language, t, local, money, status, setLanguage, page, field, bind, busy, pizzaCard, renderNav, saveCart, productFor, unit, total, add, requireUser, addressFields, addressInput, mountMap, locate, updateDriver, beep, loadScript, toast, renderRoute, user, config, products, cart, socket } = context;

function menu() {
  const view = page('Menu', 'Made fresh, just for you.');
  view.innerHTML = `<div class="menu-toolbar"><input id="search" class="search" type="search" placeholder="${tr('Search pizzas…')}" aria-label="${tr('Search')}" aria-controls="pizzas"><div class="filters" role="group" aria-label="${tr('Category')}"><button class="active" data-filter="all" aria-pressed="true">${tr('All pizzas')}</button><button data-filter="classic" aria-pressed="false">${tr('Classic')}</button><button data-filter="special" aria-pressed="false">${tr('Signature')}</button></div></div><p class="menu-results" id="menu-results" role="status" aria-live="polite"></p><div class="grid" id="pizzas"></div>`;
  let category = 'all';
  const draw = () => { const q = $('#search').value.trim().toLowerCase(); const list = products.filter(p => (category === 'all' || p.category === category) && (local(p, 'name') + local(p, 'description')).toLowerCase().includes(q)); $('#menu-results').textContent = `${list.length} ${t('Pizzas to choose from')}`; $('#pizzas').innerHTML = list.map(pizzaCard).join('') || `<div class="empty"><p>${tr('No pizzas found.')}</p><button id="clear-search">${tr('All pizzas')}</button></div>`; bind('#clear-search', 'click', () => { $('#search').value = ''; document.querySelector('[data-filter="all"]').click(); $('#search').focus(); }); };
  bind('#search', 'input', draw);
  document.querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click', () => { category = b.dataset.filter; document.querySelectorAll('[data-filter]').forEach(v => { v.classList.toggle('active', v === b); v.setAttribute('aria-pressed', String(v === b)); }); draw(); }));
  draw();
}

  return menu();
}
