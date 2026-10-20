// The store flag, as vite.config.js sets it up for a build. isStoreOpen()
// (lib/store-config.js) reads STORE_OPEN in the api/ functions and VITE_STORE_OPEN in the
// browser bundle, which Vite fills in when it builds. Set on their own they can disagree:
// the pages show prices while /api/checkout answers 403, or the other way round. So
// STORE_OPEN is the one flag. The bundle's VITE_STORE_OPEN is copied from it, unless
// VITE_STORE_OPEN is set itself, and a build where the two are set to different values
// fails instead of shipping a store that contradicts itself.
//
// This runs while the config loads, in Node. It is not part of the app.

// The names count as set only when they have a value: a blank line in a .env file is
// the same as no line.
const valueOf = (value) => (typeof value === 'string' && value !== '' ? value : undefined);

/**
 * The `define` entry that gives the browser bundle the same flag as the API: its
 * VITE_STORE_OPEN, copied as it is from STORE_OPEN. It is `{}` when there is nothing to
 * copy: neither flag is set (the store stays closed), only VITE_STORE_OPEN is set, or
 * both are set to the same value, so Vite already has what it needs.
 *
 * Throws if both are set to different values, which stops the build.
 *
 * In `mode` 'test' it is always `{}`. Tests set the flags themselves, and one left in a
 * developer's .env.local should not open the store for every test.
 *
 * @param {string} mode  Vite's mode.
 * @param {{ STORE_OPEN?: string, VITE_STORE_OPEN?: string }} env  Only these two are read.
 * @returns {Record<string, string>}
 */
export function storeFlagDefine(mode, env) {
  if (mode === 'test') return {};

  const server = valueOf(env.STORE_OPEN);
  const browser = valueOf(env.VITE_STORE_OPEN);

  if (server !== undefined && browser !== undefined && server !== browser) {
    throw new Error(
      `STORE_OPEN is ${JSON.stringify(server)} but VITE_STORE_OPEN is ${JSON.stringify(browser)}. ` +
        'The pages and checkout must agree on whether the store is open. ' +
        'Set only STORE_OPEN (the build copies it into the pages), or give both the same value.',
    );
  }

  if (server === undefined || browser !== undefined) return {};
  return { 'import.meta.env.VITE_STORE_OPEN': JSON.stringify(server) };
}
