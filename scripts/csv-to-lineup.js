// Turns the lineup spreadsheet into src/data/lineup.json:
//
//   npm run lineup:csv -- path/to/lineup.csv
//
// The spreadsheet is lineup-template.csv, filled in. Each row is one variant (a
// format and size with a price). Rows that share a slug make one product, and
// that product's own columns (name, description and so on) are read from the
// first of its rows. Lists (flavor_notes, tags, aromas, images) are written with |
// between items ('floral|honey') and
// prices in dollars ('12.50'). Stripe price ids already in lineup.json are kept,
// and nothing is written unless the result passes validateLineup.
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';
import { getProducts, validateLineup } from '../lib/catalog.js';

const LINEUP_URL = new URL('../src/data/lineup.json', import.meta.url);

// Every column of lineup-template.csv. A CSV missing one is refused, so a
// misspelt or deleted heading cannot quietly drop a whole column of data.
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
  'aromas',
  'featured',
  'images',
  'format',
  'size_label',
  'cups',
  'price',
];

const TRUE_WORDS = ['yes', 'true', '1'];
const FALSE_WORDS = ['', 'no', 'false', '0'];

// What a UTF-8 decoder puts in place of bytes it cannot read.
const REPLACEMENT_CHARACTER = String.fromCodePoint(0xfffd);

const listOf = (value) => (Array.isArray(value) ? value : []);

// A cell's text, trimmed. undefined when blank, so the field is left out.
const text = (row, column) => (row[column] ?? '').trim() || undefined;
const lower = (value) => value?.toLowerCase();

// Keep only the keys that have a value, so blank optional cells leave no trace.
const compact = (object) =>
  Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));

// 'floral | honey' -> ['floral', 'honey']. Blank -> [].
const toList = (value = '') =>
  value
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);

// yes/true/1 and no/false/0 in any capitalisation (Excel writes TRUE and FALSE);
// blank means no. Anything else is passed on as it is, so validateLineup reports
// it rather than it quietly becoming false.
function toFeatured(value = '') {
  const word = value.toLowerCase();
  if (TRUE_WORDS.includes(word)) return true;
  if (FALSE_WORDS.includes(word)) return false;
  return value;
}

// '12.50' -> 1250. Whole-number maths on the digits, so there is no 19.99 * 100 =
// 1998.9999999999998 to round. A leading $ is allowed because spreadsheets export
// currency cells that way. Blank is left out; anything else that is not dollars
// with at most two decimals becomes NaN, which validateLineup reports.
function toPriceCents(value) {
  if (value === undefined) return undefined;
  const match = /^\$?(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return Number.NaN;
  const [, dollars, cents = ''] = match;
  return Number(dollars) * 100 + Number(cents.padEnd(2, '0'));
}

// '25' -> 25. Blank is left out; anything else that is not a whole number becomes NaN.
function toCups(value) {
  if (value === undefined) return undefined;
  return /^\d+$/.test(value) ? Number(value) : Number.NaN;
}

// '2 oz tin' -> '2-oz-tin'. Accents are dropped, so a letter with one is not lost.
function slugify(value) {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// The stripe_price_id each variant already has, keyed by product slug and variant id.
function priceIdsOf(existing) {
  const ids = new Map();
  for (const product of listOf(existing?.products)) {
    for (const variant of listOf(product?.variants)) {
      if (typeof variant?.stripe_price_id === 'string' && variant.stripe_price_id !== '') {
        ids.set(JSON.stringify([product.slug, variant.id]), variant.stripe_price_id);
      }
    }
  }
  return ids;
}

function toVariant(row, slug, keptPriceIds) {
  const format = lower(text(row, 'format'));
  const sizeLabel = text(row, 'size_label');
  const id = [format, slugify(sizeLabel ?? '')].filter(Boolean).join('-');
  return compact({
    id,
    format,
    size_label: sizeLabel,
    cups: toCups(text(row, 'cups')),
    price_cents: toPriceCents(text(row, 'price')),
    stripe_price_id: keptPriceIds.get(JSON.stringify([slug, id])),
  });
}

// The product as its first row describes it. Its variants are added as its rows turn up.
function toProduct(row) {
  const brewGuide = compact({
    water_temp: text(row, 'water_temp'),
    amount: text(row, 'amount'),
    steep_time: text(row, 'steep_time'),
  });
  return compact({
    slug: text(row, 'slug'),
    name: text(row, 'name'),
    category: lower(text(row, 'category')),
    tea_type: text(row, 'tea_type'),
    short_description: text(row, 'short_description'),
    story: text(row, 'story'),
    flavor_notes: toList(text(row, 'flavor_notes')),
    caffeine: lower(text(row, 'caffeine')),
    ingredients: text(row, 'ingredients'),
    origin: text(row, 'origin'),
    brew_guide: Object.keys(brewGuide).length > 0 ? brewGuide : undefined,
    tags: toList(text(row, 'tags')),
    aromas: toList(text(row, 'aromas')),
    featured: toFeatured(text(row, 'featured')),
    images: toList(text(row, 'images')),
    variants: [],
  });
}

function readRows(csvText) {
  let headings;
  const rows = parse(csvText, {
    // Excel's "CSV UTF-8" starts the file with a byte order mark. Skip it on purpose
    // rather than lean on `trim` happening to treat it as whitespace.
    bom: true,
    columns: (names) => {
      headings = names.map((name) => name.trim().toLowerCase());
      return headings;
    },
    trim: true,
    skip_empty_lines: true,
    // Spreadsheets often export blank rows as ",,,,,".
    skip_records_with_empty_values: true,
  });

  const missing = headings ? COLUMNS.filter((column) => !headings.includes(column)) : [];
  if (missing.length > 0) {
    throw new Error(
      `The CSV is missing these columns: ${missing.join(', ')}. Start from lineup-template.csv ` +
        'and keep every column in the first row, spelled the same way.',
    );
  }
  return rows;
}

/**
 * Turn the text of a filled-in lineup-template.csv into a lineup. The result is
 * not checked here: run validateLineup on it, which reports every problem in
 * plain English. A variant keeps the stripe_price_id it has in `existing` (by
 * default the current lineup.json) when the product slug and variant id match.
 * @returns {{ products: object[] }}
 * @throws if the text is not valid CSV or a column of the template is missing
 */
export function csvToLineup(csvText, existing = { products: getProducts() }) {
  const keptPriceIds = priceIdsOf(existing);
  const products = new Map();

  for (const row of readRows(csvText)) {
    const slug = text(row, 'slug');
    // A row with no slug cannot join a product, so it stands alone and gets reported.
    const key = slug ?? Symbol('row without a slug');
    if (!products.has(key)) products.set(key, toProduct(row));
    products.get(key).variants.push(toVariant(row, slug, keptPriceIds));
  }

  return { products: [...products.values()] };
}

const USAGE = 'Usage: npm run lineup:csv -- path/to/lineup.csv';

const count = (number, word) => `${number} ${word}${number === 1 ? '' : 's'}`;

/**
 * The command: read a CSV, check it and, only if it passes, write lineup.json.
 * `io` is there for tests; by default this reads and writes the real files and
 * prints to the console.
 * @returns {number} the exit code
 */
export function runCli(args, io = {}) {
  const {
    readText = (path) => readFileSync(path, 'utf8'),
    writeText = (json) => writeFileSync(LINEUP_URL, json),
    existing,
    log = console.log,
    logError = console.error,
  } = io;

  const [csvPath] = args;
  if (!csvPath) {
    logError(USAGE);
    return 1;
  }

  let csvText;
  try {
    csvText = readText(csvPath);
  } catch (error) {
    logError(`Could not read ${csvPath}: ${error.message}`);
    return 1;
  }

  // Bytes that are not UTF-8 (Excel's plain "CSV" option on Windows) decode to
  // U+FFFD, and curly quotes would otherwise end up garbled in the shop.
  if (csvText.includes(REPLACEMENT_CHARACTER)) {
    logError(
      `${csvPath} is not saved as UTF-8, so some characters cannot be read. In Excel, choose ` +
        'Save As and pick "CSV UTF-8". Nothing was written.',
    );
    return 1;
  }

  let lineup;
  try {
    lineup = csvToLineup(csvText, existing);
  } catch (error) {
    logError(`Could not read ${csvPath}: ${error.message} Nothing was written.`);
    return 1;
  }

  // An empty CSV is a valid lineup, but writing it would wipe the whole shop.
  if (lineup.products.length === 0) {
    logError(`${csvPath} has no products, so nothing was written (that would empty the shop).`);
    return 1;
  }

  const { ok, errors } = validateLineup(lineup);
  if (!ok) {
    logError(`${csvPath} has ${count(errors.length, 'problem')}:`);
    for (const message of errors) logError(`  - ${message}`);
    logError('Fix them in the spreadsheet, save it as CSV again and re-run. Nothing was written.');
    return 1;
  }

  try {
    writeText(`${JSON.stringify(lineup, null, 2)}\n`);
  } catch (error) {
    logError(`Could not write src/data/lineup.json: ${error.message}`);
    return 1;
  }

  const variants =lineup.products.reduce((total, product) => total + product.variants.length, 0);
  log(
    `Wrote src/data/lineup.json: ${count(lineup.products.length, 'product')}, ` +
      `${count(variants, 'variant')}.`,
  );
  log('Next: run "npm run load-lineup" to create or update the matching Stripe prices.');
  return 0;
}

// True when this file is the one being run (node scripts/csv-to-lineup.js), not imported.
function isRunDirectly() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isRunDirectly()) {
  process.exitCode = runCli(process.argv.slice(2));
}
