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

// Our Story is approved, so it no longer carries the note. The other pages still do.
const DRAFT_PAGES = [
  'Contact.jsx',
  'ShippingReturns.jsx',
  'Privacy.jsx',
  'Learn.jsx',
  'Guide.jsx',
  'Success.jsx',
];
const NOTE = "{/* DRAFT COPY: needs Joseph's approval */}";

describe('draft copy note', () => {
  it.each(DRAFT_PAGES)('%s has the note once, ahead of its first heading', (name) => {
    const source = read(name);
    expect(source.split(NOTE)).toHaveLength(2);
    expect(source.indexOf(NOTE)).toBeLessThan(source.indexOf('<h1'));
  });

  it('OurStory.jsx has no draft-approval note', () => {
    const source = read('OurStory.jsx');
    expect(source).not.toContain(NOTE);
    expect(source).not.toContain('DRAFT COPY');
  });
});

describe('plain ASCII', () => {
  it.each([
    ...DRAFT_PAGES,
    'OurStory.jsx',
    '../data/guides.js',
    '../data/ourStory.js',
    '../../lib/our-story-html.js',
  ])('%s has no character outside ASCII', (name) => {
    // eslint-disable-next-line no-control-regex
    expect(read(name)).toMatch(/^[\x09\x0A\x0D\x20-\x7E]*$/);
  });
});
