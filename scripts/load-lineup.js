// Sends the lineup to Stripe: one Stripe product for each product and one Stripe
// price for each variant. The price ids are written back into src/data/lineup.json,
// because a variant can only be bought once it has one.
//
//   npm run load-lineup             uses STRIPE_SECRET_KEY from .env.local (a test key)
//   npm run load-lineup -- --live   needed to use a live key, which changes the real shop
//
// It is safe to run again. A product is found again by its slug and updated, and a
// price is kept for as long as it has the right amount and tax setting. Stripe prices
// cannot be edited, so a new amount gets a new price and the old one is turned off.
// Nothing is deleted. Nothing is sent to Stripe unless the lineup passes validateLineup
// and none of its products is still a sample row from lineup-template.csv.
//
// It also notes any product the quiz's aroma question cannot find (its `aromas`, the
// aromas column of the sheet, has none of the words the quiz looks for) and any aroma
// word the quiz does not know, so a blank or misspelt aromas cell is noticed. These are
// notes only: Stripe does not use aromas, and the product is loaded either way.
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Stripe from 'stripe';
import { validateLineup } from '../lib/catalog.js';
import { QUIZ_AROMAS } from '../lib/quiz.js';
import { DEFAULT_TAX_CODE } from '../lib/store-config.js';

const LINEUP_URL = new URL('../src/data/lineup.json', import.meta.url);

// The sample rows in lineup-template.csv have slugs that start like this.
const EXAMPLE_PREFIX = 'example-';

// Stripe secret keys (sk_) and restricted keys (rk_), for test or live mode.
const KEY_PATTERN = /^(?:sk|rk)_(test|live)_/;

// Every price is created tax exclusive: sales tax is added on top at checkout, which is
// how US prices work. Stripe Tax needs each price to say which it is. A price that says
// something else, or nothing, counts as changed and is replaced like one with a new amount.
const TAX_BEHAVIOR = 'exclusive';

// Something the person running this can fix, such as a bad lineup or the wrong key.
// The message says how. Any other error (a network failure, say) came from Stripe.
class LineupError extends Error {}

const count = (number, word) => `${number} ${word}${number === 1 ? '' : 's'}`;

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const usd = (cents) => dollars.format(cents / 100);

/** 'test', 'live', or undefined when this does not look like a Stripe secret key. */
function keyMode(apiKey) {
  return KEY_PATTERN.exec(apiKey ?? '')?.[1];
}

function checkKey(apiKey, live) {
  const mode = keyMode(apiKey);
  if (!mode) {
    throw new LineupError(
      'That does not look like a Stripe secret key (it should start with sk_test_ or sk_live_).',
    );
  }
  if (mode === 'live' && !live) {
    throw new LineupError('Refusing to use a live Stripe key without --live');
  }
  return mode;
}

// 'https://cdn.example.com/a.jpg' -> itself. A path on the shop, a bare file name
// or anything that is not a web address -> undefined, because Stripe can only show
// an image it can fetch from the web.
function webAddress(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

// What Stripe is told about a product, other than its slug.
function productFields(product) {
  const image = webAddress(product.images?.[0]);
  return {
    name: product.name,
    description: product.short_description,
    tax_code: product.tax_code?.trim() || DEFAULT_TAX_CODE,
    ...(image && { images: [image] }),
  };
}

// The price Stripe holds for an id, or null when there is no such price. That is
// what Stripe says about an id from the other mode (a test id with a live key) or
// another account. Anything else wrong is a real error and is not hidden.
async function getPrice(stripe, id) {
  try {
    return await stripe.prices.retrieve(id);
  } catch (error) {
    if (error?.code === 'resource_missing') return null;
    throw error;
  }
}

// Why an existing price cannot be used for this amount and tax setting, or undefined if
// it can.
function whyNotUsable(price, cents) {
  if (price.active === false) return 'is already turned off in Stripe';
  if (price.currency && price.currency !== 'usd') {
    return `is in ${price.currency.toUpperCase()}, not USD`;
  }
  if (price.unit_amount !== cents) {
    const was = Number.isInteger(price.unit_amount) ? usd(price.unit_amount) : 'not a fixed amount';
    return `is ${was}, not ${usd(cents)}`;
  }
  if (price.tax_behavior !== TAX_BEHAVIOR) {
    return `has a different tax setting (${price.tax_behavior ?? 'not set'}), not ${TAX_BEHAVIOR}`;
  }
  return undefined;
}

// Everything Stripe already holds about one product, found without changing anything.
async function lookUp(stripe, product) {
  const result = await stripe.products.search({ query: `metadata['slug']:'${product.slug}'` });
  const hits = result?.data ?? [];
  if (hits.length > 1) {
    throw new LineupError(
      `Stripe has ${hits.length} products with the slug '${product.slug}' ` +
        `(${hits.map((hit) => hit.id).join(', ')}). Archive or delete the extra ones in the ` +
        'Stripe dashboard, then run this again. Nothing was changed in Stripe.',
    );
  }

  // Keyed by variant id: a price, or null if Stripe has none with that id. A variant
  // with no stripe_price_id has no entry.
  const prices = new Map();
  for (const variant of product.variants) {
    if (!variant.stripe_price_id) continue;
    prices.set(variant.id, await getPrice(stripe, variant.stripe_price_id));
  }

  // Search can be a minute behind, so a product made moments ago may not be found by
  // slug yet. Its prices still know which product they belong to.
  const priceOwner = [...prices.values()].find((price) => typeof price?.product === 'string');
  const productId = hits[0]?.id ?? priceOwner?.product;
  return { productId, archived: hits[0]?.active === false, prices };
}

// Makes the Stripe price for one variant, unless the one it already has is right.
// Sets stripe_price_id on `variant` and says what happened.
async function syncVariant(stripe, product, productId, variant, current, report, tally) {
  const label = `${product.name}, ${variant.size_label}`;
  const now = usd(variant.price_cents);
  const oldId = variant.stripe_price_id || undefined;
  const problem = current ? whyNotUsable(current, variant.price_cents) : undefined;

  if (current && !problem) {
    tally.pricesKept += 1;
    report.push(`${label}: kept ${oldId} (${now}).`);
    return;
  }

  const created = await stripe.prices.create({
    product: productId,
    unit_amount: variant.price_cents,
    currency: 'usd',
    tax_behavior: TAX_BEHAVIOR,
    metadata: { slug: product.slug, variant_id: variant.id },
  });
  variant.stripe_price_id = created.id;
  tally.pricesCreated += 1;

  if (!oldId) {
    report.push(`${label}: created ${created.id} (${now}).`);
  } else if (!current) {
    report.push(`${label}: Stripe has no ${oldId}. Created ${created.id} (${now}).`);
  } else if (current.active === false) {
    report.push(`${label}: ${oldId} ${problem}. Created ${created.id} (${now}).`);
  } else {
    // The new price exists before the old one goes, so a failure here leaves two
    // working prices rather than none.
    await stripe.prices.update(oldId, { active: false });
    report.push(`${label}: ${oldId} ${problem}. Created ${created.id} and turned ${oldId} off.`);
  }
}

async function syncProduct(stripe, product, existing, report, tally) {
  const fields = productFields(product);
  let productId = existing.productId;

  if (productId) {
    // A product archived in the Stripe dashboard cannot be bought, so the lineup wins.
    const changes = existing.archived ? { ...fields, active: true } : fields;
    await stripe.products.update(productId, changes);
    tally.productsUpdated += 1;
    report.push(
      existing.archived
        ? `${product.name}: updated product ${productId} and turned it back on (it was archived).`
        : `${product.name}: updated product ${productId}.`,
    );
  } else {
    productId = (await stripe.products.create({ ...fields, metadata: { slug: product.slug } })).id;
    tally.productsCreated += 1;
    report.push(`${product.name}: created product ${productId}.`);
  }

  for (const variant of product.variants) {
    const current = existing.prices.get(variant.id);
    await syncVariant(stripe, product, productId, variant, current, report, tally);
  }
}

/**
 * Make Stripe match the lineup and return the lineup with every variant's
 * stripe_price_id filled in, plus a plain-English report of what was done. The
 * lineup passed in is not changed. `stripe` is a Stripe client; nothing else is
 * read, written or printed here.
 *
 * Nothing reaches Stripe until the key, the lineup and the example check have
 * passed, and Stripe is read in full before anything in it is changed.
 *
 * `apiKey` is the key `stripe` was made with. A client cannot report its own key,
 * so whoever makes the client passes it here for the live-key check.
 *
 * If Stripe fails after changes began, the error has `partial: { lineup, report }`
 * holding the work done so far, so no price id that now exists in Stripe is lost.
 * @returns {Promise<{ lineup: object, report: string[] }>}
 * @throws if the key is live and `live` is not set, the lineup is invalid, any
 *   product is still a template example, or Stripe reports a problem
 */
export async function syncLineup(lineup, stripe, { live = false, apiKey } = {}) {
  if (apiKey !== undefined) checkKey(apiKey, live);

  const { ok, errors } = validateLineup(lineup);
  if (!ok) {
    throw new LineupError(
      `The lineup has ${count(errors.length, 'problem')}, so nothing was sent to Stripe:\n` +
        `${errors.map((message) => `  - ${message}`).join('\n')}\n` +
        'Fix them in the spreadsheet, run npm run lineup:csv again, then run this again.',
    );
  }

  const examples = lineup.products.filter((product) => product.slug.startsWith(EXAMPLE_PREFIX));
  if (examples.length > 0) {
    throw new LineupError(
      'These products are still the sample rows from lineup-template.csv: ' +
        `${examples.map((product) => product.slug).join(', ')}. Delete or replace them in the ` +
        'spreadsheet, run npm run lineup:csv again, then run this again. ' +
        'Nothing was sent to Stripe.',
    );
  }

  const result = structuredClone(lineup);
  const report = [];
  if (result.products.length === 0) {
    report.push('The lineup has no products, so there was nothing to send to Stripe.');
    return { lineup: result, report };
  }

  // Look at all of Stripe first, so a surprise stops the run before the first change.
  const existing = [];
  for (const product of result.products) existing.push(await lookUp(stripe, product));

  const tally = { productsCreated: 0, productsUpdated: 0, pricesCreated: 0, pricesKept: 0 };
  try {
    for (const [index, product] of result.products.entries()) {
      await syncProduct(stripe, product, existing[index], report, tally);
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null) error.partial = { lineup: result, report };
    throw error;
  }

  report.push(
    `Done: ${count(tally.productsCreated, 'product')} created, ${tally.productsUpdated} updated; ` +
      `${count(tally.pricesCreated, 'price')} created, ${tally.pricesKept} kept.`,
  );
  return { lineup: result, report };
}

/**
 * Notes, in plain English, on the products' aromas: one line for each product the quiz's
 * aroma question can never find, and one for each product with aroma words the quiz
 * does not look for (a typo, say). [] when every product has a known aroma and no
 * unknown ones. Words are compared without regard to case or spacing, as the quiz does.
 */
export function aromaNotes(lineup) {
  const notes = [];
  const products = Array.isArray(lineup?.products) ? lineup.products : [];
  for (const product of products) {
    // A lineup that fails validation is reported by syncLineup; there is nothing to note.
    if (typeof product?.name !== 'string') continue;
    const aromas = (Array.isArray(product.aromas) ? product.aromas : [])
      .filter((aroma) => typeof aroma === 'string' && aroma.trim() !== '')
      .map((aroma) => aroma.trim());
    const isKnown = (aroma) => QUIZ_AROMAS.includes(aroma.toLowerCase());
    const unknown = aromas.filter((aroma) => !isKnown(aroma));
    if (!aromas.some(isKnown)) {
      notes.push(
        `Note: ${product.name} has no aroma the quiz looks for, so the aroma question will not ` +
          'find it. Fill in its aromas column (LINEUP-GUIDE.md lists the words).',
      );
    }
    if (unknown.length > 0) {
      notes.push(
        `Note: the quiz does not look for these aromas of ${product.name}: ` +
          `${unknown.map((aroma) => `'${aroma}'`).join(', ')}. Check the spelling if they should count.`,
      );
    }
  }
  return notes;
}

const USAGE = 'Usage: npm run load-lineup   (to use a live key: npm run load-lineup -- --live)';

/**
 * The command: check the key, read lineup.json, sync it to Stripe and write it back
 * with the price ids. `io` is there for tests; by default this reads the key from
 * the environment, uses the real Stripe, reads and writes the real file and prints
 * to the console.
 * @returns {Promise<number>} the exit code
 */
export async function runCli(args, io = {}) {
  const {
    env = process.env,
    readText = () => readFileSync(LINEUP_URL, 'utf8'),
    writeText = (json) => writeFileSync(LINEUP_URL, json),
    createStripe = (apiKey) => new Stripe(apiKey),
    log = console.log,
    logError = console.error,
  } = io;

  if (args.some((arg) => arg !== '--live')) {
    logError(USAGE);
    return 1;
  }
  const live = args.includes('--live');

  const apiKey = (env.STRIPE_SECRET_KEY ?? '').trim();
  if (!apiKey) {
    logError(
      'STRIPE_SECRET_KEY is not set. Put your Stripe test key (it starts with sk_test_) in ' +
        '.env.local, then run this again. Nothing was sent to Stripe.',
    );
    return 1;
  }

  let mode;
  try {
    mode = checkKey(apiKey, live);
  } catch (error) {
    logError(error.message);
    if (keyMode(apiKey) === 'live') {
      logError(
        'A live key would change the real shop. Use a test key (sk_test_...) in .env.local, or ' +
          'if you really mean it, run: npm run load-lineup -- --live',
      );
    }
    logError('Nothing was sent to Stripe.');
    return 1;
  }

  let lineup;
  try {
    lineup = JSON.parse(readText());
  } catch (error) {
    logError(`Could not read src/data/lineup.json: ${error.message}`);
    return 1;
  }

  // Not an error for syncLineup, but here it almost always means lineup:csv was skipped.
  if (Array.isArray(lineup?.products) && lineup.products.length === 0) {
    logError(
      'src/data/lineup.json has no products, so there is nothing to send to Stripe. Turn the ' +
        'spreadsheet into a lineup first: npm run lineup:csv -- path/to/lineup.csv',
    );
    return 1;
  }

  log(
    mode === 'live'
      ? 'Using a LIVE Stripe key: this changes the real shop.'
      : 'Using a Stripe test key.',
  );
  for (const note of aromaNotes(lineup)) log(note);

  let result;
  try {
    result = await syncLineup(lineup, createStripe(apiKey), { live, apiKey });
  } catch (error) {
    return reportFailure(error, lineup, { log, logError, writeText });
  }

  // The report goes first so the new ids are on screen even if the file cannot be written.
  for (const line of result.report) log(line);
  try {
    writeText(`${JSON.stringify(result.lineup, null, 2)}\n`);
  } catch (error) {
    logError(`Could not write src/data/lineup.json: ${error.message}`);
    logError(
      'The prices above were made in Stripe but are not saved. Free up the file and run this ' +
        'again; that makes a second set of prices and leaves the first set unused.',
    );
    return 1;
  }
  log('Wrote src/data/lineup.json with the Stripe price ids.');
  return 0;
}

// Tells the person what went wrong and, when Stripe stopped part-way, keeps the
// price ids it had already made so they are not lost. Always returns the exit code 1.
function reportFailure(error, lineup, { log, logError, writeText }) {
  if (error instanceof LineupError) {
    logError(error.message);
    return 1;
  }

  logError(`Stripe reported a problem: ${error?.message ?? error}`);
  const partial = error?.partial;
  if (!partial) {
    logError('Nothing was changed in Stripe, and nothing was written.');
    return 1;
  }

  for (const line of partial.report) log(line);
  if (JSON.stringify(partial.lineup) === JSON.stringify(lineup)) {
    logError('Nothing was written. Fix the problem and run this again.');
    return 1;
  }
  try {
    writeText(`${JSON.stringify(partial.lineup, null, 2)}\n`);
  } catch (writeError) {
    logError(`Could not write src/data/lineup.json: ${writeError.message}`);
    logError('The prices above were made in Stripe but are not saved.');
    return 1;
  }
  logError(
    'The prices made before the problem were saved to src/data/lineup.json. Fix the problem ' +
      'and run this again to carry on; prices that are already right are kept.',
  );
  return 1;
}

// True when this file is the one being run (node scripts/load-lineup.js), not imported.
function isRunDirectly() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isRunDirectly()) {
  runCli(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
