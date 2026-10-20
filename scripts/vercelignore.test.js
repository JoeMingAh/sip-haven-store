import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// .vercelignore keeps test files out of a deployment. It matters most in api/, where
// Vercel makes a function of every file: without it, api/checkout.test.js would be
// deployed as an endpoint of its own. The other half of the job is to catch nothing the
// app needs, so this walks the repo and checks every file against the patterns.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const patterns = readFileSync(path.join(ROOT, '.vercelignore'), 'utf8')
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line !== '' && !line.startsWith('#'));

// The patterns are written like .gitignore's. All of ours look like **/*.test.js, so a
// small conversion is enough: `**/` is any folders (or none), `*` is any run of
// characters inside one name. A pattern of another shape fails the test below that
// checks the shape, instead of being matched wrongly here.
const SUPPORTED_SHAPE = /^\*\*\/\*(\.[a-z]+)+$/;
function toRegExp(pattern) {
  const name = pattern.slice('**/'.length); // like *.test.js
  const nameSource = name.replace(/\./g, '\\.').replace('*', '[^/]*');
  return new RegExp(`^(?:.*/)?${nameSource}$`);
}
const matchers = patterns.map(toRegExp);
const isIgnored = (file) => matchers.some((matcher) => matcher.test(file));

const isTestFile = (file) => /\.test\.jsx?$/.test(file);

// Every file outside node_modules, dist and the like, as paths from the project root
// with forward slashes.
const SKIPPED = new Set(['node_modules', 'dist', '.git', '.vercel', '.superpowers']);
function filesIn(folder) {
  return readdirSync(path.join(ROOT, folder), { withFileTypes: true }).flatMap((entry) => {
    const relative = folder === '' ? entry.name : `${folder}/${entry.name}`;
    if (!entry.isDirectory()) return [relative];
    return SKIPPED.has(entry.name) ? [] : filesIn(relative);
  });
}
const files = filesIn('');

describe('.vercelignore', () => {
  it('lists the test file patterns', () => {
    expect(patterns).toEqual(
      expect.arrayContaining(['**/*.test.js', '**/*.test.jsx', '**/*.contract.test.js']),
    );
  });

  it.each(patterns)('only has patterns this check can read: %s', (pattern) => {
    expect(pattern).toMatch(SUPPORTED_SHAPE);
  });

  it('only ignores test files, by name: every pattern ends in .test.js or .test.jsx', () => {
    for (const pattern of patterns) expect(pattern).toMatch(/\.test\.jsx?$/);
  });

  it('sees the test files in api/, the ones that would become functions', () => {
    const inApi = files.filter((file) => file.startsWith('api/') && isTestFile(file));
    expect(inApi).toEqual(
      expect.arrayContaining(['api/checkout.test.js', 'api/webhook.test.js', 'api/subscribe.test.js']),
    );
  });

  it('ignores every test file in the repo', () => {
    const missed = files.filter((file) => isTestFile(file) && !isIgnored(file));
    expect(missed).toEqual([]);
  });

  it('ignores a contract test and a component test, wherever they are', () => {
    expect(isIgnored('src/cart/checkout.contract.test.js')).toBe(true);
    expect(isIgnored('src/components/CartDrawer.test.jsx')).toBe(true);
    expect(isIgnored('some/deep/folder/thing.test.js')).toBe(true);
    expect(isIgnored('top.test.js')).toBe(true);
  });

  it('ignores nothing else: not one file the app, its functions or its build needs', () => {
    const caught = files.filter((file) => !isTestFile(file) && isIgnored(file));
    expect(caught).toEqual([]);
  });

  it('keeps the functions, the shared code, the lineup and the build files', () => {
    for (const needed of [
      'api/checkout.js',
      'api/subscribe.js',
      'api/webhook.js',
      'lib/catalog.js',
      'lib/store-config.js',
      'src/main.jsx',
      'src/router.jsx',
      'src/data/lineup.json',
      'src/test/setup.js',
      'index.html',
      'package.json',
      'vite.config.js',
      'vercel.json',
    ]) {
      expect(files, needed).toContain(needed);
      expect(isIgnored(needed), needed).toBe(false);
    }
  });

  it('does not mistake a name that only contains "test" for a test file', () => {
    for (const kept of ['src/latest.js', 'src/test.js', 'src/contest.jsx', 'api/test-helper.js', 'src/data/test.json']) {
      expect(isIgnored(kept), kept).toBe(false);
    }
  });
});
