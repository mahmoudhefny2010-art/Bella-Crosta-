export function renderBrandStrip({ tr }) {
  const words = `<span>${tr('Bella Crosta')}</span><span class="ticker-divider" aria-hidden="true">·</span><span>${tr('Napoli soul')}</span><span class="ticker-divider" aria-hidden="true">·</span><span>${tr('Egyptian heart')}</span><span class="ticker-divider" aria-hidden="true">·</span>`;
  return `<div class="ticker"><div class="ticker-viewport" lang="en" dir="ltr"><div class="ticker-inner"><div class="ticker-group">${words}</div><div class="ticker-group" aria-hidden="true">${words}</div></div></div></div>`;
}
