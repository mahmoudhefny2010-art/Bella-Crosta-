const {now:databaseNow}=require('../db/dialect');
const { z } = require('zod');
const fs = require('node:fs/promises');
const path = require('node:path');
const upsert = require('../db/upsert');
const { fail } = require('./workflow');
const fields = [];
const field = (key, group, label, type, en, ar = '', source) => fields.push({ key, group, label, type, default: { en: String(en), ar: String(ar || en) }, ...(source ? { source } : {}) });
const phrase = (key, group, label, source) => field(key, group, label, 'text', source, '', source);
phrase('header.home', 'Header', 'Home label', 'Home');
phrase('header.menu', 'Header', 'Menu label', 'Menu');
phrase('header.builder', 'Header', 'Builder label', 'Build your own');
phrase('header.orders', 'Header', 'Orders label', 'Orders');
phrase('header.addresses', 'Header', 'Addresses label', 'Addresses');
for (const item of ['home', 'menu', 'builder', 'orders', 'addresses']) field(`header.show_${item}`, 'Header', `Show ${item} link`, 'boolean', 'true');
field('header.extra_links', 'Header', 'Extra navigation links', 'navigation', '[]');
for (const [key, label, text] of [
  ['eyebrow', 'Eyebrow', 'From Naples, with love'], ['title', 'Title', 'THE PERFECT'], ['title_second', 'Second title line', 'SLICE'],
  ['description', 'Description', 'Good dough. Great company.'], ['tagline', 'Tagline', 'French Passion. Egyptian Heart. Italian Crust.'],
  ['cta', 'Order button', 'Order your pizza'], ['fact_size', 'Pizza size', '32 cm · Neapolitan crust'], ['fact_order', 'Order fact', 'Made to order'], ['fact_place', 'Location fact', 'Handcrafted in Egypt']
]) phrase(`hero.${key}`, 'Hero', label, text);
field('hero.order_link', 'Hero', 'Order button link', 'link', '/menu');
field('hero.builder_link', 'Hero', 'Builder button link', 'link', '/builder');
field('hero.image_alt', 'Hero', 'Pizza image description', 'text', 'Margherita Neapolitan pizza');
field('hero.stamp', 'Hero', 'Pizza stamp', 'text', '32 CM · NAPOLI');
for (const [key, source] of [['featured_eyebrow','Our signatures'],['featured_title','Meet your next favourite'],['featured_button','View full menu'],['feature_eyebrow','The Neapolitan way'],['feature_title','Seven ingredients. One Napoli.'],['feature_body','A little char. A lot of character.'],['ticker_brand','Bella Crosta'],['ticker_soul','Napoli soul'],['ticker_heart','Egyptian heart']]) phrase(`home.${key}`, 'Home sections', key.replaceAll('_', ' '), source);
for (const name of ['hero','ticker','featured','napoli']) field(`section.${name}`, 'Home sections', `Show ${name} section`, 'boolean', 'true');
field('footer.tagline', 'Footer', 'Tagline', 'text', 'French Passion. Egyptian Heart. Italian Crust.', 'شغف فرنسي. قلب مصري. عجينة إيطالية.');
field('footer.phone', 'Footer', 'Phone', 'phone', '+20 103 125 2519');
field('footer.copyright', 'Footer', 'Copyright', 'text', '© 2026 Bella Crosta');
field('footer.credit_label', 'Footer', 'Credits label', 'text', 'Designed & developed by');
field('footer.credit_one', 'Footer', 'First credit', 'text', 'Mahmoud Mohamed Hefny');
field('footer.credit_one_link', 'Footer', 'First credit link', 'link', 'https://www.linkedin.com/in/mahmoud-hefny-1264763b0');
field('footer.credit_two', 'Footer', 'Second credit', 'text', 'Rozan Tarek Kotb');
field('footer.credit_two_link', 'Footer', 'Second credit link', 'link', 'https://www.linkedin.com/in/rozan-tarek/');
field('footer.show_credits', 'Footer', 'Show credits', 'boolean', 'true');
field('footer.links', 'Footer', 'Footer links', 'links', '[]');
field('asset.logo', 'Images', 'Brand logo', 'image', '/assets/logo.png');
field('asset.hero', 'Images', 'Hero pizza', 'image', '/assets/hero-margherita-v2.png');
field('asset.feature', 'Images', 'Neapolitan pizza', 'image', '/uploads/napoli-pizza.jpg');
for (const [id, title, subtitle = ''] of [['menu','Menu','Made fresh, just for you.'],['builder','Design your pizza','Choose a sauce and toppings. Prices update as you go.'],['cart','Your bag'],['checkout','Checkout','Just a few details, then we fire up the oven.'],['orders','My orders'],['track','Track your order'],['addresses','Saved addresses'],['login','Sign in','Place orders and keep your favourites close.']]) {
  field(`page.${id}.title`, 'Pages', `${id} page title`, 'text', title);
  field(`page.${id}.subtitle`, 'Pages', `${id} page introduction`, 'text', subtitle);
}
field('pages', 'Pages', 'Custom pages', 'pages', '[]');
field('site.title', 'Settings', 'Browser title', 'text', 'Bella Crosta · Neapolitan Pizza');
field('site.description', 'Settings', 'Search description', 'text', 'Bella Crosta. French Passion. Egyptian Heart. Italian Crust. Fresh Neapolitan pizza, delivered in Egypt.');
field('site.name', 'Settings', 'Restaurant name', 'text', 'Bella Crosta');
field('site.loading', 'Settings', 'Loading message', 'text', 'Firing up the oven…', 'جاري تجهيز الفرن…');
field('business.delivery_fee', 'Settings', 'Delivery fee (EGP)', 'number', process.env.DELIVERY_FEE_EGP || '35');
field('business.accept_orders', 'Settings', 'Accept new orders', 'boolean', 'true');
field('business.closed_message', 'Settings', 'Ordering paused message', 'text', 'Online ordering is temporarily paused. Please try again later.', 'الطلبات متوقفة مؤقتًا، حاول مرة أخرى لاحقًا.');
const byKey = new Map(fields.map(item => [item.key, item]));
const imagePath = value => require('./media').validImage(value);
const legacyImagePath = value => /^\/(?:assets|uploads)\/[a-zA-Z0-9_/.-]+\.(?:png|jpg|jpeg|webp|avif|gif|svg)$/i.test(value) && !value.split('/').includes('..');
const safeLink = value => {
  if (/^\/(?!\/)[a-zA-Z0-9_/?=&%#.-]*$/.test(value) && !/%(?:2f|5c|0[ad])/i.test(value) && !value.split('/').includes('..')) return true;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
};
const linkSchema = z.object({ label_en: z.string().trim().min(1).max(80), label_ar: z.string().max(100), href: z.string().max(300).refine(safeLink), visible: z.boolean().default(true) }).strict();
const navigationSchema = linkSchema.refine(link => /^\/(?!\/)/.test(link.href) && !/^\/(?:admin|owner|api|auth)(?:[/?#]|$)/.test(link.href), 'Navigation links must point to a public website page.');
const pageSchema = z.object({ slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(60), title_en: z.string().trim().min(1).max(120), title_ar: z.string().max(160), body_en: z.string().max(12000), body_ar: z.string().max(12000), image: z.string().refine(value => !value || imagePath(value)), published: z.boolean() }).strict();
const listSchemas = { navigation: z.array(navigationSchema).max(12), links: z.array(linkSchema).max(12), pages: z.array(pageSchema).max(12).refine(pages => new Set(pages.map(page => page.slug)).size === pages.length, 'Page slugs must be unique.') };
const entriesSchema = z.array(z.object({ key: z.string().refine(key => byKey.has(key), 'Unknown website setting.'), en: z.string().max(400000), ar: z.string().max(400000) }).strict()).max(fields.length).superRefine((entries, ctx) => {
  const seen = new Set();
  entries.forEach((entry, index) => {
    if (seen.has(entry.key)) ctx.addIssue({ code: 'custom', path: [index, 'key'], message: 'Duplicate setting.' }); seen.add(entry.key);
    const type = byKey.get(entry.key)?.type;
    for (const language of ['en', 'ar']) {
      const value = entry[language]; let valid = true;
      if (type === 'image') valid = imagePath(value);
      else if (type === 'link') valid = safeLink(value);
      else if (type === 'boolean') valid = ['true', 'false'].includes(value);
      else if (type === 'number') valid = /^(?:0|[1-9]\d{0,4})$/.test(value) && Number(value) <= 10000;
      else if (type === 'phone') valid = /^\+?[\d ()-]{5,32}$/.test(value);
      else if (listSchemas[type]) { try { listSchemas[type].parse(JSON.parse(value)); } catch { valid = false; } }
      else valid = value.length <= 2000;
      if (!valid) ctx.addIssue({ code: 'custom', path: [index, language], message: `Invalid ${byKey.get(entry.key)?.label || 'setting'}.` });
    }
    if (type !== 'text' && entry.en !== entry.ar) ctx.addIssue({ code: 'custom', path: [index, 'ar'], message: 'Shared settings must have the same value in both languages.' });
  });
});
const copySchema = z.array(z.object({ source: z.string().trim().min(1).max(400), en: z.string().max(3000), ar: z.string().max(3000) }).strict()).max(200).refine(entries => new Set(entries.map(entry => entry.source.toLowerCase())).size === entries.length, 'Source phrases must be unique.');
function missingTable(error) { return Number(error.number || error.code || error.errors?.[0]?.code) === 208; }
async function read(db) {
  let rows, copies;
  try { [rows, copies] = await Promise.all([db('site_settings').select('setting_key','value_en','value_ar'), db('site_copy').select('source_text','value_en','value_ar')]); }
  catch (error) { if (!missingTable(error)) throw error; rows = []; copies = []; }
  const settings = Object.fromEntries(fields.map(item => [item.key, { ...item.default }]));
  for (const row of rows) if (byKey.has(row.setting_key)) settings[row.setting_key] = { en: row.value_en, ar: row.value_ar };
  return { settings, customized: rows.filter(row => byKey.has(row.setting_key)).map(row => row.setting_key), copy: Object.fromEntries(copies.map(row => [row.source_text, { en: row.value_en, ar: row.value_ar }])) };
}
function publicData(data) {
  const settings = { ...data.settings };
  const published = listSchemas.pages.parse(JSON.parse(settings.pages.en)).filter(page => page.published);
  settings.pages = { en: JSON.stringify(published), ar: JSON.stringify(published) };
  return { ...data, settings, catalog: fields };
}
async function save(db, entries) {
  entries = entriesSchema.parse(entries);
  const images = [];
  for (const entry of entries) {
    if (byKey.get(entry.key).type === 'image') images.push(entry.en);
    if (entry.key === 'pages') images.push(...JSON.parse(entry.en).map(page => page.image).filter(Boolean));
  }
  for (const url of images) {
    if(require('./media').cloudImage(url))continue;
    try { if (!(await fs.stat(path.join(__dirname, '../../public', url))).isFile()) fail('Image not found. Upload an image first.'); }
    catch { fail('Image not found. Upload an image first.'); }
  }
  await db.transaction(async trx => {
    for (const entry of entries) await upsert(trx, 'site_settings', { setting_key: entry.key }, { value_en: entry.en, value_ar: entry.ar }, { value_en: entry.en, value_ar: entry.ar, updated_at: databaseNow(trx) });
  });
  return read(db);
}
async function operational(db) {
  let rows = [];
  try { rows = await db('site_settings').whereIn('setting_key', ['business.delivery_fee','business.accept_orders','business.closed_message']).select('setting_key','value_en'); }
  catch (error) { if (!missingTable(error)) throw error; }
  const values = Object.fromEntries(rows.map(row => [row.setting_key, row.value_en]));
  return { deliveryFee: Number(values['business.delivery_fee'] ?? process.env.DELIVERY_FEE_EGP ?? 35), acceptOrders: values['business.accept_orders'] !== 'false', closedMessage: values['business.closed_message'] || 'Online ordering is temporarily paused. Please try again later.' };
}
module.exports = { fields, read, publicData, save, entriesSchema, copySchema, operational, safeLink, imagePath };
