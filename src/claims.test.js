import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The old site carried claims and names that the redesigned shop must not: invented
// figures and counts, stock-photo links, a store platform it does not use, a return
// window nobody has decided, and product names from the old lineup. This test reads
// the shop's own source files and fails if any of it comes back. Test files are
// skipped (this one has to name them), and so is dist, which is built from these
// files and is not there when the tests run.

// The old coffees were called Sipper's Whisper and Sipper's Murmur (slugs
// sippers-whisper and sippers-murmur). Only those names are banned: "whisper" and
// "murmur" on their own are ordinary words that real tea copy uses, as in "a whisper
// of jasmine".
const OLD_NAME = "sipper's whisper/murmur";
const OLD_SLUG = 'sippers-whisper/murmur';

// What is banned, and how each is matched. Every pattern is case-insensitive (or
// holds no letters) and global, so each hit is reported. The numbers are matched as
// whole numbers, so "112,400" is not a hit; "unsplash" and "shopify" are not part of
// any other word, so they match anywhere.
const BANNED = [
  { name: 'shopify', pattern: /shopify/gi },
  { name: '12,400', pattern: /(?<![\d,.])12,400(?!\d)/g },
  { name: '87+', pattern: /(?<![\d.,])87\+/g },
  { name: 'seven farms', pattern: /\bseven[\s-]+farms\b/gi },
  { name: 'unsplash', pattern: /unsplash/gi },
  { name: OLD_NAME, pattern: /sipper['’]?s[\s-]+(whisper|murmur)/gi },
  { name: OLD_SLUG, pattern: /sippers-(whisper|murmur)/gi },
  { name: '30-day', pattern: /(?<![\w-])30-day\b/gi },
];

// Every banned thing in `text`, as { name, line }.
function claimsIn(text) {
  return BANNED.flatMap(({ name, pattern }) =>
    [...text.matchAll(pattern)].map((match) => ({
      name,
      line: text.slice(0, match.index).split('\n').length,
    })),
  );
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Where the shop's own words and code live: the app, the code it shares with the
// functions, the Vercel functions (which write the order emails) and the page shell.
const FOLDERS = ['src', 'lib', 'api'];
const FILES = ['index.html'];
// Text only. A binary file read as text holds any characters by chance.
const TEXT_EXTENSIONS = new Set(['.js', '.jsx', '.json', '.css', '.html', '.svg']);
const SKIPPED_FOLDERS = new Set(['node_modules', 'dist']);
const isTestFile = (name) => /\.test\.[^.]+$/.test(name);

// The files to read in `folder`, as paths from the project root with forward slashes.
function sourceFiles(folder) {
  return readdirSync(path.join(ROOT, folder), { withFileTypes: true }).flatMap((entry) => {
    const relative = `${folder}/${entry.name}`;
    if (entry.isDirectory()) return SKIPPED_FOLDERS.has(entry.name) ? [] : sourceFiles(relative);
    const wanted =
      TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) && !isTestFile(entry.name);
    return wanted ? [relative] : [];
  });
}

const files = [...FOLDERS.flatMap(sourceFiles), ...FILES];
const read = (relative) => readFileSync(path.join(ROOT, relative), 'utf8');

describe('the matcher', () => {
  it.each([
    ['shopify', 'Powered by Shopify'],
    ['shopify', 'https://cdn.shopify.com/s/files/1/0001/logo.png'],
    ['12,400', 'Loved by 12,400 customers'],
    ['12,400', 'Loved by $12,400+ customers'],
    ['87+', 'Over 87+ blends'],
    ['seven farms', 'Sourced from seven farms'],
    ['seven farms', 'Sourced from Seven\n      Farms'],
    ['seven farms', 'the seven-farms promise'],
    ['unsplash', 'https://images.unsplash.com/photo-1'],
    [OLD_NAME, "Sipper's Whisper Espresso Blend"],
    [OLD_NAME, 'Sipper’s Murmur: Swiss Water Decaf'],
    [OLD_NAME, 'SIPPERS MURMUR'],
    [OLD_NAME, "Sipper's\n      Whisper"],
    [OLD_SLUG, 'sippers-whisper'],
    [OLD_SLUG, '/products/sippers-murmur'],
    ['30-day', 'Easy 30-day returns'],
    ['30-day', 'A 30-Day guarantee'],
  ])('flags %s in %j', (name, text) => {
    expect(claimsIn(text).map((claim) => claim.name)).toContain(name);
  });

  it.each([
    [OLD_NAME, 'a whisper of jasmine'],
    [OLD_NAME, 'A murmur of honey and a whisper of mint.'],
    [OLD_NAME, 'Whisper-thin leaves, murmur-soft steam'],
    [OLD_NAME, 'whispers of jasmine, whispered softly, a whispering breeze'],
    [OLD_NAME, 'murmurs and a murmuring stream'],
    [OLD_SLUG, 'a-whisper-of-jasmine, murmur-of-honey, not-sippers, sippers-choice'],
    ['12,400', 'a total of 112,400, or 12,4000, or 1,12,400'],
    ['87+', 'room 187+, or 0.87+, or 1,87+'],
    ['seven farms', 'seven farmers, seven farmhouses, seven farm stands'],
    ['30-day', 'a 130-day trek, or the x30-day plan'],
    ['shopify', 'Shop for tea, shop-it, shoppy'],
  ])('does not flag %s in ordinary words, or inside other words or numbers: %j', (name, text) => {
    expect(claimsIn(text).map((claim) => claim.name)).not.toContain(name);
  });

  it('flags nothing in ordinary shop copy', () => {
    const copy = [
      'Free shipping on orders of $50 or more',
      'Tea and coffee for slow mornings and long talks.',
      'A floral green tea scented with jasmine blossoms.',
      'Just a whisper of jasmine, and a murmur of honey on the finish.',
      'Contact us if anything arrives damaged and we will make it right.',
    ].join('\n');
    expect(claimsIn(copy)).toEqual([]);
  });

  it('says which line each hit is on, and finds every hit', () => {
    const text = 'clean\nfrom Shopify\nclean\nunsplash and shopify';
    expect(claimsIn(text)).toEqual(
      expect.arrayContaining([
        { name: 'shopify', line: 2 },
        { name: 'shopify', line: 4 },
        { name: 'unsplash', line: 4 },
      ]),
    );
    expect(claimsIn(text)).toHaveLength(3);
  });
});

describe('the shop source', () => {
  it('reads the pages, the shared code, the functions and index.html, but no test files', () => {
    expect(files).toEqual(
      expect.arrayContaining([
        'src/pages/Home.jsx',
        'src/router.jsx',
        'src/index.css',
        'src/data/lineup.json',
        'lib/catalog.js',
        'api/checkout.js',
        'index.html',
      ]),
    );
    expect(files.filter((file) => /\.test\./.test(file))).toEqual([]);
    expect(files).not.toContain('src/claims.test.js');
  });

  it('carries none of the claims or names from the old site', () => {
    const found = files.flatMap((file) =>
      claimsIn(read(file)).map(({ name, line }) => `${file}:${line} has "${name}"`),
    );
    expect(found).toEqual([]);
  });
});
