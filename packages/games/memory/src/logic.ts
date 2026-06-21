/** Pure, deterministic Memory (card-matching) logic — no DOM, no Math.random
 * (rng is injected), no timers. The host drives the flip-back delay via update(dt). */

import { shuffle } from '@jellyzap/game-sdk';

export interface Card {
  /** stable index into the deck (also its grid position) */
  id: number;
  /** the symbol/emoji shown on the face; matching cards share a symbol */
  symbol: string;
  /** true once this card has been matched with its pair */
  matched: boolean;
  /** true while the face is shown (selected, or being compared) */
  faceUp: boolean;
}

export interface MemoryState {
  cards: Card[];
  /** number of distinct symbols (so 2*pairs cards total) */
  pairs: number;
  /** completed attempts: increments once per second card revealed */
  moves: number;
  /** pairs successfully matched so far */
  found: number;
  /** true once every card is matched */
  won: boolean;
}

/** Default symbol pool — enough distinct emoji for large boards. */
export const SYMBOLS: readonly string[] = [
  '🍒',
  '🍋',
  '🍇',
  '🍉',
  '🍓',
  '🍑',
  '🍍',
  '🥝',
  '🍌',
  '🥥',
  '🍊',
  '🫐',
  '🍐',
  '🥕',
  '🌶️',
  '🍆',
] as const;

export const DEFAULT_PAIRS = 8;

/**
 * Build a shuffled deck of `2 * pairs` cards. Each of the first `pairs` symbols
 * appears exactly twice. The order is a seeded permutation, so the same rng
 * sequence always yields the same layout.
 */
export function createDeck(rng: () => number, pairs: number = DEFAULT_PAIRS): Card[] {
  const n = Math.min(pairs, SYMBOLS.length);
  const chosen = SYMBOLS.slice(0, n);
  const doubled: string[] = [];
  for (const s of chosen) {
    doubled.push(s, s);
  }
  const order = shuffle(rng, doubled);
  return order.map((symbol, id) => ({ id, symbol, matched: false, faceUp: false }));
}

/** Fresh game state with a seeded deck. */
export function createMemoryState(rng: () => number, pairs: number = DEFAULT_PAIRS): MemoryState {
  const n = Math.min(pairs, SYMBOLS.length);
  return {
    cards: createDeck(rng, n),
    pairs: n,
    moves: 0,
    found: 0,
    won: false,
  };
}

/** Reveal a card's face. Pure mutation; returns the same card for chaining. */
export function flip(card: Card): Card {
  card.faceUp = true;
  return card;
}

/** Hide a card's face (used when a mismatched pair is turned back). */
export function unflip(card: Card): Card {
  if (!card.matched) card.faceUp = false;
  return card;
}

/** Two cards match when they are distinct cards sharing the same symbol. */
export function checkMatch(a: Card, b: Card): boolean {
  return a.id !== b.id && a.symbol === b.symbol;
}

/** True only when every card in the deck has been matched. */
export function allMatched(cards: readonly Card[]): boolean {
  return cards.length > 0 && cards.every((c) => c.matched);
}

/**
 * Resolve the two currently face-up, unmatched selections.
 * On a match: marks both matched, bumps `found` and `moves`, sets `won` if done.
 * On a mismatch: bumps `moves` only; the caller flips them back after a delay.
 * Returns whether the pair matched.
 */
export function resolvePair(state: MemoryState, a: Card, b: Card): boolean {
  state.moves += 1;
  if (checkMatch(a, b)) {
    a.matched = true;
    b.matched = true;
    state.found += 1;
    if (allMatched(state.cards)) state.won = true;
    return true;
  }
  return false;
}

/**
 * Score: fewer moves is better. A perfect game uses exactly `pairs` moves; every
 * extra attempt costs points. A flat win bonus rewards completion. Never negative.
 */
export function computeScore(state: MemoryState): number {
  if (!state.won) return 0;
  const base = Math.max(0, 1000 - state.moves * 20);
  return base + 200;
}
