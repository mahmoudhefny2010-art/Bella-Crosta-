const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });
const windows = (process.env.SQLSERVER_AUTH || 'windows') === 'windows';
const production = process.env.NODE_ENV === 'production';
const quote = value => '{' + String(value).replace(/}/g, '}}') + '}';
const database = process.env.SQLSERVER_DATABASE || 'bella_crosta';
const server = process.env.SQLSERVER_SERVER || 'localhost';
const encrypt = process.env.SQLSERVER_ENCRYPT !== 'false';
const trust = process.env.SQLSERVER_TRUST_CERTIFICATE === 'true';
function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (!value || typeof value !== 'object' || value instanceof Date || Buffer.isBuffer(value)) return value;
  const result = {};
  for (let [key, field] of Object.entries(value)) {
    if (['ingredients', 'address_snapshot', 'options'].includes(key) && typeof field === 'string') field = JSON.parse(field);
    if ((key === 'id' || key.endsWith('_id')) && typeof field === 'string' && /^[0-9a-f-]{36}$/i.test(field)) field = field.toLowerCase();
    result[key] = normalize(field);
  }
  return result;
}
const connection = windows ? {
  connectionString: `Driver=${quote(process.env.SQLSERVER_ODBC_DRIVER || 'ODBC Driver 18 for SQL Server')};Server=${quote(server)};Database=${quote(database)};Trusted_Connection=yes;Encrypt=${encrypt ? 'yes' : 'no'};TrustServerCertificate=${trust ? 'yes' : 'no'};Connection Timeout=10;`
} : {
  server, database, user: process.env.SQLSERVER_USER, password: process.env.SQLSERVER_PASSWORD,
  port: Number(process.env.SQLSERVER_PORT || 1433),
  options: { encrypt, trustServerCertificate: trust, useUTC: true, ...(process.env.SQLSERVER_INSTANCE ? { instanceName: process.env.SQLSERVER_INSTANCE } : {}) }
};
const common = {
  client: windows ? require('./windows-client') : 'mssql', connection,
  pool: { min: 0, max: production ? 10 : 4 },
  acquireConnectionTimeout: 15000,
  migrations: { directory: path.join(__dirname, 'migrations'), tableName: 'knex_migrations' },
  seeds: { directory: path.join(__dirname, 'seeds') }, postProcessResponse: normalize
};
module.exports = { development: common, production: common };
