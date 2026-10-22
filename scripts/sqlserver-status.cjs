require('dotenv').config({ quiet: true });
const db = require('../server/db');
async function main() {
  const [connection] = await db.raw('SELECT DB_NAME() AS database_name');
  console.log(`[database] SQL Server CONNECTED | Database: ${connection.database_name}`);
}
main().catch(() => {
  console.error('[database] SQL Server NOT CONNECTED | Check the SQL Server service, Windows permissions and .env settings.');
  process.exitCode = 1;
}).finally(() => db.destroy());
