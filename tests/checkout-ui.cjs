require('dotenv').config({ quiet: true });
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
process.env.JWT_SECRET ||= fs.readFileSync(path.resolve(__dirname, '../data/.dev-secret'), 'utf8');
const db = require('../server/db');
const { signInToken } = require('../server/middleware/session');
const base = 'http://localhost:4000';
let browser, user;
async function run() {
  const [record] = await db('users').insert({ name: 'Checkout Preview', email: crypto.randomUUID() + '@example.invalid', role: 'customer' }).returning('*');
  user = record;
  const product = await db('products').where({ slug: 'margherita' }).first();
  const [address] = await db('addresses').insert({ user_id: user.id, label: 'Home', address_line: 'Test street, building 4', landmark: 'Test landmark', floor: '2', apartment: '3', phone: '01031252519', latitude: 30.228, longitude: 31.48, is_default: true }).returning('*');
  browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const errors = [];
  fs.mkdirSync(path.resolve(__dirname, '../artifacts'), { recursive: true });
  for (const [width, language, theme] of [[1440, 'en', 'light'], [390, 'ar', 'light'], [390, 'en', 'dark']]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    await context.addCookies([{ name: 'bella_session', value: signInToken(user), url: base }]);
    await context.addInitScript(({ id, language, theme }) => {
      if (!localStorage.getItem('checkout_test_seeded')) {
        localStorage.setItem('bella_cart_v2', JSON.stringify([{ key: id + '::false', productId: id, quantity: 2, optionIds: [], custom: false }]));
        localStorage.setItem('bella_language', language);
        localStorage.setItem('bella_theme', theme);
        localStorage.setItem('checkout_test_seeded', 'true');
      }
    }, { id: product.id, language, theme });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + '/checkout');
    await page.waitForSelector('#place-order');
    assert.equal(await page.locator('#saved-address').inputValue(), address.id);
    assert.equal(await page.locator('#new-address').isVisible(), false);
    assert.match(await page.locator('#saved-address-preview').innerText(), /Test street/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
    await page.screenshot({ path: path.resolve(__dirname, `../artifacts/checkout-${width}-${language}-${theme}-saved.png`), fullPage: true });
    await page.locator('#saved-address').selectOption('');
    assert.equal(await page.locator('#new-address').isVisible(), true);
    await page.locator('#address_line').fill('New test street, building 8');
    await page.locator('#phone').fill('01031252519');
    assert.equal(await page.locator('#phone').evaluate(el => el.checkValidity()), true);
    await page.locator('#save-address').check();
    await page.locator('#label').fill('New address test');
    await page.screenshot({ path: path.resolve(__dirname, `../artifacts/checkout-${width}-${language}-${theme}-new.png`), fullPage: true });
    await page.locator('#place-order').click();
    await page.waitForURL('**/track?id=*');
    await page.waitForSelector('#cancel-order');
    const order = await db('orders').where({ user_id: user.id }).orderBy('created_at', 'desc').first();
    assert.equal(order.total_egp, 600 + Number(process.env.DELIVERY_FEE_EGP || 35));
    assert.ok(order.address_id);
    assert.equal(order.address_snapshot.address_line, 'New test street, building 8');
    await context.close();
    console.log(`Checkout ${width}px ${language}/${theme}: saved/new address, validation, total and order submission PASS`);
  }
  assert.deepEqual(errors, []);
}
run().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => {
  await browser?.close();
  if (user) { await db('orders').where({ user_id: user.id }).del(); await db('users').where({ id: user.id }).del(); }
  await db.destroy();
});
