import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { claims, emails, hero, lineup, topBar, valueModule } from './tastingFlight.js';

// The copy is Joe's locked copy, word for word. Each piece is rebuilt in the shape the
// spec writes it in and must be found in docs/tasting-flight-spec.md as it is.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const spec = readFileSync(path.join(ROOT, 'docs/tasting-flight-spec.md'), 'utf8');
const sequence = readFileSync(path.join(ROOT, 'emails/tasting-flight-sequence.md'), 'utf8');

const specLines = [
  `Top Bar: ${topBar.items.join(' • ')}`,
  `Eyebrow: ${hero.eyebrow}`,
  `Headline: ${hero.headline}`,
  `Subheadline: ${hero.subheadline}`,
  hero.specsTitle,
  ...hero.specs.map((item) => `${item.title} — ${item.detail}`),
  `Primary CTA: ${hero.cta}`,
  `Under-Button Note: ${hero.note}`,
  `Section Header: ${valueModule.header}`,
  `Body: ${valueModule.body}`,
  `columns: ${valueModule.table.columns.join(' | ')}`,
  ...valueModule.table.rows.map((row) => row.join(' | ')),
  valueModule.arcTitle,
  ...valueModule.arc.map((step) => `${step.name} (${step.time}): ${step.text}`),
  `Section Header: ${lineup.header}`,
  `Subhead: ${lineup.subhead}`,
  ...lineup.cultivars.map(
    (item) =>
      `${item.name} — ${item.origin} | Cultivar: ${item.cultivar} | Liquor: ${item.liquor} | In the Cup: ${item.inTheCup}`,
  ),
  `Inside the Lid Footer: ${lineup.insideTheLid}`,
];

describe('the Tasting Flight page copy', () => {
  it.each(specLines)('is in the spec word for word: %s', (line) => {
    expect(spec).toContain(line);
  });

  it('has a three-column table with three rows, four specs, three infusions and four cultivars', () => {
    expect(valueModule.table.columns).toHaveLength(3);
    expect(valueModule.table.rows).toHaveLength(3);
    for (const row of valueModule.table.rows) expect(row).toHaveLength(3);
    expect(hero.specs).toHaveLength(4);
    expect(valueModule.arc).toHaveLength(3);
    expect(lineup.cultivars).toHaveLength(4);
  });
});

describe('the Reserve emails', () => {
  it('are five, Day 0, 3, 7, 14 and 19', () => {
    expect(emails.map((email) => email.day)).toEqual([0, 3, 7, 14, 19]);
  });

  it.each(emails.map((email) => [email.day, email]))('Day %i has a subject, preview and body from the spec', (_day, email) => {
    for (const field of ['subject', 'preview', 'body']) {
      expect(typeof email[field]).toBe('string');
      expect(email[field].trim()).not.toBe('');
    }
    expect(spec).toContain(`Subject: ${email.subject}\nPreview: ${email.preview}\nBody:\n${email.body}\n`);
  });

  it('give each bracketed button in a body a label and a placeholder link', () => {
    for (const email of emails) {
      const button = email.body.match(/^\[(.+)\]$/m)?.[1];
      if (button) {
        expect(email.cta).toEqual({ label: button, url: expect.stringMatching(/^\{\{ \w+ \}\}$/) });
      } else {
        expect(email.cta).toBeNull();
      }
    }
  });

  it('are all written out in emails/tasting-flight-sequence.md', () => {
    for (const email of emails) {
      expect(sequence).toContain(email.subject);
      expect(sequence).toContain(email.preview);
      expect(sequence).toContain(email.body);
    }
  });
});

describe('the unconfirmed claims', () => {
  it('list every pre-launch spec that still needs confirming', () => {
    expect(claims.map((claim) => claim.id)).toEqual([
      'four-cultivars-elevations',
      'hand-rolled-family-gardens',
      'forty-five-cups',
      'physical-credit-card',
      'connoisseurs-reserve-bundle',
      'direct-sourcing-nantou',
    ]);
    for (const claim of claims) expect(claim.claim).not.toBe('');
  });

  it('flag the 48-cup yield (12 infusions in each of four sample tins)', () => {
    expect(claims.find((claim) => claim.id === 'forty-five-cups').note).toMatch(/48 cups/);
  });
});
