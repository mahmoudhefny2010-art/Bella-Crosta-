import { renderHero } from '../sections/hero.js';
import { renderBrandStrip } from '../sections/brand-strip.js';
import { renderNapoliFeature } from '../sections/napoli-feature.js';
import { siteEnabled } from '../site-content.js';

export default function createPage(context) {
  const ctx = context;
  const { app, path, $, esc, tr, api, inEgypt, language, t, local, money, status, setLanguage, page, field, bind, busy, pizzaCard, renderNav, saveCart, productFor, unit, total, add, requireUser, addressFields, addressInput, mountMap, locate, updateDriver, beep, loadScript, toast, renderRoute, user, config, products, cart, socket } = context;

async function home() {
  const repeatOrder = await ctx.loadRepeatOrder(ctx);
  const recommendation = ctx.renderRepeatOrder(ctx, repeatOrder);
  app.innerHTML = `<div class="home-intro">${renderHero({ tr, config, esc })}${renderBrandStrip({ tr })}</div><section class="container section"><div class="section-head"><div><span class="eyebrow">${tr('Our signatures')}</span><h2>${tr('Meet your next favourite')}</h2></div><a class="button outline" href="/menu">${tr('View full menu')} ↗</a></div><div class="grid">${products.filter(p => p.is_featured).slice(0, 3).map(pizzaCard).join('')}</div></section>${renderNapoliFeature({ tr, config, esc })}`;
  if (recommendation) { const section = document.createElement('section'); section.className = 'container repeat-order-section'; section.innerHTML = recommendation; $('.home-intro').after(section); }
  ctx.bindRepeatOrder(ctx, repeatOrder);
  for (const [key,selector] of [['hero','.hero'],['ticker','.ticker'],['featured','section.container.section'],['napoli','.napoli-section']]) if (!siteEnabled('section.' + key)) $(selector)?.remove();
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches && $('.hero-photo')) {
    const source = $('.hero-photo');
    const photo = document.createElement('div');
    photo.className = 'hero-pizza';
    source.replaceWith(photo);
    source.className = 'pizza-base';
    const slice = source.cloneNode();
    slice.className = 'pizza-slice';
    slice.alt = '';
    slice.setAttribute('aria-hidden', 'true');
    photo.append(source, slice);
    let scheduled = false;
    const animate = () => {
      scheduled = false;
      const progress = Math.min(1, window.scrollY / 650);
      slice.style.transform = `translate(${12 + progress * 38}px, ${-8 - progress * 30}px) rotate(${progress * 4}deg)`;
    };
    requestAnimationFrame(animate);
    window.addEventListener('scroll', () => { if (!scheduled) { scheduled = true; requestAnimationFrame(animate); } }, { passive: true });
    $('.hero').addEventListener('pointermove', e => { if (e.pointerType === 'mouse') photo.style.transform = `perspective(900px) rotateX(${(e.clientY / innerHeight - .5) * -6}deg) rotateY(${(e.clientX / innerWidth - .5) * 8}deg)`; });
    $('.hero').addEventListener('pointerleave', () => photo.style.transform = '');
  }
}

  return home();
}
