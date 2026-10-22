const assert = require('node:assert/strict');
const config = require('../server/db/knexfile').development;
const db = require('knex')(config);
async function run() {
  await db.migrate.latest();
  await require('../server/db/seeds/001_menu').seed(db);
  await require('../server/db/seeds/001_menu').seed(db);
  const products = await db('products');
  assert.equal(products.length, 9);
  const base = products.find(p => p.slug === 'margherita');
  assert.equal((await db('product_options').where({ product_id: base.id })).length, 4);
  const arabic = base.name_ar;
  assert.match(arabic, /مارغريتا/);
  for (const table of ['users', 'addresses', 'categories', 'products', 'product_options', 'orders', 'order_items', 'order_events', 'delivery_tokens', 'driver_locations', 'push_subscribers']) assert.ok(await db.schema.hasTable(table));
  await db('products').where({ id: base.id }).update({ price_egp: 301 });
  await db.migrate.latest();
  assert.equal((await db('products').where({ id: base.id }).first()).price_egp, 301);
  console.log('Fresh database: all migrations, nine products, idempotent options, Arabic, preserved admin edits PASS');
}
run().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => db.destroy());
