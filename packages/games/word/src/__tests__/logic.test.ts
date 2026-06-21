import { describe, expect, it } from 'vitest';
import { mulberry32 } from '@jellyzap/game-sdk';
import {
  WORD_LISTS,
  WORD_LENGTH,
  type WordLocale,
  isValidWord,
  isWin,
  pickAnswer,
  scoreGuess,
} from '../logic';

const LOCALES: WordLocale[] = ['en', 'tr', 'de'];

describe('word logic — scoreGuess', () => {
  it('marks every tile correct when the guess equals the answer', () => {
    expect(scoreGuess('CRANE', 'CRANE')).toEqual([
      'correct',
      'correct',
      'correct',
      'correct',
      'correct',
    ]);
  });

  it('marks every tile absent when no letter is shared', () => {
    // Answer and guess share no letters at all.
    expect(scoreGuess('FGHJK', 'BCDLM')).toEqual([
      'absent',
      'absent',
      'absent',
      'absent',
      'absent',
    ]);
  });

  it('marks present for right letter in the wrong position', () => {
    // answer WORLD; guess LWXYZ → L present (in WORLD elsewhere), W present, rest absent.
    expect(scoreGuess('LWXYZ', 'WORLD')).toEqual([
      'present',
      'present',
      'absent',
      'absent',
      'absent',
    ]);
  });

  it('handles duplicate letters in the guess via the two-pass algorithm', () => {
    // DUPLICATE CASE — documented:
    //   answer = "ALERT" contains exactly ONE 'L' and ONE 'A'.
    //   guess  = "LLAMA" contains TWO 'L's (positions 0,1) and TWO 'A's (positions 2,4).
    // Expected, per standard Wordle scoring:
    //   pos0 'L' -> absent  (the answer's single L is consumed by the exact match below)
    //   pos1 'L' -> correct (aligns with the L in ALERT)
    //   pos2 'A' -> present (answer has one A, not at this position)
    //   pos3 'M' -> absent  (not in the answer)
    //   pos4 'A' -> absent  (the answer's only A was already consumed at pos2)
    // i.e. only the ONE matching copy of each duplicated letter is colored; extras are 'absent'.
    const statuses = scoreGuess('LLAMA', 'ALERT');
    expect(statuses).toEqual(['absent', 'correct', 'present', 'absent', 'absent']);

    // Exactly one 'L' tile is colored (green/yellow) and exactly one 'A' tile is colored.
    const colored = (i: number) => statuses[i] === 'correct' || statuses[i] === 'present';
    const lTiles = [0, 1].filter(colored);
    const aTiles = [2, 4].filter(colored);
    expect(lTiles).toHaveLength(1);
    expect(aTiles).toHaveLength(1);
    // The extra (second) copy of each duplicated letter is 'absent'.
    expect(statuses[0]).toBe('absent'); // extra L
    expect(statuses[4]).toBe('absent'); // extra A
  });

  it('caps colored copies of a letter at the number in the answer', () => {
    // answer SHEEP has TWO 'E's (positions 2,3); guess EEEXY has THREE 'E's.
    // Position 2 'E' is an exact match (correct); one more E can be 'present';
    // the third E exceeds the answer's two copies and must be 'absent'.
    const statuses = scoreGuess('EEEXY', 'SHEEP');
    expect(statuses).toEqual(['present', 'absent', 'correct', 'absent', 'absent']);
    // Exactly TWO E tiles are colored (one correct + one present) — matching the
    // answer's count — and the surplus E is 'absent'.
    const coloredE = [0, 1, 2].filter((i) => statuses[i] !== 'absent').length;
    expect(coloredE).toBe(2);
  });
});

describe('word logic — isWin', () => {
  it('is true only when all five tiles are correct', () => {
    expect(isWin(['correct', 'correct', 'correct', 'correct', 'correct'])).toBe(true);
    expect(isWin(['correct', 'correct', 'present', 'correct', 'correct'])).toBe(false);
    expect(isWin(['absent', 'absent', 'absent', 'absent', 'absent'])).toBe(false);
    // Wrong length is never a win.
    expect(isWin(['correct', 'correct', 'correct', 'correct'])).toBe(false);
  });
});

describe('word logic — pickAnswer & word lists', () => {
  it.each(LOCALES)('pickAnswer(%s) returns a 5-letter word from the locale list (seeded)', (loc) => {
    const rng = mulberry32(42);
    const answer = pickAnswer(rng, loc);
    expect(Array.from(answer)).toHaveLength(WORD_LENGTH);
    expect(WORD_LISTS[loc]).toContain(answer);
    expect(isValidWord(answer, loc)).toBe(true);
  });

  it.each(LOCALES)('every word in the %s list is exactly five code points', (loc) => {
    for (const w of WORD_LISTS[loc]) {
      expect(Array.from(w)).toHaveLength(WORD_LENGTH);
    }
  });

  it('pickAnswer is deterministic for a fixed seed', () => {
    expect(pickAnswer(mulberry32(7), 'en')).toBe(pickAnswer(mulberry32(7), 'en'));
  });
});
