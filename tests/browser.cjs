require('dotenv').config({ quiet: true });
process.env.JWT_SECRET ||= require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../data/.dev-secret'), 'utf8');
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const db = require('../server/db');
const { signInToken } = require('../server/middleware/session');
let browser;
const ids = [];
const errors = [];
const base = process.env.TEST_URL || 'http://localhost:4000';
async function run() {
  browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  const roles = {};
  for (const role of ['customer', 'kitchen', 'driver', 'admin']) {
    const [user] = await db('users').insert({ name: 'Browser test', email: crypto.randomUUID() + '@example.invalid', role }).returning('*');
    ids.push(user.id); roles[role] = user;
  }
  fs.mkdirSync(path.join(__dirname, '../artifacts'), { recursive: true });
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await context.addCookies([{ name: 'bella_session', value: signInToken(roles.customer), url: base }]);
    for (const url of ['/', '/menu', '/builder', '/cart', '/checkout', '/orders', '/addresses', '/login']) {
      await page.goto(base + url);
      await page.waitForFunction(() => !document.querySelector('#app .loading'));
      assert.equal(await page.locator('#app .error').count(), 0, url);
      const overflows = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
      assert.equal(overflows, false, `${url} overflows at ${viewport.width}`);
    }
    await page.goto(base + '/menu');
    await page.locator('[data-add]').first().click();
    await page.goto(base + '/cart');
    await page.waitForSelector('[data-qty]');
    assert.equal(await page.locator('[data-qty]').count(), 2);
    await page.goto(base + '/checkout');
    await page.waitForSelector('#checkout-form');
    await page.locator('#customerName').fill('Browser customer');
    await page.locator('#address_line').fill('Test street, building 1');
    await page.locator('#phone').fill('01031252519');
    await page.locator('#place-order').click();
    await page.waitForURL('**/track?id=*');
    await page.waitForSelector('#cancel-order');
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#cancel-order').click();
    await page.waitForFunction(() => document.querySelector('#view .badge')?.textContent === 'Cancelled');
    await page.goto(base + '/menu');
    await page.waitForSelector('[data-add]');
    await page.locator('#language').click();
    await page.waitForFunction(() => document.documentElement.dir === 'rtl');
    await page.waitForSelector('[data-add]');
    assert.match(await page.locator('h1').innerText(), /القائمة/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
    await page.screenshot({ path: path.join(__dirname, `../artifacts/menu-ar-${viewport.width}.png`), fullPage: true });
    await page.locator('#language').click();
    await page.waitForFunction(() => document.documentElement.dir === 'ltr');
    await page.goto(base + '/'); await page.waitForSelector('.hero-pizza, .hero-photo');
    await page.screenshot({ path: path.join(__dirname, `../artifacts/home-${viewport.width}.png`), fullPage: true });
    for (const [role, url] of [['kitchen', '/kitchen'], ['driver', '/delivery'], ['admin', '/admin']]) {
      await context.addCookies([{ name: 'bella_session', value: signInToken(roles[role]), url: base }]);
      await page.goto(base + url); await page.waitForFunction(() => !document.querySelector('#app .loading'));
      assert.equal(await page.locator('#app .error').count(), 0, url);
      if (role === 'admin') for (const tab of ['staff', 'orders', 'sales']) { await page.locator(`[data-tab="${tab}"]`).click(); await page.waitForTimeout(300); }
    }
    const sw = await page.evaluate(async () => { const registration = await navigator.serviceWorker.ready; return Boolean(registration.active); });
    assert.ok(sw);
    await context.setOffline(true);
    await page.goto(base + '/menu');
    assert.match(await page.locator('h1').innerText(), /offline/i);
    await context.setOffline(false);
    await context.close();
    console.log(`Browser ${viewport.width}px: ordering, cancellation, all dashboards, RTL, offline PASS`);
  }
  assert.deepEqual(errors, [], 'Browser errors');
}
run().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => {
  await browser?.close();
  if (ids.length) { await db('orders').whereIn('user_id', ids).del(); await db('users').whereIn('id', ids).del(); }
  await db.destroy();
});
