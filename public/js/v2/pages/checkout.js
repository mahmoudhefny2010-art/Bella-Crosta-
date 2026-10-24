export default function createPage(context) {
  const ctx = context;
  const { app, path, $, esc, tr, api, inEgypt, language, t, local, money, status, setLanguage, page, field, bind, busy, pizzaCard, renderNav, saveCart, productFor, unit, total, add, requireUser, addressFields, addressInput, mountMap, locate, updateDriver, beep, loadScript, toast, renderRoute, user, config, products, cart, socket } = context;

async function checkout() {
  if (!requireUser()) return;
  if (!cart.length) return renderRoute('/cart');
  const { addresses } = await api('/api/addresses');
  const defaultAddress = addresses.find(a => a.is_default) || addresses[0];
  const input = (name, title, value = '', type = 'text', required = true) => `<div class="checkout-field">${field(name, title, value, type, required)}</div>`;
  const sectionTitle = (number, title, hint) => `<div class="checkout-section-heading"><span class="checkout-number" aria-hidden="true">${number}</span><div><h2>${tr(title)}</h2><p>${tr(hint)}</p></div></div>`;
  const view = page('Checkout', 'Just a few details, then we fire up the oven.');
  view.closest('.page').classList.add('checkout-page');
  view.innerHTML = `
    <div class="checkout-topline"><a href="/cart">← ${tr('Back to your bag')}</a><span>${tr('Pay on delivery')}</span></div>
    <div class="checkout-layout">
      <form id="checkout-form" class="checkout-form">
        <section class="panel checkout-section">
          ${sectionTitle('01', 'How to receive', 'Choose delivery or pickup.')}
          <div class="checkout-fulfillment">
            <label class="checkout-fulfillment-choice">
              <input type="radio" name="fulfillmentType" value="DELIVERY" form="checkout-form" checked>
              <span class="checkout-choice-selected" aria-hidden="true">✓</span>
              <strong>${tr('Delivery')}</strong><small>${tr('We bring it to you')}</small>
            </label>
            <label class="checkout-fulfillment-choice">
              <input type="radio" name="fulfillmentType" value="PICKUP" form="checkout-form">
              <span class="checkout-choice-selected" aria-hidden="true">✓</span>
              <strong>${tr('Pickup')}</strong><small>${tr('Collect from the store, pay at cashier')}</small>
            </label>
          </div>
        </section>
        <section class="panel checkout-section">
          ${sectionTitle('02', 'Contact details', 'Who are we making pizza for?')}
          ${input('customerName', 'Your name', user.name)}
          <p class="checkout-account">${tr('Signed in as')} <bdi>${esc(user.email)}</bdi></p>
        </section>
        <section id="checkout-address-section" class="panel checkout-section">
          ${sectionTitle('03', 'Delivery details', 'Tell us where to bring the good stuff.')}
          <div class="checkout-saved-picker" ${addresses.length ? '' : 'hidden'}><label for="saved-address">${tr('Saved address')}</label><select id="saved-address"><option value="">+ ${tr('New address')}</option>${addresses.map(a => `<option value="${a.id}" ${a.id === defaultAddress?.id ? 'selected' : ''}>${esc(a.label + ' · ' + a.address_line)}</option>`).join('')}</select></div>
          <div id="saved-address-preview" class="checkout-address-preview" hidden></div>
          <div id="new-address">
            <div class="checkout-fields">${input('address_line', 'Street and building')}${input('phone', 'Phone', user.phone || '', 'tel')}</div>
            <div class="checkout-fields checkout-building-fields">${input('landmark', 'Landmark', '', 'text', false)}${input('floor', 'Floor', '', 'text', false)}${input('apartment', 'Apartment', '', 'text', false)}</div>
            <div class="checkout-map-heading"><div><h3>${tr('Map pin')}</h3><p id="location-status" aria-live="polite">${tr('Tap the map to set your delivery location.')}</p></div><button type="button" id="geolocate"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="6"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></svg>${tr('Use my location')}</button></div>
            <div id="map" class="map"></div><small class="map-lookup-credit">${tr('Address lookup uses')} <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>.</small>
            <input type="hidden" id="latitude" name="latitude" value="30.228"><input type="hidden" id="longitude" name="longitude" value="31.48">
            <label class="checkout-checkbox"><input type="checkbox" id="save-address">${tr('Save this address')}</label>
            <div id="address-label-field" hidden>${input('label', 'Address label', t('Home'), 'text', false)}</div>
          </div>
        </section>
        <section class="panel checkout-section">
          ${sectionTitle('04', 'A little extra', 'Anything we should know?')}
          <label for="notes">${tr('Order notes')} <span class="checkout-optional">${tr('Optional')}</span></label><textarea id="notes" rows="3" maxlength="1000" placeholder="${tr('Delivery instructions or a note for the kitchen…')}"></textarea>
        </section>
        <div id="checkout-error" class="checkout-error" role="alert" hidden></div>
      </form>
      <aside class="checkout-summary panel" aria-labelledby="summary-title">
        <div class="checkout-summary-heading"><div><span class="eyebrow">${tr('Fresh from our oven')}</span><h2 id="summary-title">${tr('Your order')}</h2></div><a href="/cart">${tr('Edit')}</a></div>
        <div class="checkout-items">${cart.map(item => { const p = productFor(item); const options = p.options.filter(o => item.optionIds.includes(o.id)); return `<article class="checkout-item">${p.image_url ? `<img src="${esc(p.image_url)}" alt="" width="64" height="64">` : '<div class="checkout-item-placeholder" aria-hidden="true">BC</div>'}<div class="checkout-item-description"><h3>${item.custom ? tr('Custom pizza') : esc(local(p, 'name'))}</h3><p>${options.length ? options.map(o => esc(local(o, 'name'))).join(' · ') : tr('32 cm · Neapolitan crust')}</p><span>${tr('Quantity')}: ${item.quantity}</span></div><strong>${esc(money(unit(item) * item.quantity))}</strong></article>`; }).join('')}</div>
        <div class="checkout-totals"><div><span>${tr('Subtotal')}</span><strong id="summary-subtotal">${esc(money(total()))}</strong></div><div id="summary-delivery-row"><span>${tr('Delivery fee')}</span><strong id="summary-delivery">${esc(money(config.deliveryFee))}</strong></div><div class="checkout-grand-total"><span>${tr('Total')}</span><strong id="summary-total">${esc(money(total() + config.deliveryFee))}</strong></div></div>
        <fieldset class="checkout-payment-options" aria-describedby="payment-hint">
          <legend>${tr('Payment method')}</legend>
          <div class="checkout-payment-choices">
            <label class="checkout-payment" hidden><input type="radio" name="paymentMethod" value="PAY_AT_CASHIER" form="checkout-form" disabled><strong>${tr('Pay at cashier')}</strong><small>${tr('Pay at the store when you collect.')}</small></label>
            <label class="checkout-payment">
              <input type="radio" name="paymentMethod" value="CASH_ON_DELIVERY" form="checkout-form" checked>
              <span class="payment-selected" aria-hidden="true">✓</span>
              <span class="payment-logo payment-logo-cash" aria-hidden="true"><svg viewBox="0 0 48 32" fill="none"><rect x="3" y="3" width="42" height="26" rx="5" fill="currentColor" fill-opacity=".1" stroke="currentColor" stroke-width="2"/><circle cx="24" cy="16" r="7" stroke="currentColor" stroke-width="2"/><path d="M10 10h3M35 22h3M10 22h3M35 10h3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span>
              <strong>${tr('Cash')}</strong><small>${tr('On delivery')}</small>
            </label>
            <label class="checkout-payment">
              <input type="radio" name="paymentMethod" value="INSTAPAY_ON_DELIVERY" form="checkout-form">
              <span class="payment-selected" aria-hidden="true">✓</span>
              <span class="payment-logo payment-logo-instapay"><img src="/assets/instapay-logo.png" alt="" width="160" height="160"></span>
              <strong>InstaPay</strong><small>${tr('On delivery')}</small>
            </label>
          </div>
          <p id="payment-hint" class="checkout-payment-hint" aria-live="polite">${tr('Pay when your pizza arrives.')}</p>
        </fieldset>
        <button class="primary checkout-submit" id="place-order" type="submit" form="checkout-form"><span>${tr('Place order')}</span><span>↗</span></button>
        <p class="checkout-reassurance">${tr('Made to order. Delivered with care.')}</p>
      </aside>
    </div>`;
  $('#customerName').autocomplete = 'name';
  if (config.acceptOrders === false) {
    const notice = document.createElement('p'); notice.className = 'notice'; notice.textContent = config.closedMessage;
    view.prepend(notice); $('#place-order').disabled = true;
  }
  $('#customerName').maxLength = 160;
  $('#address_line').autocomplete = 'street-address';
  $('#address_line').maxLength = 300;
  $('#phone').autocomplete = 'tel';
  $('#phone').inputMode = 'tel';
  $('#phone').dir = 'ltr';
  $('#phone').pattern = '(\\+20|0)(10|11|12|15)[0-9]{8}';
  $('#phone').placeholder = '01012345678';
  $('#landmark').maxLength = 200;
  $('#label').maxLength = 60;
  document.querySelectorAll('input[name="paymentMethod"]').forEach(input => input.addEventListener('change', () => {
    $('#payment-hint').textContent = t(input.value === 'INSTAPAY_ON_DELIVERY' ? 'Transfer when your order arrives. The driver will confirm receipt.' : 'Pay when your pizza arrives.');
  }));
  for (const [name, limit] of [['latitude', 90], ['longitude', 180]]) {
    $(`#${name}`).min = String(-limit);
    $(`#${name}`).max = String(limit);
    $(`#${name}`).dir = 'ltr';
  }
  for (const name of ['floor', 'apartment']) $(`#${name}`).maxLength = 20;
  const mapReady = mountMap(null, true, false).then(() => true).catch(error => { if ($('#location-status')) $('#location-status').textContent = t(error.message); return false; });
  let automaticLocationRequested = false;
  const chooseAddress = () => {
    const chosen = addresses.find(a => a.id === $('#saved-address').value);
    $('#new-address').hidden = Boolean(chosen);
    $('#new-address').querySelectorAll('input').forEach(i => i.disabled = Boolean(chosen));
    $('#saved-address-preview').hidden = !chosen;
    $('#saved-address-preview').innerHTML = chosen ? `<span class="badge">${esc(chosen.label)}</span><p><strong>${esc(chosen.address_line)}</strong><br>${[chosen.landmark, chosen.floor && t('Floor') + ' ' + chosen.floor, chosen.apartment && t('Apartment') + ' ' + chosen.apartment].filter(Boolean).map(esc).join(' · ')}<br><bdi>${esc(chosen.phone)}</bdi></p>` : '';
    if (!chosen) requestAnimationFrame(async () => {
      if (!await mapReady || $('#geolocate')?.disabled) return;
      ctx.map?.invalidateSize();
      if (!automaticLocationRequested) {
        automaticLocationRequested = true;
        $('#geolocate').click();
      }
    });
  };
  chooseAddress();
  bind('#saved-address', 'change', chooseAddress);
  bind('#save-address', 'change', () => { $('#address-label-field').hidden = !$('#save-address').checked; });

  const isPickup = () => document.querySelector('input[name=fulfillmentType]:checked').value === 'PICKUP';
  const addressSection = document.querySelector('#checkout-address-section');
  const summaryDelivery = document.getElementById('summary-delivery-row');
  const paymentChoices = document.querySelectorAll('.checkout-payment');
  const updateFulfillment = () => {
    const pickup = isPickup();
    if (addressSection) {
      addressSection.hidden = pickup;
      addressSection.querySelectorAll('input, select, button').forEach(input => input.disabled = pickup);
      if (!pickup) chooseAddress();
    }
    if (summaryDelivery) summaryDelivery.hidden = pickup;
    $('#summary-subtotal').textContent = esc(money(total()));
    $('#summary-total').textContent = esc(money(total() + (pickup ? 0 : config.deliveryFee)));
    paymentChoices.forEach(el => {
      const input = el.querySelector('input[name=paymentMethod]');
      el.hidden = pickup ? input.value !== 'PAY_AT_CASHIER' : input.value === 'PAY_AT_CASHIER';
      input.disabled = el.hidden;
      if (pickup && input.value === 'PAY_AT_CASHIER') { el.hidden = false; input.checked = true; }
      else if (!pickup && input.value === 'PAY_AT_CASHIER') { el.hidden = true; if (input.checked) document.querySelector('input[name=paymentMethod]:not([value="PAY_AT_CASHIER"]').checked = true; }
    });
    $('#payment-hint').textContent = pickup ? tr('Pay at the store when you collect.') : t(document.querySelector('input[name=paymentMethod]:checked').value === 'INSTAPAY_ON_DELIVERY' ? 'Transfer when your order arrives. The driver will confirm receipt.' : 'Pay when your pizza arrives.');
  };
  document.querySelectorAll('input[name=fulfillmentType]').forEach(rb => rb.addEventListener('change', updateFulfillment));
  updateFulfillment();
  $('#checkout-form').addEventListener('input', e => { e.target.removeAttribute('aria-invalid'); $('#checkout-error').hidden = true; });
  bind('#checkout-form', 'submit', async e => {
    e.preventDefault();
    const button = $('#place-order');
    if (button.disabled) return;
    const original = button.innerHTML;
    button.textContent = t('Placing your order…');
    $('#checkout-error').hidden = true;
    try {
      await busy(button, async () => {
        let addressId = isPickup() ? '' : $('#saved-address').value;
        const address = isPickup() || addressId ? undefined : addressInput(e.target);
        if (address && $('#save-address').checked) {
          const saved = await api('/api/addresses', { method: 'POST', body: address });
          addressId = saved.address.id;
          addresses.push(saved.address);
          $('#saved-address').add(new Option(saved.address.label + ' · ' + saved.address.address_line, addressId));
          $('#saved-address').value = addressId;
          $('.checkout-saved-picker').hidden = false;
          chooseAddress();
        }
        const payload = { customerName: $('#customerName').value, fulfillmentType: document.querySelector('input[name=fulfillmentType]:checked').value, paymentMethod: document.querySelector('input[name=paymentMethod]:checked').value, ...(!isPickup() ? (addressId ? { addressId } : { address }) : {}), notes: $('#notes').value, items: cart.map(({ productId, quantity, optionIds, custom }) => ({ productId, quantity, optionIds, custom })) };
        const body = JSON.stringify(payload);
        let retry;
        try { retry = JSON.parse(sessionStorage.getItem('bella_checkout_request') || 'null'); } catch {}
        if (!retry || retry.body !== body) retry = {body,key:crypto.randomUUID()};
        sessionStorage.setItem('bella_checkout_request',JSON.stringify(retry));
        const {order} = await api('/api/orders',{method:'POST',body:{...payload,idempotencyKey:retry.key}});
        sessionStorage.removeItem('bella_checkout_request');
        ctx.cart = []; saveCart(); location.href = '/track?id=' + order.id;
      });
    } catch (error) {
      $('#checkout-error').textContent = error.fields?.length ? t('Please check your delivery details and try again.') : t(error.message);
      $('#checkout-error').hidden = false;
      let first;
      for (const issue of error.fields || []) {
        const name = issue.path.split('.').pop();
        const target = document.getElementById(name);
        if (target) { target.setAttribute('aria-invalid', 'true'); first ||= target; }
      }
      if (first) { first.closest('details')?.setAttribute('open', ''); first.focus(); }
      else $('#checkout-error').scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    } finally { button.innerHTML = original; }
  });
}

  return checkout();
}
