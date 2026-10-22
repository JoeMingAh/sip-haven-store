import { describe, it, expect } from 'vitest';
import { MAX_RECOMMENDATIONS } from './quiz.js';
import { NOTE_ANSWER_FIELDS, noteFrom, notePathname } from './quiz-notes.js';

const BODY = {
  drink: 'coffee',
  mood: 'focused',
  caffeine: 'high',
  flavor: 'earthy',
  aroma: 'toasty',
  style: 'quick',
  picks: 1,
};

describe('noteFrom', () => {
  it('keeps the six answers and the picks count, and adds the store setting', () => {
    expect(noteFrom(BODY, { storeOpen: true })).toEqual({ ...BODY, storeOpen: true });
  });

  it('has the quiz questions as its answer fields, in order', () => {
    expect(NOTE_ANSWER_FIELDS).toEqual(['drink', 'mood', 'caffeine', 'flavor', 'aroma', 'style']);
  });

  it('keeps the mood of a no-match quiz, and stores a mood that is not an answer as null', () => {
    expect(noteFrom({ drink: 'tea', mood: 'cozy', picks: 0 }, { storeOpen: true })).toMatchObject({
      mood: 'cozy',
      picks: 0,
    });
    expect(noteFrom({ drink: 'tea', mood: 'sleepy', picks: 0 }, { storeOpen: true }).mood).toBeNull();
  });

  it('keeps nothing else from the body', () => {
    const note = noteFrom({ ...BODY, email: 'a@b.co', ip: '1.2.3.4', ua: 'x' }, { storeOpen: false });
    expect(Object.keys(note)).toEqual([...NOTE_ANSWER_FIELDS, 'picks', 'storeOpen']);
  });

  it('stores an unknown or missing answer as null', () => {
    expect(noteFrom({ drink: 'tea', caffeine: 'lots', picks: 0 }, { storeOpen: false })).toEqual({
      drink: 'tea',
      mood: null,
      caffeine: null,
      flavor: null,
      aroma: null,
      style: null,
      picks: 0,
      storeOpen: false,
    });
  });

  it.each([0, MAX_RECOMMENDATIONS])('accepts picks of %i', (picks) => {
    expect(noteFrom({ ...BODY, picks }, { storeOpen: true }).picks).toBe(picks);
  });

  it.each([
    ['no valid answer', { drink: 'soda', picks: 0 }],
    ['picks missing', { drink: 'tea' }],
    ['picks too high', { ...BODY, picks: MAX_RECOMMENDATIONS + 1 }],
    ['picks negative', { ...BODY, picks: -1 }],
    ['picks as text', { ...BODY, picks: '1' }],
    ['no body', undefined],
  ])('gives null for %s', (_case, body) => {
    expect(noteFrom(body, { storeOpen: true })).toBeNull();
  });
});

describe('notePathname', () => {
  it('files a note under its UTC day', () => {
    expect(notePathname(new Date('2026-10-20T23:59:59Z'), 'abc')).toBe('quiz-notes/2026-10-20/abc.json');
    expect(notePathname(new Date('2026-10-20T20:00:00-07:00'), 'abc')).toBe(
      'quiz-notes/2026-10-21/abc.json',
    );
  });
});
