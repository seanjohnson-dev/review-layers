// Inlines every real text the film draws: the mod's own source, the demo project's code,
// and the captured runs. Nothing on screen is written by hand.
import fs from 'node:fs';
import path from 'node:path';
const here = path.dirname(new URL(import.meta.url).pathname);
const read = (p) => fs.readFileSync(p, 'utf8');
const cap = (n) => read(path.join(here, 'capture', n)).replace(/\r/g, '');
const demo = path.join(here, '..', '..', 'land-demo');
const data = {
  register: read(path.join(here, '..', 'hooks', 'register.tsx')),
  pluginJson: read(path.join(here, '..', '.claude-plugin', 'plugin.json')),
  cart: read(path.join(demo, 'src', 'cart.js')),
  checkout: read(path.join(demo, 'src', 'checkout.js')),
  cartTest: read(path.join(demo, 'test', 'cart.test.js')),
  reviewMd: read(path.join(demo, 'REVIEW.md')),
  gitLog: '7b1e3a2 (origin/main, main) tillpoint: cart totals and checkout\naa4a756 (HEAD -> feature/bulk-discount) bulk discount for carts of ten units or more',
  featureDiff: cap('00-feature.diff'),
  red: cap('01-red.txt'),
  fixDiff: cap('02-fix.diff'),
  tests: cap('03-tests.txt'),
  green: cap('04-green.txt'),
  pushDenied: cap('05-push-denied.txt'),
  approve: cap('06-approve.txt'),
  push: cap('07-push.txt'),
};
// the real hashes, from the demo repo
try {
  const { execSync } = await import('node:child_process');
  data.gitLog = execSync('git log --oneline --decorate -3', { cwd: demo }).toString().trim();
} catch {}
fs.writeFileSync(path.join(here, 'data.js'), 'window.DATA = ' + JSON.stringify(data) + ';\n');
console.log('data.js written:', Object.keys(data).map((k) => `${k} ${data[k].length}`).join(', '));
