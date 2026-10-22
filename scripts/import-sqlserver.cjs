// Import a private, consistent project export into an EMPTY SQL Server database.
const fs = require('node:fs');
const path = require('node:path');
const knex = require('knex');
const config = require('../server/db/sqlserver-config');
const db = knex(config[process.env.NODE_ENV === 'production' ? 'production' : 'development']);
const tables = ['categories', 'products', 'product_options', 'users', 'addresses', 'orders', 'order_items', 'order_events', 'delivery_tokens', 'driver_locations', 'push_subscribers'];
const jsonFields = new Set(['ingredients', 'address_snapshot', 'options']);
const dateFields = new Set(['created_at', 'updated_at', 'expires_at', 'used_at', 'recorded_at']);
function comparable(value, key = '') {
  if (value === null || value === undefined) return value;
  if (dateFields.has(key)) return new Date(value).toISOString();
  if (['latitude', 'longitude'].includes(key)) return Number(value);
  if (Array.isArray(value)) return value.map(item => comparable(item));
  if (typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, comparable(value[k], k)]));
  if ((key === 'id' || key.endsWith('_id')) && typeof value === 'string') return value.toLowerCase();
  return value;
}
async function main() {
  const filename = process.argv[2] || fs.readFileSync(path.resolve(__dirname, '../data/backups/latest-export-path.txt'), 'utf8').trim();
  const backup = JSON.parse(fs.readFileSync(filename, 'utf8'));
  if (backup.format !== 'bella-crosta-export-v1' || !tables.every(table => Array.isArray(backup.tables[table]))) throw new Error('Invalid project export.');
  await db.migrate.latest();
  await db.transaction(async trx => {
    for (const table of tables) if (await trx(table).first()) throw new Error('Import requires an empty target: ' + table);
    for (const table of tables) {
      const rows = backup.tables[table];
      if (table === 'driver_locations' && rows.length) await trx.raw('SET IDENTITY_INSERT driver_locations ON');
      for (const source of rows) {
        const row = Object.fromEntries(Object.entries(source).map(([key, value]) => [key,
          value !== null && jsonFields.has(key) ? JSON.stringify(value) : value !== null && dateFields.has(key) ? new Date(value) : value
        ]));
        await trx(table).insert(row);
      }
      if (table === 'driver_locations' && rows.length) await trx.raw('SET IDENTITY_INSERT driver_locations OFF');
      const imported = await trx(table).select('*');
      if (imported.length !== rows.length) throw new Error('Row count mismatch: ' + table);
      const byId = new Map(imported.map(row => [String(row.id).toLowerCase(), row]));
      for (const source of rows) {
        const target = byId.get(String(source.id).toLowerCase());
        if (!target || JSON.stringify(comparable(source)) !== JSON.stringify(comparable(target))) throw new Error('Data mismatch: ' + table);
      }
      console.log(table + ': ' + rows.length + ' rows preserved');
    }
  });
  console.log('SQL Server import committed. All exported fields and row counts match.');
}
main().catch(error => { console.error('Import stopped:', error.message); process.exitCode = 1; }).finally(() => db.destroy());
