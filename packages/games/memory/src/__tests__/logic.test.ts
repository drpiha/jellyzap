import { describe, expect, it } from 'vitest';
import { mulberry32 } from '@jellyzap/game-sdk';
import {
  DEFAULT_PAIRS,
  allMatched,
  checkMatch,
  computeScore,
  createDeck,
  createMemoryState,
  flip,
  resolvePair,
  type Card,
} from '../logic';

const seeded = () => mulberry32(123);

function countSymbols(cards: Card[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const c of cards) m.set(c.symbol, (m.get(c.symbol) ?? 0) + 1);
  return m;
}

describe('memory logic', () => {
  it('createDeck returns 2*pairs cards with each symbol exactly twice', () => {
    const pairs = 8;
    const deck = createDeck(seeded(), pairs);
    expect(deck).toHaveLength(2 * pairs);
    const counts = countSymbols(deck);
    expect(counts.size).toBe(pairs);
    for (const n of counts.values()) expect(n).toBe(2);
  });

  it('defaults to 8 pairs (4x4 board)', () => {
    const deck = createDeck(seeded());
    expect(deck).toHaveLength(2 * DEFAULT_PAIRS);
    expect(DEFAULT_PAIRS).toBe(8);
  });

  it('assigns unique sequential ids and starts face-down/unmatched', () => {
    const deck = createDeck(seeded(), 6);
    deck.forEach((c, i) => {
      expect(c.id).toBe(i);
      expect(c.faceUp).toBe(false);
      expect(c.matched).toBe(false);
    });
  });

  it('produces a deterministic seeded permutation', () => {
    const a = createDeck(mulberry32(42), 8).map((c) => c.symbol);
    const b = createDeck(mulberry32(42), 8).map((c) => c.symbol);
    const c = createDeck(mulberry32(43), 8).map((card) => card.symbol);
    expect(a).toEqual(b); // same seed → same layout
    expect(a).not.toEqual(c); // different seed → different layout
  });

  it('flip turns a card face-up', () => {
    const deck = createDeck(seeded(), 4);
    expect(deck[0].faceUp).toBe(false);
    flip(deck[0]);
    expect(deck[0].faceUp).toBe(true);
  });

  it('two identical symbols are a match', () => {
    const a: Card = { id: 0, symbol: '🍒', matched: false, faceUp: true };
    const b: Card = { id: 1, symbol: '🍒', matched: false, faceUp: true };
    expect(checkMatch(a, b)).toBe(true);
  });

  it('two different symbols are not a match', () => {
    const a: Card = { id: 0, symbol: '🍒', matched: false, faceUp: true };
    const b: Card = { id: 1, symbol: '🍋', matched: false, faceUp: true };
    expect(checkMatch(a, b)).toBe(false);
  });

  it('the same card is never a match with itself', () => {
    const a: Card = { id: 0, symbol: '🍒', matched: false, faceUp: true };
    expect(checkMatch(a, a)).toBe(false);
  });

  it('allMatched is true only when every card is matched', () => {
    const deck = createDeck(seeded(), 3);
    expect(allMatched(deck)).toBe(false);
    deck.forEach((c, i) => {
      if (i < deck.length - 1) c.matched = true;
    });
    expect(allMatched(deck)).toBe(false); // one still unmatched
    deck[deck.length - 1].matched = true;
    expect(allMatched(deck)).toBe(true);
  });

  it('allMatched is false for an empty deck', () => {
    expect(allMatched([])).toBe(false);
  });

  it('move counter increments once per attempt (match and mismatch)', () => {
    const state = createMemoryState(seeded(), 8);
    const cards = state.cards;
    // find a matching pair by symbol
    const first = cards[0];
    const matePair = cards.find((c) => c.id !== first.id && c.symbol === first.symbol)!;
    const different = cards.find((c) => c.symbol !== first.symbol)!;

    expect(state.moves).toBe(0);

    // a mismatch counts as one move and does not mark matched
    const mismatched = resolvePair(state, first, different);
    expect(mismatched).toBe(false);
    expect(state.moves).toBe(1);
    expect(first.matched).toBe(false);
    expect(different.matched).toBe(false);
    expect(state.found).toBe(0);

    // a match counts as another move, marks both, bumps found
    const matched = resolvePair(state, first, matePair);
    expect(matched).toBe(true);
    expect(state.moves).toBe(2);
    expect(first.matched).toBe(true);
    expect(matePair.matched).toBe(true);
    expect(state.found).toBe(1);
  });

  it('sets won and is scored only when all pairs are matched', () => {
    const state = createMemoryState(seeded(), 3);
    expect(computeScore(state)).toBe(0); // not won yet

    // match every pair in turn
    const remaining = [...state.cards];
    while (remaining.length > 0) {
      const a = remaining.shift()!;
      const idx = remaining.findIndex((c) => c.symbol === a.symbol);
      const b = remaining.splice(idx, 1)[0];
      resolvePair(state, a, b);
    }

    expect(state.found).toBe(3);
    expect(state.won).toBe(true);
    expect(allMatched(state.cards)).toBe(true);
    // 3 moves: base 1000 - 60 = 940, + 200 win bonus
    expect(computeScore(state)).toBe(940 + 200);
  });

  it('score never goes negative with many moves', () => {
    const state = createMemoryState(seeded(), 2);
    state.won = true;
    state.moves = 1000;
    expect(computeScore(state)).toBeGreaterThanOrEqual(0);
  });
});
