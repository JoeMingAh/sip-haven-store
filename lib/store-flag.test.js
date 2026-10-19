import { describe, it, expect } from 'vitest';
import { storeFlagDefine } from './store-flag.js';

const KEY = 'import.meta.env.VITE_STORE_OPEN';

describe('storeFlagDefine: STORE_OPEN is the one flag', () => {
  it('copies STORE_OPEN into the browser bundle when VITE_STORE_OPEN is not set', () => {
    expect(storeFlagDefine('production', { STORE_OPEN: 'true' })).toEqual({ [KEY]: '"true"' });
    expect(storeFlagDefine('production', { STORE_OPEN: 'false' })).toEqual({ [KEY]: '"false"' });
  });

  it('copies the value as it is, so a value that does not open the store does not open it here either', () => {
    // isStoreOpen() only opens for exactly "true", on both sides.
    expect(storeFlagDefine('production', { STORE_OPEN: 'TRUE' })).toEqual({ [KEY]: '"TRUE"' });
    expect(storeFlagDefine('production', { STORE_OPEN: '1' })).toEqual({ [KEY]: '"1"' });
  });

  it('gives a JSON string, which Vite puts into the code as a string', () => {
    const value = storeFlagDefine('production', { STORE_OPEN: 'true' })[KEY];
    expect(JSON.parse(value)).toBe('true');
  });

  it.each([
    ['unset', undefined],
    ['blank', ''],
  ])('treats a VITE_STORE_OPEN that is %s as not set', (_case, blank) => {
    expect(storeFlagDefine('production', { STORE_OPEN: 'true', VITE_STORE_OPEN: blank })).toEqual({
      [KEY]: '"true"',
    });
  });

  it('defines nothing when neither flag is set, so the store stays closed', () => {
    expect(storeFlagDefine('production', {})).toEqual({});
    expect(storeFlagDefine('production', { STORE_OPEN: '', VITE_STORE_OPEN: '' })).toEqual({});
  });

  it('defines nothing when only VITE_STORE_OPEN is set: the build already has it', () => {
    expect(storeFlagDefine('production', { VITE_STORE_OPEN: 'true' })).toEqual({});
    expect(storeFlagDefine('production', { VITE_STORE_OPEN: 'false' })).toEqual({});
  });

  it.each(['true', 'false'])('defines nothing when both are set to the same %s', (value) => {
    expect(storeFlagDefine('production', { STORE_OPEN: value, VITE_STORE_OPEN: value })).toEqual({});
  });

  it('reads only the two flags: nothing else from the environment gets into the bundle', () => {
    const define = storeFlagDefine('production', {
      STORE_OPEN: 'true',
      STRIPE_SECRET_KEY: 'sk_test_never_in_a_bundle',
      RESEND_API_KEY: 're_never_in_a_bundle',
    });
    expect(Object.keys(define)).toEqual([KEY]);
    expect(JSON.stringify(define)).not.toContain('never_in_a_bundle');
  });
});

describe('storeFlagDefine: the two flags disagree', () => {
  it.each([
    ['true', 'false'],
    ['false', 'true'],
    ['true', 'TRUE'],
    ['true', ' true'],
    ['false', '0'],
  ])('fails the build for STORE_OPEN=%j with VITE_STORE_OPEN=%j', (server, browser) => {
    expect(() =>
      storeFlagDefine('production', { STORE_OPEN: server, VITE_STORE_OPEN: browser }),
    ).toThrow(Error);
  });

  it('says which two variables, what they are set to, and how to fix it', () => {
    let message = '';
    try {
      storeFlagDefine('production', { STORE_OPEN: 'true', VITE_STORE_OPEN: 'false' });
    } catch (error) {
      message = error.message;
    }
    expect(message).toContain('STORE_OPEN');
    expect(message).toContain('VITE_STORE_OPEN');
    expect(message).toContain('"true"');
    expect(message).toContain('"false"');
    expect(message).toMatch(/set only STORE_OPEN/i);
    expect(message).toMatch(/same value/i);
  });
});

describe('storeFlagDefine: tests', () => {
  it('leaves the environment alone in test mode, so tests start closed whatever is in .env files', () => {
    expect(storeFlagDefine('test', { STORE_OPEN: 'true' })).toEqual({});
    expect(storeFlagDefine('test', { STORE_OPEN: 'true', VITE_STORE_OPEN: 'false' })).toEqual({});
  });

  it.each(['production', 'development', 'staging'])('applies in %s mode', (mode) => {
    expect(storeFlagDefine(mode, { STORE_OPEN: 'true' })).toEqual({ [KEY]: '"true"' });
  });
});
