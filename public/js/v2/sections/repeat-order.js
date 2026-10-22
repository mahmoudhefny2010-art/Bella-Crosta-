function usableItems(ctx, result) {
  return (result?.items || []).filter(line => {
    const product = ctx.products.find(item => String(item.id).toLowerCase() === String(line.productId).toLowerCase());
    return product && Array.isArray(line.optionIds) && line.optionIds.every(id => product.options.some(option => String(option.id).toLowerCase() === String(id).toLowerCase()));
  });
}

export async function loadRepeatOrder(ctx) {
  if (!ctx.user) return null;
  try { return await ctx.api('/api/orders/reorder'); }
  catch (error) { console.warn('Could not load repeat-order recommendation.', error); return null; }
}

export function renderRepeatOrder(ctx, result) {
  const items = usableItems(ctx, result);
  if (!items.length) return '';
  const arabic = ctx.language === 'ar';
  const title = arabic ? '\u0622\u062e\u0631 \u0637\u0644\u0628 \u0627\u0633\u062a\u0644\u0645\u062a\u0647' : 'Your last delivered order';
  const subtitle = arabic ? '\u0645\u0646 \u0633\u062c\u0644 \u0637\u0644\u0628\u0627\u062a\u0643' : 'Ready to order your favourites again?';
  const button = arabic ? '\u0627\u0637\u0644\u0628\u0647 \u062a\u0627\u0646\u064a' : 'Order it again';
  const receipt = result.order?.receiptNumber ? `<span class="repeat-order-receipt">#${ctx.esc(result.order.receiptNumber)}</span>` : '';
  const lines = items.map(line => {
    const product = ctx.products.find(item => String(item.id).toLowerCase() === String(line.productId).toLowerCase());
    const options = line.optionIds.map(id => product.options.find(option => String(option.id).toLowerCase() === String(id).toLowerCase())).filter(Boolean);
    const details = options.length ? `<small>${options.map(option => ctx.esc(ctx.local(option, 'name'))).join(', ')}</small>` : '';
    return `<li><span>${ctx.esc(line.quantity)} &times; ${ctx.esc(ctx.local(product, 'name'))}${line.custom ? ` <small>(${ctx.tr('Custom pizza')})</small>` : ''}</span>${details}</li>`;
  }).join('');
  return `<section class="repeat-order panel" aria-label="${ctx.esc(title)}"><div class="repeat-order-copy"><div class="repeat-order-heading"><div><span class="eyebrow">${ctx.esc(subtitle)}</span><h2>${ctx.esc(title)}</h2></div>${receipt}</div><ul class="repeat-order-items">${lines}</ul></div><button type="button" class="button primary repeat-order-action" data-repeat-order>${ctx.esc(button)}</button></section>`;
}

export function bindRepeatOrder(ctx, result) {
  const button = document.querySelector('[data-repeat-order]');
  const items = usableItems(ctx, result);
  if (button && items.length) button.addEventListener('click', () => ctx.addMany(items));
}
