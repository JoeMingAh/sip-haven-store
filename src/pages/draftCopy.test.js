import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The wording on these pages is drafted for Joseph to approve. Each page file starts
// its page with a note that says so, so the copy can be found and signed off, and
// none of them may hold a character outside plain ASCII (a curly quote or a long
// dash pasted in from a document is how stray characters get into the source).
const dir = path.dirname(fileURLToPath(import.meta.url));
const read = (name) => readFileSync(path.join(dir, name), 'utf8');

const PAGES = [
  'OurStory.jsx',
  'Contact.jsx',
  'ShippingReturns.jsx',
  'Privacy.jsx',
  'Learn.jsx',
  'Guide.jsx',
  'Success.jsx',
];
const NOTE = "{/* DRAFT COPY: needs Joseph's approval */}";

describe('draft copy note', () => {
  it.each(PAGES)('%s has the note once, ahead of its first heading', (name) => {
    const source = read(name);
    expect(source.split(NOTE)).toHaveLength(2);
    expect(source.indexOf(NOTE)).toBeLessThan(source.indexOf('<h1'));
  });
});

describe('plain ASCII', () => {
  it.each([...PAGES, '../data/guides.js'])('%s has no character outside ASCII', (name) => {
    // eslint-disable-next-line no-control-regex
    expect(read(name)).toMatch(/^[\x09\x0A\x0D\x20-\x7E]*$/);
  });
});
