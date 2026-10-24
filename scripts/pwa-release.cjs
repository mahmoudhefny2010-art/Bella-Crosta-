const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// Content-derived releases keep installed PWAs current without manual cache bumps.
function stamp(publicDir) {
  const worker = path.join(publicDir, 'sw.js');
  const version = /const VERSION = '[^']+';/;
  const source = fs.readFileSync(worker, 'utf8');
  if (!version.test(source)) throw new Error('PWA cache version declaration is missing.');
  const hash = crypto.createHash('sha256');
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      const filename = path.join(directory, entry.name);
      const relative = path.relative(publicDir, filename).split(path.sep).join('/');
      if (relative === 'uploads') continue;
      if (entry.isDirectory()) visit(filename);
      else if (entry.isFile()) {
        hash.update(relative + '\0');
        hash.update(filename === worker ? source.replace(version, "const VERSION = 'BUILD_VERSION';") : fs.readFileSync(filename));
        hash.update('\0');
      }
    }
  }
  visit(publicDir);
  const release = 'bella-release-' + hash.digest('hex').slice(0, 20);
  fs.writeFileSync(worker, source.replace(version, `const VERSION = '${release}';`));
  return release;
}
module.exports = { stamp };
