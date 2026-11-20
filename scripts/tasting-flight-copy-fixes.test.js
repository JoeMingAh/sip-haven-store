import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { emails, hero, valueModule } from '../src/content/tastingFlight.js';

// Joe's Oct 29 copy fixes for the Tasting Flight (docs/tasting-flight-spec.md). The
// lines he removed must never come back anywhere in src/, emails/ or lib/, and the
// lines that replaced them must be there. This file sits in scripts/ so the removed
// phrases it lists are not themselves inside the folders it scans.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCANNED = ['src', 'emails', 'lib'];

const REMOVED = [
  'L-theanine',
  'Almost everyone',
  'Most Tasting Flight members',
  'five times',
  'Five middlemen',
  'year and a half',
  '15+ infusions per tin',
  '45+ Cups of Ritual',
  '45+ layered cups',
  '$0.93 per infusion',
  '11–12 infusions',
];

function filesUnder(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? filesUnder(full) : [full];
  });
}

const files = SCANNED.flatMap((dir) => filesUnder(path.join(ROOT, dir))).map((file) => ({
  file: path.relative(ROOT, file),
  text: readFileSync(file, 'utf8'),
}));

const sequence = readFileSync(path.join(ROOT, 'emails/tasting-flight-sequence.md'), 'utf8');
const emailText = emails.map((email) => `${email.subject}\n${email.preview}\n${email.body}`).join('\n');

describe('the removed Tasting Flight copy', () => {
  it.each(REMOVED)('"%s" is nowhere in src/, emails/ or lib/', (phrase) => {
    const needle = phrase.toLowerCase();
    const hits = files.filter(({ text }) => text.toLowerCase().includes(needle)).map(({ file }) => file);
    expect(hits).toEqual([]);
  });
});

describe('the replacement Tasting Flight copy', () => {
  it('has the new hero spec and table row on the page', () => {
    expect(hero.specs.map((spec) => `${spec.title} — ${spec.detail}`)).toContain(
      '48 Cups of Ritual — 12 infusions per sample tin via traditional three-steep progression',
    );
    expect(valueModule.table.rows.at(-1)).toEqual([
      'Yield per Tasting Flight',
      '12–15 flat cups',
      '48 layered cups ($0.88 per infusion)',
    ]);
  });

  it.each([
    'As you work through the Sommelier’s Steep Journal, you’ll notice the four harvests divide into three distinct profiles:',
    'and bright, unhurried clarity for morning work.',
    'You can apply it directly toward The Connoisseur’s Reserve Bundle',
    'it has often changed hands across multiple brokers and spent months sitting in transit and storage.',
    'Multiple brokers, months in transit, and a better way.',
  ])('has the new email line in the content module and the email pack: %s', (line) => {
    expect(emailText).toContain(line);
    expect(sequence).toContain(line);
  });
});
