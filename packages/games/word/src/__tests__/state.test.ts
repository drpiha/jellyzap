import { describe, expect, it } from 'vitest';
import { mulberry32 } from '@jellyzap/game-sdk';
import {
  MAX_GUESSES,
  attemptsLeft,
  backspace,
  createWordState,
  submitGuess,
  typeLetter,
  type WordState,
} from '../logic';

/** A fresh playing state with a fixed English answer for deterministic assertions. */
function stateWithAnswer(answer: string): WordState {
  const s = createWordState(mulberry32(1), 'en');
  s.answer = answer;
  s.guesses = [];
  s.statuses = [];
  s.current = '';
  s.status = 'playing';
  s.keyStatus = {};
  return s;
}

function type(s: WordState, word: string): void {
  for (const ch of word) typeLetter(s, ch);
}

describe('word state machine', () => {
  it('typeLetter caps at WORD_LENGTH and backspace removes the last letter', () => {
    const s = stateWithAnswer('CRANE');
    type(s, 'CRANES'); // 6 chars typed
    expect(s.current).toBe('CRANE');
    expect(typeLetter(s, 'X')).toBe(false); // already full
    expect(backspace(s)).toBe(true);
    expect(s.current).toBe('CRAN');
  });

  it('submitGuess rejects a short row without recording a guess', () => {
    const s = stateWithAnswer('CRANE');
    type(s, 'CRA');
    expect(submitGuess(s)).toBe('invalid-length');
    expect(s.message).toBe('short');
    expect(s.guesses).toHaveLength(0);
  });

  it('submitGuess rejects a 5-letter word that is not in the list', () => {
    const s = stateWithAnswer('CRANE');
    type(s, 'ZZZZZ');
    expect(submitGuess(s)).toBe('invalid-word');
    expect(s.message).toBe('unknown');
    expect(s.guesses).toHaveLength(0);
  });

  it('a correct guess wins and blocks further input', () => {
    const s = stateWithAnswer('CRANE');
    type(s, 'CRANE');
    expect(submitGuess(s)).toBe('won');
    expect(s.status).toBe('won');
    expect(typeLetter(s, 'A')).toBe(false);
    expect(submitGuess(s)).toBe('continue'); // no-op once finished
  });

  it('loses after MAX_GUESSES valid-but-wrong words', () => {
    const s = stateWithAnswer('CRANE');
    const wrong = ['HOUSE', 'PLANT', 'TIGER', 'BREAD', 'MONEY', 'WORLD'];
    expect(wrong).toHaveLength(MAX_GUESSES);
    let last = '';
    for (const w of wrong) {
      type(s, w);
      last = submitGuess(s);
    }
    expect(last).toBe('lost');
    expect(s.status).toBe('lost');
    expect(attemptsLeft(s)).toBe(0);
  });

  it('keyboard status only upgrades, never downgrades (present → correct)', () => {
    const s = stateWithAnswer('SHEEP'); // two E's, at indices 2 and 3
    type(s, 'EAGLE');
    submitGuess(s);
    expect(s.keyStatus['E']).toBe('present');
    type(s, 'GREEN');
    submitGuess(s);
    expect(s.keyStatus['E']).toBe('correct'); // upgraded, not knocked back down
  });
});
