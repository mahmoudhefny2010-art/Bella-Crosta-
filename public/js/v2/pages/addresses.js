export default function createPage(context) {
  const ctx = context;
  const { app, path, $, esc, tr, api, inEgypt, language, t, local, money, status, setLanguage, page, field, bind, busy, pizzaCard, renderNav, saveCart, productFor, unit, total, add, requireUser, addressFields, addressInput, mountMap, locate, updateDriver, beep, loadScript, toast, renderRoute, user, config, products, cart, socket } = context;

async function addressesPage(editId) {
  if (!requireUser()) return;
  const { addresses } = await api('/api/addresses');
  const edit = addresses.find(a => a.id === editId);
  const view = page('Saved addresses');
  view.closest('.page').classList.add('addresses-page');
  view.innerHTML = `<div class="split addresses-layout ${addresses.length ? 'has-addresses' : 'no-addresses'}"><div class="saved-address-list">${addresses.map(a => `<div class="panel saved-address-card"><h3>${esc(a.label)}</h3><p>${esc(a.address_line)}<br>${esc(a.landmark)} · ${esc(a.floor)} · ${esc(a.apartment)}<br><span dir="ltr">${esc(a.phone)}</span></p><div class="actions"><button data-edit="${a.id}">${tr('Edit')}</button><button class="danger" data-delete="${a.id}">${tr('Delete')}</button></div></div>`).join('') || `<div class="address-empty-state"><h3>${tr('No saved addresses.')}</h3><p>${tr('Add a delivery address to make checkout faster.')}</p></div>`}</div><form class="panel address-form" id="address-form"><h3>${tr(edit ? 'Edit' : 'New address')}</h3>${addressFields(edit)}<button class="primary address-save-button" type="submit">${tr('Save')}</button></form></div>`;
  await mountMap(edit ? [Number(edit.latitude), Number(edit.longitude)] : null, true);
  document.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => addressesPage(b.dataset.edit).catch(e => toast(e.message))));
  document.querySelectorAll('[data-delete]').forEach(b => b.addEventListener('click', async () => { try { await api('/api/addresses/' + b.dataset.delete, { method: 'DELETE' }); addressesPage(); } catch (e) { toast(e.message); } }));
  bind('#address-form', 'submit', async e => { e.preventDefault(); await busy(e.submitter, async () => { await api('/api/addresses' + (edit ? '/' + edit.id : ''), { method: edit ? 'PUT' : 'POST', body: addressInput(e.target) }); toast('Address saved'); await addressesPage(); }); });
}

  return addressesPage();
}
