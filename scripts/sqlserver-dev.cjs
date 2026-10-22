const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
require('dotenv').config({ quiet: true });
const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || 4000);
const secretPath = path.join(root, 'data', '.dev-secret');
fs.mkdirSync(path.dirname(secretPath), { recursive: true });
if (!fs.existsSync(secretPath)) fs.writeFileSync(secretPath, require('node:crypto').randomBytes(48).toString('hex'), { mode: 0o600 });
const env = { ...process.env, NODE_ENV: 'development', JWT_SECRET: process.env.JWT_SECRET || fs.readFileSync(secretPath, 'utf8') };
let child;
function run(args) {
  return new Promise((resolve, reject) => {
    child = spawn(process.execPath, args, { cwd: root, env, stdio: 'inherit', windowsHide: true });
    child.once('error', reject);
    child.once('exit', code => resolve(code ?? 1));
  });
}
async function main() {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(1500) });
    const health = await response.json();
    if (health.ok && health.database === 'mssql') { console.log('[database] SQL Server CONNECTED | Confirmed by the running app.'); console.log(`[dev] Already running at http://localhost:${port}`); return; }
    throw new Error('Another application is using the app port. Stop it before starting this project.');
  } catch (error) {
    if (error.message.startsWith('Another application')) throw error;
    if (!['ECONNREFUSED', 'UND_ERR_CONNECT_TIMEOUT'].includes(error.cause?.code) && error.name !== 'TimeoutError') throw error;
  }
  const code = await run(['scripts/setup-sqlserver.cjs']);
  if (code) { process.exitCode = code; return; }
  process.exitCode = await run(['--watch', '--watch-path=server', '--watch-path=.env', 'server/app.js']);
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  if (!child || child.exitCode !== null) return;
  if (process.platform === 'win32') spawn('taskkill.exe', ['/PID', String(child.pid), '/T'], { windowsHide: true, stdio: 'ignore' });
  else child.kill(signal);
});
main().catch(error => { console.error('[dev]', error.message); process.exitCode = 1; });
