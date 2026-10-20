import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { placeholderFor, leafSprig, cupWithSteam, teapot, coffeeBean } from './index.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const files = readdirSync(dir).filter((name) => name.endsWith('.svg'));

// The six Garden Teahouse colors (tailwind.config.js). The art uses nothing else.
const PALETTE = ['#F7F4EC', '#6F8466', '#4E5F47', '#E9DCC8', '#DDE5D3', '#2F3A2E'];

describe('placeholder art', () => {
  it('is a small set of illustrations', () => {
    expect(files.length).toBeGreaterThanOrEqual(2);
    expect(files.length).toBeLessThanOrEqual(4);
  });

  describe.each(files)('%s', (name) => {
    const svg = readFileSync(path.join(dir, name), 'utf8');

    it('is a standalone SVG picture', () => {
      expect(svg.trimStart().startsWith('<svg')).toBe(true);
      expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
      expect(svg).toMatch(/viewBox="0 0 \d+ \d+"/);
    });

    it('is drawn from shapes alone: no embedded photos, scripts or outside links', () => {
      expect(svg).not.toMatch(/<image\b/i);
      expect(svg).not.toMatch(/<script\b/i);
      expect(svg).not.toMatch(/<foreignObject\b/i);
      expect(svg).not.toMatch(/\bhref\s*=/i);
      expect(svg).not.toMatch(/@import/i);
      expect(svg).not.toMatch(/url\(\s*['"]?(?!#)/i);
      expect(svg).not.toMatch(/data:/i);
    });

    it('uses only the site palette', () => {
      const colors = [...svg.matchAll(/#[0-9a-f]{3,8}\b/gi)].map((match) => match[0].toUpperCase());
      expect(colors.length).toBeGreaterThan(1);
      for (const color of colors) {
        expect(PALETTE, `${color} is not a palette color`).toContain(color);
      }
    });

    it('is plain ASCII', () => {
      // eslint-disable-next-line no-control-regex
      expect(svg).toMatch(/^[\x09\x0A\x0D\x20-\x7E]*$/);
    });
  });
});

describe('placeholderFor', () => {
  it('gives tea the leaf sprig and coffee the bean', () => {
    expect(placeholderFor({ category: 'tea' })).toBe(leafSprig);
    expect(placeholderFor({ category: 'coffee' })).toBe(coffeeBean);
  });

  it('falls back to the cup for anything else', () => {
    expect(placeholderFor({ category: 'gear' })).toBe(cupWithSteam);
    expect(placeholderFor({})).toBe(cupWithSteam);
    expect(placeholderFor(undefined)).toBe(cupWithSteam);
  });

  it('exports four different pictures', () => {
    const urls = [leafSprig, cupWithSteam, teapot, coffeeBean];
    for (const url of urls) {
      expect(typeof url).toBe('string');
      expect(url).toMatch(/\.svg$|^data:image\/svg\+xml/);
    }
    expect(new Set(urls).size).toBe(4);
  });
});
