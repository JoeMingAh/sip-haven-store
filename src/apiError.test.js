import { describe, it, expect } from 'vitest';
import { GENERIC_ERROR, errorFrom } from './apiError.js';

const reply = (status, body) => ({ ok: false, status, json: async () => body });

describe('apiError', () => {
  it('has the one generic message every form falls back on', () => {
    expect(GENERIC_ERROR).toBe('Something went wrong. Please try again.');
  });

  it("returns the server's error text", async () => {
    await expect(errorFrom(reply(400, { error: 'That item is no longer available.' }))).resolves.toBe(
      'That item is no longer available.',
    );
  });

  it.each([
    ['an empty body', reply(500, {})],
    ['a null body', reply(500, null)],
    ['a blank error', reply(500, { error: '   ' })],
    ['an error that is not text', reply(500, { error: { code: 1 } })],
    ['a body that is not JSON', { json: async () => { throw new SyntaxError('Unexpected token <'); } }],
    ['a response with no json method', {}],
  ])('falls back to the generic message for %s', async (_name, response) => {
    await expect(errorFrom(response)).resolves.toBe(GENERIC_ERROR);
  });
});
