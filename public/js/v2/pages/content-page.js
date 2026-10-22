import { siteList } from '../site-content.js';
export default function contentPage({ app, path, language, esc }) {
  const page = siteList('pages').find(page => '/pages/' + page.slug === path && page.published);
  if (!page) { app.innerHTML = '<div class="container page"><h1>Page not found</h1></div>'; return; }
  const title = language === 'ar' ? page.title_ar || page.title_en : page.title_en;
  const body = language === 'ar' ? page.body_ar || page.body_en : page.body_en;
  document.title = title;
  app.innerHTML = `<article class="container page content-page"><h1>${esc(title)}</h1>${page.image ? `<img src="${esc(page.image)}" alt="${esc(title)}" class="content-page-image">` : ''}<div class="content-page-body">${body.split(/\n\s*\n/).map(paragraph => `<p>${esc(paragraph).replaceAll('\n','<br>')}</p>`).join('')}</div></article>`;
}
