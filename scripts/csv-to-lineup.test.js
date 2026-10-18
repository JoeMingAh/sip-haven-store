import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { validateLineup } from '../lib/catalog.js';
import { csvToLineup, runCli } from './csv-to-lineup.js';

// The columns of lineup-template.csv, in the order the template lists them.
const COLUMNS = [
  'slug',
  'name',
  'category',
  'tea_type',
  'short_description',
  'story',
  'flavor_notes',
  'caffeine',
  'ingredients',
  'origin',
  'water_temp',
  'amount',
  'steep_time',
  'tags',
  'featured',
  'images',
  'format',
  'size_label',
  'cups',
  'price',
];

// One valid tea row, with every optional cell blank. Tests change only the cells
// they are about.
const teaRow = {
  slug: 'jasmine-dream',
  name: 'Jasmine Dream',
  category: 'tea',
  short_description: 'Green tea scented with jasmine blossoms.',
  flavor_notes: 'floral|honey',
  caffeine: 'low',
  format: 'loose-leaf',
  size_label: '2 oz tin',
  cups: '25',
  price: '12.50',
};
const row = (changes = {}) => ({ ...teaRow, ...changes });

// A second variant of the same tea (a later row with the same slug).
const teaBags = { format: 'tea-bags', size_label: '20 bags', cups: '20', price: '9' };

const coffeeRow = row({
  slug: 'house-roast',
  name: 'House Roast',
  category: 'coffee',
  short_description: 'A balanced medium roast.',
  flavor_notes: 'cocoa|toasted nut',
  caffeine: 'high',
  format: 'whole-bean',
  size_label: '12 oz bag',
  cups: '',
  price: '16',
});

// A CSV cell the way a spreadsheet writes it: quoted only when it has to be.
const csvCell = (value = '') =>
  /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;

function toCsv(rows, columns = COLUMNS) {
  const lines = rows.map((r) => columns.map((column) => csvCell(r[column])).join(','));
  return [columns.join(','), ...lines].join('\n');
}

// Written with code points because both are invisible in an editor.
// Excel's "CSV UTF-8" starts a file with the first.
const BOM = String.fromCodePoint(0xfeff);
// Bytes that are not UTF-8 decode to the second.
const REPLACEMENT_CHARACTER = String.fromCodePoint(0xfffd);

// Most tests convert with no earlier lineup, so none depends on the real lineup.json.
const NO_EXISTING = { products: [] };
const convert = (rows, existing = NO_EXISTING) => csvToLineup(toCsv(rows), existing);
const errorsFor = (rows) => validateLineup(convert(rows)).errors;

describe('csvToLineup', () => {
  describe('products and variants', () => {
    it('turns two rows with the same slug into one product with two variants', () => {
      const { products } = convert([row(), row(teaBags)]);
      expect(products).toHaveLength(1);
      expect(products[0].slug).toBe('jasmine-dream');
      expect(products[0].variants).toHaveLength(2);
      expect(products[0].variants.map((v) => v.format)).toEqual(['loose-leaf', 'tea-bags']);
    });

    it('groups by slug even with other products in between, in order of first appearance', () => {
      const { products } = convert([row(), coffeeRow, row(teaBags)]);
      expect(products.map((p) => [p.slug, p.variants.length])).toEqual([
        ['jasmine-dream', 2],
        ['house-roast', 1],
      ]);
    });

    it('reads product columns from the first row of a slug only', () => {
      const { products } = convert([
        row(),
        row({ ...teaBags, name: 'Not This Name', short_description: 'Nor this.' }),
      ]);
      expect(products[0].name).toBe('Jasmine Dream');
      expect(products[0].short_description).toBe('Green tea scented with jasmine blossoms.');
    });

    it('does not let a later row rescue a blank name on the first row', () => {
      const data = convert([row({ name: '' }), row({ ...teaBags, name: 'Jasmine Dream' })]);
      expect(validateLineup(data)).toEqual({
        ok: false,
        errors: ['jasmine-dream: name is required'],
      });
    });

    it('reports each row that has no slug instead of merging them into one product', () => {
      const data = convert([row({ slug: '', name: 'Alpha' }), row({ slug: '', name: 'Beta' })]);
      expect(data.products).toHaveLength(2);
      expect(validateLineup(data).errors).toEqual([
        'Alpha: slug is required',
        'Beta: slug is required',
      ]);
    });

    it('gives coffee grind options their own variants when the size is the same', () => {
      const data = convert([
        coffeeRow,
        { ...coffeeRow, format: 'ground', price: '16.50' },
      ]);
      expect(data.products[0].variants.map((v) => v.id)).toEqual([
        'whole-bean-12-oz-bag',
        'ground-12-oz-bag',
      ]);
      expect(validateLineup(data).ok).toBe(true);
    });

    it('reports the same format and size listed twice for one product', () => {
      expect(errorsFor([row(), row({ price: '13' })])).toEqual([
        "Jasmine Dream: variant id 'loose-leaf-2-oz-tin' is used more than once",
      ]);
    });
  });

  describe('variant ids', () => {
    it.each([
      ['loose-leaf', '2 oz tin', 'loose-leaf-2-oz-tin'],
      ['tea-bags', '20 bags', 'tea-bags-20-bags'],
      ['k-cup', '12 K-Cups', 'k-cup-12-k-cups'],
      ['loose-leaf', '2oz', 'loose-leaf-2oz'],
      ['loose-leaf', '  4 OZ. Pouch!  ', 'loose-leaf-4-oz-pouch'],
      ['loose-leaf', '8 oz Café', 'loose-leaf-8-oz-cafe'],
    ])('builds the id from %s and %j as %s', (format, size_label, id) => {
      const [variant] = convert([row({ format, size_label })]).products[0].variants;
      expect(variant.id).toBe(id);
    });
  });

  describe('price', () => {
    it.each([
      ['12.50', 1250],
      ['12.5', 1250],
      ['12', 1200],
      ['$12.50', 1250],
      ['19.99', 1999], // 19.99 * 100 is 1998.9999999999998 in floating point
      ['0.29', 29],
      ['0.05', 5],
    ])('reads a price of %j as %i cents', (price, cents) => {
      expect(convert([row({ price })]).products[0].variants[0].price_cents).toBe(cents);
    });

    it.each([
      ['', 'missing or not a number'],
      ['abc', 'missing or not a number'],
      ['-3', 'missing or not a number'],
      ['1,250.00', 'missing or not a number'],
      ['12.505', 'missing or not a number'], // never rounded quietly to 12.51
      ['0', 'must be more than $0'],
    ])('lets validation flag a price of %j', (price, fragment) => {
      const errors = errorsFor([row({ price })]);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("Jasmine Dream: price for 'loose-leaf-2-oz-tin'");
      expect(errors[0]).toContain(fragment);
    });
  });

  describe('list columns', () => {
    it('splits flavor_notes, tags and images on |', () => {
      const [product] = convert([
        row({ flavor_notes: 'floral|honey', tags: 'afternoon|calming', images: '/a.jpg|/b.jpg' }),
      ]).products;
      expect(product.flavor_notes).toEqual(['floral', 'honey']);
      expect(product.tags).toEqual(['afternoon', 'calming']);
      expect(product.images).toEqual(['/a.jpg', '/b.jpg']);
    });

    it('trims items and drops empty ones', () => {
      const [product] = convert([row({ flavor_notes: ' floral | honey ', tags: '|calming||' })])
        .products;
      expect(product.flavor_notes).toEqual(['floral', 'honey']);
      expect(product.tags).toEqual(['calming']);
    });

    it('turns a blank list cell into an empty list', () => {
      const [product] = convert([row({ flavor_notes: '', tags: '', images: '' })]).products;
      expect(product.flavor_notes).toEqual([]);
      expect(product.tags).toEqual([]);
      expect(product.images).toEqual([]);
    });
  });

  describe('featured', () => {
    it.each(['yes', 'true', '1', 'Yes', 'TRUE', ' yes '])('reads %j as true', (featured) => {
      expect(convert([row({ featured })]).products[0].featured).toBe(true);
    });

    it.each(['', 'no', 'false', '0', 'FALSE'])('reads %j as false', (featured) => {
      expect(convert([row({ featured })]).products[0].featured).toBe(false);
    });

    it('lets validation flag a value it does not recognise instead of guessing', () => {
      expect(errorsFor([row({ featured: 'maybe' })])).toEqual([
        'Jasmine Dream: featured must be true or false',
      ]);
    });
  });

  describe('other cells', () => {
    it('accepts category, caffeine and format in any capitalisation', () => {
      const data = convert([row({ category: 'Tea', caffeine: 'Low', format: 'Loose-Leaf' })]);
      expect(validateLineup(data).ok).toBe(true);
      const [product] = data.products;
      expect(product.category).toBe('tea');
      expect(product.caffeine).toBe('low');
      expect(product.variants[0].format).toBe('loose-leaf');
    });

    it('builds brew_guide from water_temp, amount and steep_time', () => {
      const [product] = convert([
        row({ water_temp: '175 F', amount: '1 tsp per cup', steep_time: '2-3 minutes' }),
      ]).products;
      expect(product.brew_guide).toEqual({
        water_temp: '175 F',
        amount: '1 tsp per cup',
        steep_time: '2-3 minutes',
      });
    });

    it('leaves brew_guide out when all three cells are blank', () => {
      expect(convert([row()]).products[0]).not.toHaveProperty('brew_guide');
    });

    it('lets validation flag a half-filled brew guide', () => {
      expect(errorsFor([row({ water_temp: '175 F' })])).toEqual([
        'Jasmine Dream: brew_guide is missing amount, steep_time',
      ]);
    });

    it('leaves out optional cells that are blank', () => {
      const [product] = convert([row({ cups: '' })]).products;
      for (const key of ['tea_type', 'story', 'ingredients', 'origin', 'brew_guide']) {
        expect(product).not.toHaveProperty(key);
      }
      expect(product.variants[0]).not.toHaveProperty('cups');
      expect(product.variants[0]).not.toHaveProperty('stripe_price_id');
    });

    it('reads cups as a whole number', () => {
      expect(convert([row({ cups: '25' })]).products[0].variants[0].cups).toBe(25);
    });

    it.each(['2.5', 'abc', '0', '-3'])('lets validation flag cups of %j', (cups) => {
      expect(errorsFor([row({ cups })])).toEqual([
        "Jasmine Dream: cups for 'loose-leaf-2-oz-tin' must be a whole number, 1 or more",
      ]);
    });

    it('keeps commas, quotes and line breaks inside a quoted cell', () => {
      const story = 'Picked in spring, "first flush".\nSteeped slowly.';
      const [product] = convert([row({ short_description: 'Crisp, clean and bright.', story })])
        .products;
      expect(product.short_description).toBe('Crisp, clean and bright.');
      expect(product.story).toBe(story);
    });

    it('trims spaces inside a quoted cell too', () => {
      // csv-parse only trims cells that are not quoted.
      const csv = toCsv([row()]).replace('Jasmine Dream,', '"  Jasmine Dream  ",');
      expect(csvToLineup(csv, NO_EXISTING).products[0].name).toBe('Jasmine Dream');
    });

    it('produces exactly the shape validateLineup expects', () => {
      const data = convert([
        row({
          tea_type: 'green',
          story: 'A gentle afternoon tea.',
          ingredients: 'Green tea, jasmine blossoms',
          origin: 'Test Valley',
          water_temp: '175 F',
          amount: '1 tsp per cup',
          steep_time: '2-3 minutes',
          tags: 'floral|afternoon',
          featured: 'yes',
          images: '/images/jasmine.jpg',
        }),
      ]);
      expect(data).toStrictEqual({
        products: [
          {
            slug: 'jasmine-dream',
            name: 'Jasmine Dream',
            category: 'tea',
            tea_type: 'green',
            short_description: 'Green tea scented with jasmine blossoms.',
            story: 'A gentle afternoon tea.',
            flavor_notes: ['floral', 'honey'],
            caffeine: 'low',
            ingredients: 'Green tea, jasmine blossoms',
            origin: 'Test Valley',
            brew_guide: { water_temp: '175 F', amount: '1 tsp per cup', steep_time: '2-3 minutes' },
            tags: ['floral', 'afternoon'],
            featured: true,
            images: ['/images/jasmine.jpg'],
            variants: [
              {
                id: 'loose-leaf-2-oz-tin',
                format: 'loose-leaf',
                size_label: '2 oz tin',
                cups: 25,
                price_cents: 1250,
              },
            ],
          },
        ],
      });
      expect(validateLineup(data)).toEqual({ ok: true, errors: [] });
    });
  });

  describe('existing Stripe price ids', () => {
    const existing = {
      products: [
        {
          slug: 'jasmine-dream',
          variants: [
            { id: 'loose-leaf-2-oz-tin', stripe_price_id: 'price_tin' },
            { id: 'tea-bags-20-bags' }, // never synced
            { id: 'loose-leaf-8-oz-bag', stripe_price_id: 'price_dropped_size' },
          ],
        },
        { slug: 'other-tea', variants: [{ id: 'k-cup-12-k-cups', stripe_price_id: 'price_k' }] },
      ],
    };
    const idsOf = (product) => product.variants.map((v) => v.stripe_price_id);

    it('keeps the id when the slug and variant id both match', () => {
      const { products } = convert([row(), row(teaBags)], existing);
      expect(idsOf(products[0])).toEqual(['price_tin', undefined]);
    });

    it('keeps the id even when the price changed, since load-lineup handles the price', () => {
      const { products } = convert([row({ price: '14.00' })], existing);
      expect(products[0].variants[0].price_cents).toBe(1400);
      expect(products[0].variants[0].stripe_price_id).toBe('price_tin');
    });

    it('does not borrow an id from another product or another variant', () => {
      const { products } = convert(
        [
          // The same variant id as jasmine-dream's synced tin, but a different product.
          row({ slug: 'new-tea', name: 'New Tea' }),
          // jasmine-dream, but a size it never had.
          row({ ...teaBags, size_label: '40 bags' }),
        ],
        existing,
      );
      expect(products.map((p) => [p.slug, idsOf(p)])).toEqual([
        ['new-tea', [undefined]],
        ['jasmine-dream', [undefined]],
      ]);
    });

    it('does not carry over ids for variants that are gone from the CSV', () => {
      const { products } = convert([row()], existing);
      expect(products[0].variants).toHaveLength(1);
      expect(JSON.stringify(products)).not.toContain('price_dropped_size');
    });

    it('copes with an empty or odd existing lineup', () => {
      for (const odd of [null, {}, { products: 'nope' }, { products: [null, { slug: 'x' }] }]) {
        expect(convert([row()], odd).products[0].variants[0]).not.toHaveProperty('stripe_price_id');
      }
    });
  });

  describe('reading the file', () => {
    it.each([
      ['plain', (name) => name],
      // The mark then sits in front of the opening quote, which only skipping it handles.
      ['quoted', (name) => `"${name}"`],
    ])('reads a file that starts with a byte order mark, with %s headings', (_, heading) => {
      const [headings, ...rest] = toCsv([row()]).split('\n');
      const csv = [headings.split(',').map(heading).join(','), ...rest].join('\n');
      const data = csvToLineup(`${BOM}${csv}`, NO_EXISTING);
      expect(data.products[0].slug).toBe('jasmine-dream');
    });

    it('copes with Windows line endings and blank rows left at the end of a sheet', () => {
      const blankRow = ','.repeat(COLUMNS.length - 1);
      const csv = [toCsv([row()]), blankRow, blankRow, ''].join('\n').replaceAll('\n', '\r\n');
      expect(csvToLineup(csv, NO_EXISTING).products).toHaveLength(1);
    });

    it('finds columns by heading, whatever their order, and ignores extra columns', () => {
      const columns = [...COLUMNS].reverse().concat('my_private_notes');
      const csv = toCsv([row({ my_private_notes: 'call Sam' })], columns);
      const data = csvToLineup(csv, NO_EXISTING);
      expect(validateLineup(data).ok).toBe(true);
      expect(JSON.stringify(data)).not.toContain('call Sam');
      expect(data.products[0].name).toBe('Jasmine Dream');
    });

    it('ignores capital letters and spaces in the headings', () => {
      const csv = toCsv([row()]).replace(/^.*/, (heading) =>
        heading.toUpperCase().replaceAll(',', ' , '),
      );
      expect(csvToLineup(csv, NO_EXISTING).products[0].slug).toBe('jasmine-dream');
    });

    it('refuses a CSV that is missing columns, naming them', () => {
      // A misspelt or deleted heading would otherwise drop that whole column without a word.
      const columns = COLUMNS.filter((column) => column !== 'story' && column !== 'caffeine');
      expect(() => csvToLineup(toCsv([row()], columns), NO_EXISTING)).toThrow(
        'missing these columns: story, caffeine',
      );
    });

    it('returns no products for an empty file or one with only headings', () => {
      expect(csvToLineup('', NO_EXISTING)).toEqual({ products: [] });
      expect(csvToLineup(toCsv([]), NO_EXISTING)).toEqual({ products: [] });
    });
  });
});

describe('lineup-template.csv', () => {
  const template = readFileSync(new URL('../lineup-template.csv', import.meta.url), 'utf8');

  it('starts with the documented columns', () => {
    expect(template.split(/\r?\n/)[0]).toBe(COLUMNS.join(','));
  });

  it('holds example rows that convert and validate', () => {
    const data = csvToLineup(template, NO_EXISTING);
    expect(validateLineup(data)).toEqual({ ok: true, errors: [] });
    expect(data.products.map((p) => [p.slug, p.variants.map((v) => v.format)])).toEqual([
      ['example-green-tea', ['loose-leaf', 'tea-bags']],
      ['example-house-coffee', ['whole-bean']],
    ]);
  });

  it('marks every example as one, so it cannot pass for real stock', () => {
    for (const product of csvToLineup(template, NO_EXISTING).products) {
      expect(product.name).toMatch(/example/i);
      expect(product.short_description).toMatch(/example/i);
    }
  });
});

describe('runCli', () => {
  // Runs the command against an in-memory file system, so nothing real is read or written.
  function run(args, csv, io = {}) {
    const result = { written: [], log: [], error: [] };
    result.code = runCli(args, {
      readText: () => csv,
      writeText: (json) => result.written.push(json),
      existing: NO_EXISTING,
      log: (line) => result.log.push(line),
      logError: (line) => result.error.push(line),
      ...io,
    });
    return result;
  }

  it('writes the lineup as indented JSON and exits 0 when it is valid', () => {
    const csv = toCsv([row(), row(teaBags)]);
    const { code, written, log, error } = run(['lineup.csv'], csv);
    expect(code).toBe(0);
    expect(error).toEqual([]);
    expect(written).toEqual([`${JSON.stringify(csvToLineup(csv, NO_EXISTING), null, 2)}\n`]);
    expect(log.join('\n')).toContain('1 product, 2 variants');
  });

  it('keeps existing Stripe price ids in the file it writes', () => {
    const tin = { id: 'loose-leaf-2-oz-tin', stripe_price_id: 'price_tin' };
    const existing = { products: [{ slug: 'jasmine-dream', variants: [tin] }] };
    const { written } = run(['lineup.csv'], toCsv([row()]), { existing });
    expect(JSON.parse(written[0]).products[0].variants[0].stripe_price_id).toBe('price_tin');
  });

  it('writes nothing and exits 1 when the lineup does not validate, listing every problem', () => {
    const csv = toCsv([
      row({ name: '' }),
      row({ slug: 'bad-price', name: 'Bad Price', price: 'abc' }),
    ]);
    const { code, written, error } = run(['lineup.csv'], csv);
    expect(code).toBe(1);
    expect(written).toEqual([]);
    const text = error.join('\n');
    expect(text).toContain('2 problems');
    expect(text).toContain('jasmine-dream: name is required');
    expect(text).toContain("Bad Price: price for 'loose-leaf-2-oz-tin'");
    expect(text).toContain('Nothing was written');
  });

  it('prints how to use it and exits 1 when no file is named', () => {
    const { code, written, error } = run([], '');
    expect(code).toBe(1);
    expect(written).toEqual([]);
    expect(error.join('\n')).toContain('Usage: npm run lineup:csv -- path/to/lineup.csv');
  });

  it('says so and exits 1 when the file cannot be read', () => {
    const readText = () => {
      throw new Error('ENOENT: no such file or directory');
    };
    const { code, written, error } = run(['missing.csv'], '', { readText });
    expect(code).toBe(1);
    expect(written).toEqual([]);
    expect(error.join('\n')).toContain('Could not read missing.csv: ENOENT');
  });

  it('refuses a file with no products rather than emptying the shop', () => {
    for (const csv of ['', toCsv([])]) {
      const { code, written, error } = run(['lineup.csv'], csv);
      expect(code).toBe(1);
      expect(written).toEqual([]);
      expect(error.join('\n')).toContain('no products');
    }
  });

  it('explains a CSV it cannot parse and writes nothing', () => {
    const { code, written, error } = run(['lineup.csv'], `${COLUMNS.join(',')}\nonly,three,cells`);
    expect(code).toBe(1);
    expect(written).toEqual([]);
    expect(error.join('\n')).toContain('Could not read lineup.csv');
  });

  it('explains a CSV with missing columns and writes nothing', () => {
    const csv = toCsv([row()], COLUMNS.filter((column) => column !== 'price'));
    const { code, written, error } = run(['lineup.csv'], csv);
    expect(code).toBe(1);
    expect(written).toEqual([]);
    expect(error.join('\n')).toContain('missing these columns: price');
  });

  it('refuses text that was not saved as UTF-8 and writes nothing', () => {
    const csv = toCsv([row({ story: `It${REPLACEMENT_CHARACTER}s a good tea` })]);
    const { code, written, error } = run(['lineup.csv'], csv);
    expect(code).toBe(1);
    expect(written).toEqual([]);
    expect(error.join('\n')).toContain('UTF-8');
  });

  it('says so and exits 1 when lineup.json cannot be written', () => {
    const writeText = () => {
      throw new Error('EBUSY: resource busy or locked');
    };
    const { code, log, error } = run(['lineup.csv'], toCsv([row()]), { writeText });
    expect(code).toBe(1);
    expect(log).toEqual([]);
    expect(error.join('\n')).toContain('Could not write src/data/lineup.json: EBUSY');
  });
});
