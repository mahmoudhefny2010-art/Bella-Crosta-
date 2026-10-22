import { api } from './api.js';
import { inEgypt } from './egypt.js';
import { createDeliveryMap } from './maps.js';
import { t, language, local, money, status, setLanguage } from './i18n.js';
import { setSiteContent, siteValue, siteList, siteEnabled, isCustomized, applySiteFrame } from './site-content.js';
import { createLiveClient } from './live.js';
import { loadRepeatOrder, renderRepeatOrder, bindRepeatOrder } from './sections/repeat-order.js';
const app = document.querySelector('#app');
const path = location.pathname;
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const tr = value => esc(t(value));
const $ = s => document.querySelector(s);
const routeLink = (url, name) => `<a href="${url}" class="${path === url ? 'active' : ''}" ${path === url ? 'aria-current="page"' : ''}>${tr(name)}</a>`;
let user, config, products = [], cart = [], socket, map, marker, driverMarker, activeOrder, gpsTimer, scanner, soundContext, pushSdk, toastTimer, installPrompt;
try { cart = JSON.parse(localStorage.getItem('bella_cart_v2') || '[]'); if (!Array.isArray(cart)) cart = []; } catch { cart = []; }
function toast(message) { clearTimeout(toastTimer); $('#toast').textContent = t(message); $('#toast').classList.add('show'); toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 4500); }
function saveCart() {
  localStorage.setItem('bella_cart_v2', JSON.stringify(cart));
  const count = cart.reduce((sum, i) => sum + i.quantity, 0);
  $('#bag-count').textContent = count;
  $('#cart-link').setAttribute('aria-label', t('Your bag') + ': ' + count);
  const quickBag = $('#quick-bag');
  if (quickBag) {
    quickBag.hidden = !count || !['/', '/menu', '/builder'].includes(path);
    quickBag.innerHTML = `<span>${tr('View bag')} <small>(${count})</small></span><span>${esc(money(total()))} →</span>`;
  }
}
function productFor(item) { return products.find(p => p.id === item.productId); }
function unit(item) { const p = productFor(item); return p ? (p.sale_price_egp ?? p.price_egp) + p.options.filter(o => item.optionIds.includes(o.id)).reduce((s, o) => s + o.price_delta_egp, 0) : 0; }
function total() { return cart.reduce((s, i) => s + unit(i) * i.quantity, 0); }
function add(productId, optionIds = [], custom = false) {
  const key = productId + ':' + [...optionIds].sort().join(',') + ':' + custom;
  const item = cart.find(i => i.key === key);
  if (item) item.quantity = Math.min(item.quantity + 1, 20);
  else cart.push({ key, productId, optionIds, custom, quantity: 1 });
  saveCart(); toast('Added to your bag');
}
function addMany(items) {
  for (const line of items) {
    const product = products.find(item => String(item.id).toLowerCase() === String(line.productId).toLowerCase());
    if (!product || !Array.isArray(line.optionIds)) continue;
    const optionIds = line.optionIds.map(id => product.options.find(option => String(option.id).toLowerCase() === String(id).toLowerCase())?.id);
    if (optionIds.some(id => !id)) continue;
    const quantity = Math.max(1, Math.min(20, Number(line.quantity) || 1));
    const key = product.id + ':' + [...optionIds].sort().join(',') + ':' + Boolean(line.custom);
    const item = cart.find(value => value.key === key);
    if (item) item.quantity = Math.min(20, item.quantity + quantity);
    else cart.push({ key, productId: product.id, optionIds, custom: Boolean(line.custom), quantity });
  }
  saveCart(); toast('Added to your bag');
}
function page(title, subtitle = '') {
  const id = path.slice(1), titleKey = `page.${id}.title`, subtitleKey = `page.${id}.subtitle`;
  const heading = isCustomized(titleKey) ? siteValue(titleKey) : t(title);
  const introduction = isCustomized(subtitleKey) ? siteValue(subtitleKey) : t(subtitle);
  app.innerHTML = `<div class="container page"><span class="eyebrow">${esc(siteValue('site.name','Bella Crosta'))}</span><h1>${esc(heading)}</h1>${introduction ? `<p class="sub">${esc(introduction)}</p>` : ''}<div id="view"></div></div>`; return $('#view');
}
function field(name, title, value = '', type = 'text', required = true) { return `<label for="${name}">${tr(title)}</label><input id="${name}" name="${name}" type="${type}" value="${esc(value)}" ${required ? 'required' : ''} ${type === 'number' ? 'step="any"' : ''}>`; }
function bind(id, event, fn) { $(id)?.addEventListener(event, async e => { try { await fn(e); } catch (error) { toast(error.message); } }); }
async function busy(button, work) { button.disabled = true; try { return await work(); } finally { button.disabled = false; } }
function arrangeHeaderTools() {
  const nav = $('#navigation'), actions = $('.header-actions'), bag = $('#cart-link'), toggle = $('#mobile-nav');
  const tools = ['#theme-toggle', '#language', '#signin-link', '#account-menu'].map($);
  if (matchMedia('(max-width: 860px)').matches) {
    let mobileTools = nav.querySelector('.mobile-nav-tools');
    if (!mobileTools) { mobileTools = document.createElement('div'); mobileTools.className = 'mobile-nav-tools'; mobileTools.setAttribute('aria-label', t('Menu')); nav.append(mobileTools); }
    tools.forEach(el => mobileTools.append(el));
  } else {
    tools.slice(0, 2).forEach(el => actions.insertBefore(el, bag));
    tools.slice(2).forEach(el => actions.insertBefore(el, toggle));
    nav.querySelector('.mobile-nav-tools')?.remove();
  }
}
function pizzaCard(p) {
  const onOffer = p.sale_price_egp != null && p.sale_price_egp < p.price_egp;
  const price = onOffer ? `<span class="sale-price"><del>${esc(money(p.price_egp))}</del><strong class="price">${esc(money(p.sale_price_egp))}</strong></span>` : `<span class="price">${esc(money(p.price_egp))}</span>`;
  return `<article class="pizza-card">${p.is_featured ? `<span class="signature-tag">${tr('Signature')}</span>` : ''}${onOffer ? `<span class="offer-tag">${tr('Offer')}</span>` : ''}${p.image_url ? `<img src="${esc(p.image_url)}" alt="${esc(local(p, 'name'))}" loading="lazy" width="640" height="480">` : `<div class="missing-photo">${esc(local(p, 'name'))}</div>`}<div class="content"><span class="label">${esc(local(p, 'category_name'))}</span><h3>${esc(local(p, 'name'))}</h3><p>${esc(local(p, 'description'))}</p><span class="label">${tr('32 cm · Neapolitan crust')}</span><div class="card-foot">${price}<button class="primary" data-add="${p.id}" aria-label="${tr('Add')} ${esc(local(p, 'name'))}">${tr('Add')} +</button></div></div></article>`;
}
function renderNav() {
  const assignedRoles = Array.isArray(user?.roles) ? user.roles : (user?.role ? [user.role] : []);
  const hasRole = role => assignedRoles.includes(role);
  let nav = '';
  if (siteEnabled('header.show_home')) nav += routeLink('/', 'Home');
  if (siteEnabled('header.show_menu')) nav += routeLink('/menu', 'Menu');
  if (siteEnabled('header.show_builder')) nav += routeLink('/builder', 'Build your own');
  if (user && siteEnabled('header.show_orders')) nav += routeLink('/orders', 'Orders');
  if (user && siteEnabled('header.show_addresses')) nav += routeLink('/addresses', 'Addresses');
  for (const link of siteList('header.extra_links').filter(link => link.visible)) nav += `<a href="${esc(link.href)}" class="${path === link.href ? 'active' : ''}">${esc(language === 'ar' ? link.label_ar || link.label_en : link.label_en)}</a>`;
  $('#navigation').innerHTML = nav;
  arrangeHeaderTools();
  const signInLink = $('#signin-link');
  signInLink.hidden = Boolean(user);
  signInLink.setAttribute('aria-label', t('Sign in'));
  signInLink.title = t('Sign in');
  $('#signin-label').textContent = t('Sign in');
  const accountMenu = $('#account-menu');
  const accountToggle = $('#account-toggle');
  const accountPopover = $('#account-popover');
  accountMenu.hidden = !user;
  accountToggle.setAttribute('aria-label', accountLabel('My account'));
  accountToggle.title = accountLabel('My account');
  accountPopover.setAttribute('aria-label', accountLabel('Account menu'));
  if (user) {
    const dashboards = [
      ...(hasRole('admin') ? [['/admin', 'Admin dashboard'], ['/kitchen', 'Kitchen dashboard']] : []),
      ...(!hasRole('admin') && hasRole('kitchen') ? [['/kitchen', 'Kitchen dashboard']] : []),
      ...(hasRole('driver') ? [['/delivery', 'Delivery dashboard']] : []),
      ...(hasRole('owner') ? [['/owner', 'Owner dashboard']] : [])
    ];
    const roleNames = { customer: 'Customer', admin: 'Administrator', owner: 'Owner', kitchen: 'Kitchen', driver: 'Driver' };
    const roleLabel = assignedRoles.map(role => roleNames[role]).filter(Boolean).map(accountLabel).join(' · ');
    accountPopover.innerHTML = `<div class="account-identity"><span class="account-avatar" aria-hidden="true">${esc((user.name || user.email || '?').trim().charAt(0).toUpperCase())}</span><div class="account-identity-copy"><strong>${accountLabel('My account')}</strong><span class="account-email">${esc(user.email || '')}</span>${roleLabel ? `<span class="account-role">${esc(roleLabel)}</span>` : ''}</div></div><div class="account-links"><a href="/orders">${accountLabel('My orders')}</a>${dashboards.length ? `<div class="account-section-title">${accountLabel('My dashboards')}</div>${dashboards.map(([href, label]) => `<a href="${href}">${accountLabel(label)}</a>`).join('')}` : ''}<button class="account-signout" id="logout" type="button">${accountLabel('Sign out')}</button></div>`;
    accountPopover.hidden = !accountToggle.getAttribute('aria-expanded') || accountToggle.getAttribute('aria-expanded') === 'false';
  } else {
    accountPopover.hidden = true;
  }
  $('#language-label').textContent = language === 'en' ? 'عربي' : 'EN';
  $('#language').setAttribute('aria-label', language === 'en' ? 'Switch to Arabic' : 'Switch to English');
  $('#language').title = language === 'en' ? 'Switch to Arabic' : 'Switch to English';
  $('#cart-link').setAttribute('aria-label', t('Your bag') + ': ' + cart.reduce((sum, item) => sum + item.quantity, 0));
  $('.skip-link').textContent = t('Skip to content');
  $('#mobile-nav').setAttribute('aria-label', t('Menu'));
  $('#mobile-nav').setAttribute('aria-controls', 'navigation');
  $('#cart-link').title = t('Your bag');
  $('#tagline').textContent = t('French Passion. Egyptian Heart. Italian Crust.');
  $('#install').textContent = t('Install app');
  applySiteFrame({ $, esc, t });
}
function accountLabel(value) {
  if (language !== 'ar') return tr(value);
  const labels = {
    'My account': '\u062d\u0633\u0627\u0628\u064a', 'Account menu': '\u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u062d\u0633\u0627\u0628',
    'My orders': '\u0637\u0644\u0628\u0627\u062a\u064a', 'My dashboards': '\u0644\u0648\u062d\u0627\u062a\u064a',
    'Admin dashboard': '\u0644\u0648\u062d\u0629 \u0627\u0644\u0625\u062f\u0627\u0631\u0629', 'Kitchen dashboard': '\u0644\u0648\u062d\u0629 \u0627\u0644\u0645\u0637\u0628\u062e',
    'Delivery dashboard': '\u0644\u0648\u062d\u0629 \u0627\u0644\u062a\u0648\u0635\u064a\u0644', 'Administrator': '\u0645\u062f\u064a\u0631',
    'Kitchen': '\u0627\u0644\u0645\u0637\u0628\u062e', 'Driver': '\u0645\u0646\u062f\u0648\u0628', 'Sign out': '\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062e\u0631\u0648\u062c'
  };
  return labels[value] || tr(value);
}
function addressFields(a = {}) {
  return `${field('label', 'Label', a.label || 'Home')}${field('address_line', 'Street and building', a.address_line)}${field('phone', 'Phone', a.phone, 'tel')}<div class="fields address-extra-fields"><div class="address-field">${field('landmark', 'Landmark', a.landmark, 'text', false)}</div><div class="address-field">${field('floor', 'Floor', a.floor, 'text', false)}</div><div class="address-field">${field('apartment', 'Apartment', a.apartment, 'text', false)}</div></div><label>${tr('Map pin')}</label><p id="location-status" aria-live="polite">${tr('Tap the map to set your delivery location.')}</p><button class="address-location-button" type="button" id="geolocate">${tr('Use my location')}</button><div id="map" class="map"></div><small class="map-lookup-credit">${tr('Address lookup uses')} <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>.</small><input type="hidden" id="latitude" name="latitude" value="${esc(a.latitude ?? 30.228)}"><input type="hidden" id="longitude" name="longitude" value="${esc(a.longitude ?? 31.48)}"><label><input name="is_default" type="checkbox" ${a.is_default ? 'checked' : ''}>${tr('Default address')}</label>`;
}
function addressInput(form) {
  const f = new FormData(form);
  if (!inEgypt(Number(f.get('latitude')), Number(f.get('longitude')))) throw new Error(t('Please choose a location inside Egypt.'));
  return { label: String(f.get('label') || '').trim() || t('Home'), address_line: f.get('address_line'), phone: f.get('phone'), landmark: f.get('landmark') || '', floor: f.get('floor') || '', apartment: f.get('apartment') || '', latitude: Number(f.get('latitude')), longitude: Number(f.get('longitude')), is_default: f.has('is_default') };
}
async function mountMap(position, editable = false, autoLocate = true) {
  if (map) { map.remove(); map = null; }
  if (!$('#map')) return;
  const initial = position && inEgypt(Number(position[0]), Number(position[1])) ? position : [30.228, 31.48];
  map = await createDeliveryMap($('#map'), initial, config, language);
  if (map.warning) toast(map.warning);
  marker = map.addMarker(initial, editable);
  driverMarker = null;
  let selected = marker.getLatLng();
  const currentMap = map;
  let locationPending = false;
  let addressRevision = 0, applyingMapAddress = false, lookupTimer, lookupSequence = 0;
  const addressField = $('#address_line');
  addressField?.addEventListener('input', () => { if (!applyingMapAddress) addressRevision++; });
  const lookupAddress = position => {
    if (!editable || !addressField) return;
    clearTimeout(lookupTimer);
    const sequence = ++lookupSequence;
    const revision = addressRevision;
    if ($('#location-status')) $('#location-status').textContent = t('Finding street address…');
    lookupTimer = setTimeout(async () => {
      try {
        const query = new URLSearchParams({ lat: String(position.lat), lon: String(position.lng), language });
        const result = await api('/api/geocode/reverse?' + query);
        if (map !== currentMap || sequence !== lookupSequence || revision !== addressRevision) return;
        if (result.address) {
          applyingMapAddress = true;
          addressField.value = result.address;
          addressField.dispatchEvent(new Event('input', { bubbles: true }));
          applyingMapAddress = false;
          if ($('#location-status')) $('#location-status').textContent = t('Street address filled from the map.');
        } else if ($('#location-status')) $('#location-status').textContent = t('No street address found for this map pin.');
      } catch (error) {
        applyingMapAddress = false;
        if (map === currentMap && sequence === lookupSequence && revision === addressRevision) {
          if ($('#location-status')) $('#location-status').textContent = t('Could not look up the street. You can type it manually.');
          console.warn('Could not find a street address for the selected map point.', error);
        }
      }
    }, 550);
  };
  const set = pos => {
    if (!inEgypt(pos.lat, pos.lng)) {
      marker.setLatLng(selected);
      if ($('#latitude')) $('#latitude').value = selected.lat.toFixed(7);
      if ($('#longitude')) $('#longitude').value = selected.lng.toFixed(7);
      toast('Please choose a location inside Egypt.');
      return false;
    }
    selected = pos;
    marker.setLatLng(pos);
    if ($('#latitude')) $('#latitude').value = pos.lat.toFixed(7);
    if ($('#longitude')) $('#longitude').value = pos.lng.toFixed(7);
    if ($('#location-status')) $('#location-status').textContent = t('Location selected');
    lookupAddress(pos);
    return true;
  };
  if (editable) {
    map.on('click', e => set(e.latlng)); marker.on('dragend', () => set(marker.getLatLng()));
    bind('#geolocate', 'click', async () => {
      if (locationPending) return;
      locationPending = true;
      const previousSelection = selected;
      const button = $('#geolocate');
      const locationStatus = $('#location-status');
      button.disabled = true;
      if (locationStatus) locationStatus.textContent = t('Finding your location…');
      try {
        const pos = await locate();
        if (map !== currentMap || selected !== previousSelection || $('#latitude')?.disabled) return;
        const point = { lat: pos.latitude, lng: pos.longitude };
        if (set(point)) map.setView(point, 16);
        else if (locationStatus) locationStatus.textContent = t('Please choose a location inside Egypt.');
      } catch (error) {
        if (map === currentMap && selected === previousSelection) {
          if (locationStatus) locationStatus.textContent = t('Could not find your location. Tap the map or try again.');
          toast(error.message);
        }
      } finally {
        locationPending = false;
        button.disabled = false;
      }
    });
    for (const input of ['#latitude', '#longitude']) bind(input, 'change', () => { const point = { lat: Number($('#latitude').value), lng: Number($('#longitude').value) }; if (set(point)) map.panTo(point); });
    if (autoLocate && !position) $('#geolocate').click();
  }
}
function locate() { return new Promise((resolve, reject) => { if (!navigator.geolocation) return reject(new Error(t('Location permission is required.'))); navigator.geolocation.getCurrentPosition(p => resolve(p.coords), () => reject(new Error(t('Location permission is required.'))), { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 }); }); }
function requireUser() { if (user) return true; page('Sign in').innerHTML = `<p>${tr('Please sign in to continue.')}</p><a class="button primary" href="/login">${tr('Sign in')}</a>`; return false; }
function updateDriver(data) { if (!map) return; const point = [Number(data.latitude), Number(data.longitude)]; if (!driverMarker) driverMarker = map.addMarker(point, false, true); else driverMarker.setLatLng(point); }
function beep() { if (!soundContext) return; const osc = soundContext.createOscillator(), gain = soundContext.createGain(); osc.connect(gain); gain.connect(soundContext.destination); osc.frequency.value = 720; gain.gain.value = .08; osc.start(); osc.stop(soundContext.currentTime + .25); }
function loadScript(src) { return new Promise((resolve, reject) => { const script = document.createElement('script'); script.src = src; script.onload = resolve; script.onerror = reject; document.head.appendChild(script); }); }
function isInstalled() { return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true || localStorage.getItem('bella_app_installed') === '1'; }
function hideLoadingScreen() {
  const screen = $('#loading-screen');
  if (!screen || screen.hidden) return;
  screen.classList.add('is-leaving');
  setTimeout(() => { screen.hidden = true; }, 380);
}
const onboardingKey = 'bella_first_visit_onboarding_v1';
let onboardingTimer;
function onboardingCopy() {
  return language === 'ar' ? {
    title: '\u0623\u0647\u0644\u0627\u064b \u0628\u0643 \u0641\u064a Bella Crosta',
    body: '\u0641\u0639\u0651\u0644 \u0625\u0634\u0639\u0627\u0631\u0627\u062a \u0627\u0644\u0637\u0644\u0628\u0627\u062a \u0648\u062b\u0628\u0651\u062a \u0627\u0644\u062a\u0637\u0628\u064a\u0642 \u0644\u0645\u062a\u0627\u0628\u0639\u0629 \u0637\u0644\u0628\u0643 \u0648\u0641\u062a\u062d \u0627\u0644\u0645\u0648\u0642\u0639 \u0628\u0633\u0631\u0639\u0629.',
    notify: '\u0641\u0639\u0651\u0644 \u0625\u0634\u0639\u0627\u0631\u0627\u062a \u0627\u0644\u0637\u0644\u0628\u0627\u062a', install: '\u062b\u0628\u0651\u062a \u0627\u0644\u062a\u0637\u0628\u064a\u0642', later: '\u0645\u0634 \u062f\u0644\u0648\u0642\u062a\u064a', done: '\u062a\u0645\u0627\u0645',
    notifyReady: '\u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062a \u0645\u0641\u0639\u0651\u0644\u0629', notifyUnavailable: '\u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062a \u063a\u064a\u0631 \u0645\u062a\u0627\u062d\u0629 \u062d\u0627\u0644\u064a\u064b\u0627', installed: '\u0627\u0644\u062a\u0637\u0628\u064a\u0642 \u0645\u062b\u0628\u0651\u062a',
    hint: '\u0627\u0644\u0645\u062a\u0635\u0641\u062d \u0633\u064a\u0637\u0644\u0628 \u0625\u0630\u0646\u0643 \u0628\u0639\u062f \u0636\u063a\u0637\u0643. \u062a\u0642\u062f\u0631 \u062a\u062a\u0627\u0628\u0639 \u0637\u0644\u0628\u0643 \u0628\u0625\u0634\u0639\u0627\u0631\u0627\u062a \u0648\u062a\u0636\u064a\u0641 \u0627\u0644\u0645\u0648\u0642\u0639 \u0644\u0634\u0627\u0634\u062a\u0643.',
    installHint: '\u0627\u0641\u062a\u062d \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0645\u062a\u0635\u0641\u062d \u0648\u0627\u062e\u062a\u0631 \u00ab\u0625\u0636\u0627\u0641\u0629 \u0644\u0644\u0634\u0627\u0634\u0629 \u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629\u00bb \u0625\u0630\u0627 \u0644\u0645 \u064a\u0638\u0647\u0631 \u062a\u0623\u0643\u064a\u062f \u0627\u0644\u062a\u062b\u0628\u064a\u062a.',
    laterBody: '\u0645\u0634 \u0647\u0646\u0637\u0644\u0628 \u0627\u0644\u0625\u0630\u0646 \u062a\u0627\u0646\u064a. \u064a\u0645\u0643\u0646\u0643 \u062a\u0641\u0639\u064a\u0644 \u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062a \u0623\u0648 \u0627\u0644\u062a\u062b\u0628\u064a\u062a \u0644\u0627\u062d\u0642\u064b\u0627 \u0645\u0646 \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0645\u062a\u0635\u0641\u062d.'
  } : {
    title: 'Welcome to Bella Crosta', body: 'Get order updates with notifications and add Bella Crosta to your home screen for quick access.',
    notify: 'Enable order notifications', install: 'Install the app', later: 'Not now', done: 'Got it',
    notifyReady: 'Notifications are enabled', notifyUnavailable: 'Notifications are unavailable right now', installed: 'App installed',
    hint: 'Your browser asks for notification permission only after you choose to enable it.',
    installHint: 'If the install prompt does not appear, open your browser menu and choose “Install app” or “Add to Home Screen”.',
    laterBody: 'No problem. We will not show this welcome again. You can enable notifications or install Bella Crosta later from your browser menu.'
  };
}
function openWelcome() {
  const dialog = $('#engagement-dialog');
  if (!dialog || dialog.open || localStorage.getItem(onboardingKey) === '1') return;
  const copy = onboardingCopy(), ar = language === 'ar';
  const permission = 'Notification' in window ? Notification.permission : 'unsupported';
  const notifyIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>';
  const homeIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z"/></svg>';
  const canNotify = permission === 'default' && Boolean(config?.oneSignalAppId) && (!config.oneSignalOrigin || config.oneSignalOrigin === location.origin);
  const notifyButton = permission === 'granted'
    ? `<button class="engagement-secondary" type="button" disabled>${notifyIcon}${copy.notifyReady}</button>`
    : canNotify
      ? `<button class="primary" type="button" data-onboarding="notify">${notifyIcon}${copy.notify}</button>`
      : `<button class="engagement-secondary" type="button" disabled>${notifyIcon}${copy.notifyUnavailable}</button>`;
  const installButton = isInstalled()
    ? `<button class="engagement-secondary" type="button" disabled>${homeIcon}${copy.installed}</button>`
    : `<button class="engagement-secondary" type="button" data-onboarding="install">${homeIcon}${copy.install}</button>`;
  dialog.innerHTML = `<div class="engagement-card" dir="${ar ? 'rtl' : 'ltr'}"><button class="engagement-close" type="button" data-onboarding="later" aria-label="Close">&times;</button><div class="engagement-brand"><img src="/assets/logo.png" alt="Bella Crosta" width="64" height="64"></div><h2 id="engagement-title">${copy.title}</h2><p id="engagement-body">${copy.body}</p><div class="engagement-actions">${notifyButton}${installButton}<button class="engagement-secondary" type="button" data-onboarding="later">${copy.later}</button></div><span class="engagement-hint" id="engagement-hint">${copy.hint}</span></div>`;
  localStorage.setItem(onboardingKey, '1');
  dialog.showModal();
}
function promptInstallSoon() {
  if (onboardingTimer || localStorage.getItem(onboardingKey) === '1') return;
  onboardingTimer = setTimeout(() => { onboardingTimer = null; openWelcome(); }, 450);
}
async function syncPushSubscription() {
  if (!user || !pushSdk?.User?.PushSubscription?.id) return;
  try { await api('/api/push/subscribers', { method: 'POST', body: { subscriptionId: pushSdk.User.PushSubscription.id } }); }
  catch (error) { console.warn('Could not link OneSignal subscription to this account.', error); }
}
async function push() {
  if (!config.oneSignalAppId || !('Notification' in window)) { promptInstallSoon(); return; }
  if(config.oneSignalOrigin&&config.oneSignalOrigin!==location.origin){promptInstallSoon();return;}
  try {
    await loadScript('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js');
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    await new Promise(resolve => window.OneSignalDeferred.push(async OneSignal => {
      try {
        pushSdk = OneSignal;
        await OneSignal.init({ appId: config.oneSignalAppId, serviceWorkerPath: '/OneSignalSDKWorker.js', serviceWorkerParam: { scope: '/' }, allowLocalhostAsSecureOrigin: true });
        if (user) await OneSignal.login(user.id);
        OneSignal.User?.PushSubscription?.addEventListener?.('change', syncPushSubscription);
        await syncPushSubscription();
        promptInstallSoon();
      } catch (error) { console.warn('OneSignal could not initialize.', error); promptInstallSoon(); }
      finally { resolve(); }
    }));
  } catch (error) { console.warn('OneSignal SDK could not load.', error); promptInstallSoon(); }
}
const pageModules = {
  '/': () => import('./pages/home.js'), '/menu': () => import('./pages/menu.js'), '/cart': () => import('./pages/cart.js'),
  '/checkout': () => import('./pages/checkout.js'), '/orders': () => import('./pages/orders.js'), '/track': () => import('./pages/orders.js'),
  '/addresses': () => import('./pages/addresses.js'), '/builder': () => import('./pages/builder.js'), '/kitchen': () => import('./pages/kitchen.js'),
  '/delivery': () => import('./pages/delivery.js'), '/admin': () => import('./pages/admin.js'), '/login': () => import('./pages/login.js'),
  '/owner': () => import('./pages/owner.js'), '/content-page': () => import('./pages/content-page.js')
};
const pageStyles = {
  '/': 'home', '/menu': 'menu', '/cart': 'cart', '/checkout': 'checkout', '/orders': 'orders', '/track': 'orders',
  '/addresses': 'addresses', '/builder': 'builder', '/kitchen': 'kitchen', '/delivery': 'delivery', '/admin': 'admin', '/login': 'login',
  '/owner': 'owner', '/content-page': 'content-page'
};
const sectionStyles = { '/': ['hero', 'brand-strip', 'napoli-feature'] };
const pageContext = {
  app, path, $, esc, tr, api, inEgypt, t, local, money, status, setLanguage, page, field, bind, busy, pizzaCard,
  renderNav, saveCart, productFor, unit, total, add, addMany, requireUser, addressFields, addressInput, mountMap, locate, updateDriver, beep, loadScript, toast,
  loadRepeatOrder, renderRepeatOrder, bindRepeatOrder,
  get language() { return language; },
  renderRoute: target => renderRoute(target),
  get user() { return user; }, set user(value) { user = value; },
  get config() { return config; }, set config(value) { config = value; },
  get map() { return map; },
  get products() { return products; }, set products(value) { products = value; },
  get cart() { return cart; }, set cart(value) { cart = value; },
  get socket() { return socket; }, set socket(value) { socket = value; },
  get activeOrder() { return activeOrder; }, set activeOrder(value) { activeOrder = value; },
  get gpsTimer() { return gpsTimer; }, set gpsTimer(value) { gpsTimer = value; },
  get scanner() { return scanner; }, set scanner(value) { scanner = value; },
  get soundContext() { return soundContext; }, set soundContext(value) { soundContext = value; }
};
async function renderRoute(target = path) {
  const route = target.startsWith('/pages/') ? '/content-page' : pageModules[target] ? target : '/menu';
  const hrefs = [`/css/pages/${pageStyles[route]}.css`, ...(sectionStyles[route] || []).map(name => `/css/sections/${name}.css`)];
  const currentStyles = [...document.querySelectorAll('[data-route-style]')];
  if (currentStyles.map(style => style.getAttribute('href')).join('|') !== hrefs.join('|')) {
    const nextStyles = hrefs.map((href, index) => { const link = document.createElement('link'); link.dataset.routeStyle = String(index); link.rel = 'stylesheet'; link.href = href; return link; });
    await Promise.all(nextStyles.map(link => new Promise(resolve => { link.onload = resolve; link.onerror = resolve; document.head.insertBefore(link, document.querySelector('link[href*="/css/polish.css"]')); })));
    currentStyles.forEach(style => style.remove());
  }
  const load = pageModules[route];
  const module = await load();
  return module.default(pageContext);
}
let liveRefreshTimer, liveRefreshRunning = false, liveRefreshPending = false, lastOrderBeep = 0;
function scheduleLiveRefresh() {
  liveRefreshPending = true;
  if (liveRefreshTimer || liveRefreshRunning) return;
  liveRefreshTimer = setTimeout(async()=>{
    liveRefreshTimer = null;
    if (document.hidden || (path === '/delivery' && (scanner || document.activeElement?.closest('[data-confirm]')))) return;
    liveRefreshPending = false; liveRefreshRunning = true;
    try { await renderRoute(path); } catch(error) { toast(error.message); }
    finally { liveRefreshRunning = false; if (liveRefreshPending) scheduleLiveRefresh(); }
  },400);
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden && liveRefreshPending)scheduleLiveRefresh();});
document.addEventListener('focusout',()=>{if(path === '/delivery' && liveRefreshPending)scheduleLiveRefresh();});
async function init() {
  const data = await Promise.all([api('/api/menu'), api('/api/me'), api('/api/config'), api('/api/content').catch(() => null)]);
  products = data[0].products; user = data[1].user; config = data[2];
  if (data[3]) setSiteContent(data[3]);
  cart = cart.filter(i => productFor(i) && Array.isArray(i.optionIds) && Number.isInteger(i.quantity) && i.quantity > 0 && i.quantity <= 20);
  saveCart(); renderNav();
  if (user && (window.io || config.realtimeMode==='poll')) {
    socket = createLiveClient(config,api);
    socket.on('order', data => {
      if (path === '/kitchen' && data.status === 'PLACED' && Date.now()-lastOrderBeep>1000) { lastOrderBeep=Date.now();beep(); }
      if (['/kitchen','/orders','/delivery'].includes(path) || (path === '/track' && data.id === activeOrder?.id)) scheduleLiveRefresh();
    });
    socket.on('location', data => { if (data.orderId === activeOrder?.id) updateDriver(data); });
    socket.on('connect', () => { if (activeOrder) { socket.emit('watch', activeOrder.id); renderRoute('/track').catch(e => toast(e.message)); } });
  }
  await renderRoute(path);
  hideLoadingScreen();
  push().catch(() => {});
}
document.addEventListener('click', e => {
  const button = e.target.closest('[data-add]');
  if (!button || button.disabled) return;
  add(button.dataset.add);
  const label = button.innerHTML;
  button.disabled = true;
  button.textContent = t('Added') + ' ✓';
  setTimeout(() => { button.innerHTML = label; button.disabled = false; }, 750);
});
bind('#language', 'click', () => setLanguage(language === 'en' ? 'ar' : 'en'));
bind('#account-toggle', 'click', () => {
  const toggle = $('#account-toggle'), popover = $('#account-popover');
  const open = toggle.getAttribute('aria-expanded') !== 'true';
  toggle.setAttribute('aria-expanded', String(open));
  popover.hidden = !open;
});
document.addEventListener('click', async e => {
  if (e.target.closest('#logout')) {
    try { if (pushSdk) await pushSdk.logout(); } finally { await api('/auth/logout', { method: 'POST' }); location.href = '/'; }
    return;
  }
  if (!e.target.closest('#account-menu')) {
    const toggle = $('#account-toggle'), popover = $('#account-popover');
    if (toggle && popover) { toggle.setAttribute('aria-expanded', 'false'); popover.hidden = true; }
  }
});
bind('#mobile-nav', 'click', () => { const open = $('#navigation').classList.toggle('open'); $('#mobile-nav').setAttribute('aria-expanded', String(open)); });
window.addEventListener('resize', arrangeHeaderTools, { passive: true });
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const accountToggle = $('#account-toggle'), accountPopover = $('#account-popover');
  if (accountToggle?.getAttribute('aria-expanded') === 'true') { accountToggle.setAttribute('aria-expanded', 'false'); accountPopover.hidden = true; accountToggle.focus(); }
  if ($('#navigation').classList.contains('open')) { $('#navigation').classList.remove('open'); $('#mobile-nav').setAttribute('aria-expanded', 'false'); $('#mobile-nav').focus(); }
});
document.addEventListener('click', e => { if ($('#navigation').classList.contains('open') && (!e.target.closest('.header') || (e.target.closest('.mobile-nav-tools') && !e.target.closest('#account-menu')))) { $('#navigation').classList.remove('open'); $('#mobile-nav').setAttribute('aria-expanded', 'false'); } });
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; $('#install').hidden = false; });
window.addEventListener('appinstalled', () => {
  localStorage.setItem('bella_app_installed', '1'); installPrompt = null; $('#install').hidden = true;
  const installButton = $('#engagement-dialog [data-onboarding="install"]');
  if (installButton) { installButton.textContent = onboardingCopy().installed; installButton.disabled = true; installButton.removeAttribute('data-onboarding'); }
});
const engagementDialog = $('#engagement-dialog');
engagementDialog.addEventListener('click', async e => {
  const button = e.target.closest('[data-onboarding]');
  if (!button) return;
  const action = button.dataset.onboarding;
  const copy = onboardingCopy();
  if (action === 'later') {
    localStorage.setItem(onboardingKey, '1');
    $('#engagement-body').textContent = copy.laterBody;
    $('#engagement-hint').textContent = '';
    engagementDialog.querySelectorAll('[data-onboarding]').forEach(item => item.remove());
    engagementDialog.querySelector('.engagement-actions').innerHTML = `<button class="primary" type="button" data-onboarding="done">${copy.done}</button>`;
    return;
  }
  if (action === 'done') { engagementDialog.close(); return; }
  button.disabled = true;
  if (action === 'notify') {
    try {
      if (pushSdk?.Notifications?.requestPermission) await pushSdk.Notifications.requestPermission();
      else await Notification.requestPermission();
      await syncPushSubscription();
      if (Notification.permission === 'granted') { button.textContent = copy.notifyReady; toast('Notifications enabled'); }
      else { button.textContent = copy.notifyUnavailable; }
    } catch (error) { button.disabled = false; toast(error.message || 'Could not enable notifications'); }
    return;
  }
  if (action === 'install' && installPrompt) {
    const prompt = installPrompt;
    installPrompt = null;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice?.outcome === 'accepted') {
        localStorage.setItem('bella_app_installed', '1');
        button.textContent = copy.installed;
        button.removeAttribute('data-onboarding');
      } else button.disabled = false;
    } catch (error) { console.warn('Browser install prompt failed.', error); button.disabled = false; }
  } else { $('#engagement-hint').textContent = copy.installHint; button.disabled = false; }
  $('#install').hidden = !installPrompt;
});
engagementDialog.addEventListener('cancel', e => {
  e.preventDefault();
  engagementDialog.querySelector('[data-onboarding="later"]')?.click();
});
bind('#install', 'click', async () => {
  if (!installPrompt) return;
  const prompt = installPrompt; installPrompt = null;
  await prompt.prompt(); await prompt.userChoice;
  $('#install').hidden = true;
});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
window.addEventListener('pagehide', () => { clearInterval(gpsTimer); if (scanner) scanner.stop().catch(() => {}); });
init().catch(error => { hideLoadingScreen(); page('Something went wrong.').innerHTML = `<p class="error">${esc(navigator.onLine ? error.message : t('You are offline.'))}</p><button id="retry">${tr('Try again')}</button>`; bind('#retry', 'click', () => location.reload()); });
