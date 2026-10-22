require('dotenv').config({ quiet: true });
const knex = require('knex');
const configs = require('../server/db/sqlserver-config');
const config = configs[process.env.NODE_ENV === 'production' ? 'production' : 'development'];
const name = process.env.SQLSERVER_DATABASE || 'bella_crosta';
async function main() {
  if (!/^[a-zA-Z][a-zA-Z0-9_]{0,127}$/.test(name)) throw new Error('Use a simple SQLSERVER_DATABASE name with letters, numbers and underscores.');
  const masterConnection = config.connection.connectionString
    ? { connectionString: config.connection.connectionString.replace(/Database=\{(?:[^}]|}})*\};/, 'Database={master};') }
    : { ...config.connection, database: 'master' };
  const master = knex({ ...config, connection: masterConnection });
  try { await master.raw('IF DB_ID(?) IS NULL CREATE DATABASE ??', [name, name]); }
  finally { await master.destroy(); }
  const db = knex(config);
  try {
    await db.migrate.latest();
    if (!await db('products').first('id')) await db.seed.run();
    console.log('[database] SQL Server ready: ' + name);
  } finally { await db.destroy(); }
}
main().catch(error => { console.error('[database]', error.code || error.name, error.message); process.exitCode = 1; });
