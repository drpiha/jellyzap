import { describe, expect, it } from 'vitest';
import { mulberry32 } from '@jellyzap/game-sdk';
import {
  DEFAULT_SEGMENTS,
  DEFAULT_WEIGHTS,
  WORDS,
  applySpin,
  createWheelState,
  guessLetter,
  isWordComplete,
  maskedWord,
  pickWord,
  spin,
  type Locale,
} from '../logic';

const seeded = (n = 1) => mulberry32(n);

describe('wheel — word lists', () => {
  it('has ~40 uppercase single words per locale', () => {
    for (const loc of ['en', 'tr', 'de'] as Locale[]) {
      const list = WORDS[loc];
      expect(list.length).toBeGreaterThanOrEqual(38);
      for (const w of list) {
        expect(w).toBe(w.toUpperCase());
        expect(w).not.toContain(' ');
        expect(w.length).toBeGreaterThan(2);
      }
    }
  });

  it('pickWord returns a word from the locale list and falls back to en', () => {
    const en = pickWord(seeded(5), 'en');
    expect(WORDS.en).toContain(en);
    const tr = pickWord(seeded(5), 'tr-TR');
    expect(WORDS.tr).toContain(tr);
    const fallback = pickWord(seeded(5), 'fr');
    expect(WORDS.en).toContain(fallback);
  });
});

describe('wheel — spin', () => {
  it('returns a valid segment index', () => {
    for (let s = 0; s < 50; s++) {
      const idx = spin(seeded(s), DEFAULT_WEIGHTS);
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(DEFAULT_SEGMENTS.length);
      expect(Number.isInteger(idx)).toBe(true);
    }
  });

  it('distribution over many seeded spins roughly matches the weights', () => {
    const rng = seeded(42);
    const N = 40000;
    const counts = new Array(DEFAULT_WEIGHTS.length).fill(0);
    for (let i = 0; i < N; i++) counts[spin(rng, DEFAULT_WEIGHTS)]++;

    const total = DEFAULT_WEIGHTS.reduce((a, b) => a + b, 0);
    for (let i = 0; i < DEFAULT_WEIGHTS.length; i++) {
      const expected = DEFAULT_WEIGHTS[i] / total;
      const actual = counts[i] / N;
      // allow a generous absolute tolerance for sampling noise
      expect(Math.abs(actual - expected)).toBeLessThan(0.03);
    }
  });
});

describe('wheel — guessing', () => {
  it('reveals all positions of a correct letter and adds value × count', () => {
    const s = createWheelState(seeded(), 'en', { word: 'BANANA' });
    applySpin(s, 0); // segment 0 === 200
    expect(s.currentSpinValue).toBe(200);
    expect(s.awaitingGuess).toBe(true);

    const res = guessLetter(s, 'A');
    expect(res.kind).toBe('hit');
    if (res.kind === 'hit') {
      expect(res.count).toBe(3);
      expect(res.gained).toBe(600);
    }
    expect(s.roundScore).toBe(600);
    // every A revealed, others still hidden
    expect(maskedWord(s)).toBe('_ A _ A _ A');
    // a spin is consumed; must spin again before next guess
    expect(s.awaitingGuess).toBe(false);
  });

  it('costs a life when guessing a letter not in the word', () => {
    const s = createWheelState(seeded(), 'en', { word: 'PLANET', lives: 5 });
    applySpin(s, 2); // 600
    const res = guessLetter(s, 'Z');
    expect(res.kind).toBe('miss');
    expect(s.lives).toBe(4);
    expect(s.roundScore).toBe(0);
  });

  it('ignores a guess made without a prior spin', () => {
    const s = createWheelState(seeded(), 'en', { word: 'PLANET' });
    const res = guessLetter(s, 'P');
    expect(res.kind).toBe('ignored');
    expect(s.lives).toBe(5);
    expect(s.revealed.some(Boolean)).toBe(false);
  });

  it('ignores an already-guessed letter', () => {
    const s = createWheelState(seeded(), 'en', { word: 'PLANET' });
    applySpin(s, 0);
    expect(guessLetter(s, 'P').kind).toBe('hit');
    applySpin(s, 0);
    const again = guessLetter(s, 'P');
    expect(again.kind).toBe('ignored');
    expect(s.awaitingGuess).toBe(true); // spin still available
  });
});

describe('wheel — special segments', () => {
  it('BANKRUPT zeroes the round score', () => {
    const s = createWheelState(seeded(), 'en', { word: 'PLANET' });
    // build up some score first
    applySpin(s, 4); // 1000
    guessLetter(s, 'P');
    expect(s.roundScore).toBeGreaterThan(0);

    const idx = DEFAULT_SEGMENTS.indexOf('BANKRUPT');
    const res = applySpin(s, idx);
    expect(res.kind).toBe('bankrupt');
    expect(s.roundScore).toBe(0);
    expect(s.awaitingGuess).toBe(false);
    expect(s.currentSpinValue).toBe(0);
  });

  it('LOSE_TURN costs a life and does not arm a guess', () => {
    const s = createWheelState(seeded(), 'en', { word: 'PLANET', lives: 5 });
    const idx = DEFAULT_SEGMENTS.indexOf('LOSE_TURN');
    const res = applySpin(s, idx);
    expect(res.kind).toBe('lose_turn');
    expect(s.lives).toBe(4);
    expect(s.awaitingGuess).toBe(false);
  });
});

describe('wheel — win / lose', () => {
  it('detects a win when all letters are revealed and banks the score', () => {
    const s = createWheelState(seeded(), 'en', { word: 'CAT' });
    applySpin(s, 0); // 200
    guessLetter(s, 'C');
    applySpin(s, 0);
    guessLetter(s, 'A');
    applySpin(s, 0);
    const last = guessLetter(s, 'T');
    expect(last.kind).toBe('hit');
    if (last.kind === 'hit') expect(last.won).toBe(true);
    expect(s.won).toBe(true);
    expect(isWordComplete(s)).toBe(true);
    expect(s.roundScore).toBe(600);
  });

  it('loses at 0 lives from repeated wrong guesses', () => {
    const s = createWheelState(seeded(), 'en', { word: 'CAT', lives: 2 });
    applySpin(s, 0);
    expect(guessLetter(s, 'X').kind).toBe('miss');
    expect(s.lost).toBe(false);
    applySpin(s, 0);
    expect(guessLetter(s, 'Z').kind).toBe('miss');
    expect(s.lives).toBe(0);
    expect(s.lost).toBe(true);
    // further play is ignored once lost
    applySpin(s, 0);
    expect(guessLetter(s, 'C').kind).toBe('ignored');
  });
});
