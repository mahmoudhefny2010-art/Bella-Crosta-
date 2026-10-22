import { siteValue } from '../site-content.js';
export function renderNapoliFeature({ tr, config, esc }) {
  return `<section class="napoli-section section"><div class="container split"><img class="assembly-photo" src="${esc(siteValue('asset.feature','/uploads/napoli-pizza.jpg'))}" alt="Pizza Napoli"><div><span class="eyebrow">${tr('The Neapolitan way')}</span><h2>${tr('Seven ingredients. One Napoli.')}</h2><p>${tr('A little char. A lot of character.')}</p><ol>${['Dough', 'Tomato sauce', 'Mozzarella', 'Anchovies', 'Capers', 'Oregano', 'Olive oil'].map(v => `<li>${tr(v)}</li>`).join('')}</ol><a class="button primary" href="/builder">${tr('Build your own')} ↗</a></div></div></section>`;
}
