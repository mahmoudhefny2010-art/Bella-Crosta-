require('dotenv').config({ quiet: true });
const { z } = require('zod');
const db = require('../server/db');
const upsert = require('../server/db/upsert');
async function main() {
  const email = z.email().parse(process.argv[2]).toLowerCase();
  const name = process.argv[3] || 'Bella Crosta Admin';
  const user = await upsert(db, 'users', { email }, { email, name, role: 'admin' }, { role: 'admin', is_active: true });
  await upsert(db, 'user_roles', { user_id: user.id, role: 'admin' }, { user_id: user.id, role: 'admin' });
  console.log('Administrator provisioned. Sign in with this Google email.');
}
main().catch(e => { console.error('Admin setup failed:', e.code || e.name); process.exitCode = 1; }).finally(() => db.destroy());
