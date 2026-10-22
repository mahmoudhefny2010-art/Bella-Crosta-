import { language, setContentOverrides } from './i18n.js';
let state = { settings: {}, customized: [], copy: {}, catalog: [] };
export function setSiteContent(data) {
  state = data || state;
  const overrides = Object.fromEntries(Object.entries(state.copy || {}));
  for (const field of state.catalog || []) if (field.source && state.customized?.includes(field.key)) overrides[field.source] = state.settings[field.key];
  setContentOverrides(overrides);
}
export function siteValue(key, fallback = '', locale = language) { return state.settings?.[key]?.[locale] ?? fallback; }
export function isCustomized(key) { return state.customized?.includes(key); }
export function siteList(key) { try { return JSON.parse(siteValue(key, '[]')); } catch { return []; } }
export function siteEnabled(key) { return siteValue(key, 'true') !== 'false'; }
export function applySiteFrame({ $, esc, t }) {
  if (isCustomized('asset.logo')) {
    document.querySelectorAll('img[src="/assets/logo.png"]').forEach(image => { image.src = siteValue('asset.logo'); });
    document.querySelectorAll('link[rel="icon"],link[rel="apple-touch-icon"]').forEach(link => { link.href = siteValue('asset.logo'); link.removeAttribute('type'); });
  }
  if (isCustomized('site.title')) document.title = siteValue('site.title');
  if (isCustomized('site.description')) document.querySelector('meta[name="description"]')?.setAttribute('content', siteValue('site.description'));
  if (isCustomized('site.loading') && $('#loading-screen p')) $('#loading-screen p').textContent = siteValue('site.loading');
  const replaceText = (selector, key) => { const element = $(selector); if (element && isCustomized(key)) element.textContent = siteValue(key); };
  replaceText('#tagline', 'footer.tagline'); replaceText('.footer-phone','footer.phone'); replaceText('.footer-meta>span','footer.copyright');
  replaceText('.footer-credits>span:first-child','footer.credit_label'); replaceText('.footer-credits a:first-of-type strong','footer.credit_one'); replaceText('.footer-credits a:last-of-type strong','footer.credit_two');
  if (isCustomized('footer.phone') && $('.footer-phone')) $('.footer-phone').href = 'tel:' + siteValue('footer.phone').replace(/[^+\d]/g, '');
  for (const [selector,key] of [['.footer-credits a:first-of-type','footer.credit_one_link'],['.footer-credits a:last-of-type','footer.credit_two_link']]) if ($(selector) && isCustomized(key)) $(selector).href = siteValue(key);
  if ($('.footer-credits')) $('.footer-credits').hidden = !siteEnabled('footer.show_credits');
  const links = siteList('footer.links').filter(link => link.visible);
  $('.footer-extra-links')?.remove();
  if (links.length && $('.footer-main')) {
    const nav = document.createElement('nav'); nav.className = 'footer-extra-links'; nav.setAttribute('aria-label', t('Footer'));
    nav.innerHTML = links.map(link => `<a href="${esc(link.href)}">${esc(language === 'ar' ? link.label_ar || link.label_en : link.label_en)}</a>`).join(''); $('.footer-main').append(nav);
  }
}
