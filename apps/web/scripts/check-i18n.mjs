// Checks that every t('key') used in the code exists in the dictionary, and that both languages are filled.
// Run: node scripts/check-i18n.mjs
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

// Collect dictionary keys by reading each locale file (they are plain `'key': ['en', 'bn']` objects).
const keys = new Map();
for (const f of ['common', 'tasks', 'detail', 'admin', 'settings']) {
  const src = read(`locales/${f}.ts`);
  for (const m of src.matchAll(/^\s*'([^']+)':\s*\[/gm)) keys.set(m[1], f);
}

// Find usages: t('x'), t("x"), t(`x`) with a static key; plus keys used as plain strings in lookup tables (label: 'x').
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.next', 'locales', 'scripts'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx|ts)$/.test(e.name)) files.push(p);
  }
})(root);

const used = new Set();
const missing = [];
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/\bt\(\s*['"`]([a-zA-Z0-9_.]+)['"`]/g)) used.add([m[1], f]);
  // keys stored in tables: 'nav.today', 'ad.r.tabDeleg', ...
  for (const m of src.matchAll(/['"]((?:nav|nw|mt|gv|dk|tl|td|ad|an|ac|c|pp|pe|pw|nt|login|prio|status|act|step|due|ago|f)\.[a-zA-Z0-9_.]+)['"]/g)) used.add([m[1], f]);
}
for (const [k, f] of used) if (!k.endsWith('.') && !keys.has(k)) missing.push(`${k}   (${path.relative(root, f)})`);

// Empty translations
const empties = [];
for (const f of ['common', 'tasks', 'detail', 'admin', 'settings']) {
  const src = read(`locales/${f}.ts`);
  for (const m of src.matchAll(/^\s*'([^']+)':\s*\[\s*(['"`])([\s\S]*?)\2\s*,\s*(['"`])([\s\S]*?)\4\s*\]/gm)) {
    if (!m[3].trim() || !m[5].trim()) empties.push(m[1]);
  }
}

console.log(`${keys.size} keys, ${new Set([...used].map((x) => x[0])).size} distinct keys referenced`);
if (missing.length) console.log('MISSING keys:\n  ' + [...new Set(missing)].join('\n  '));
if (empties.length) console.log('EMPTY translations:\n  ' + empties.join('\n  '));
if (!missing.length && !empties.length) console.log('OK: all keys exist and both languages are filled.');
process.exit(missing.length || empties.length ? 1 : 0);
