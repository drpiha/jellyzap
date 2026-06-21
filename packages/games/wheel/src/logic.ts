/**
 * Pure, deterministic Wheel of Fortune / Çarkıfelek logic.
 * No DOM, no Math.random (rng is injected), no requestAnimationFrame.
 *
 * The game is a spin-the-wheel + word-guessing hybrid: the player spins a wheel
 * to set the value of the next correct letter, then guesses a letter. Correct
 * guesses reveal every occurrence of that letter and add `value × occurrences`
 * to the round score; wrong guesses cost a life. Special segments BANKRUPT and
 * LOSE_TURN punish the player. Fully revealing the word banks the round score.
 */

import { weightedIndex } from '@jellyzap/game-sdk';

/** A wheel segment is either a cash value or a special action. */
export type Segment = number | 'BANKRUPT' | 'LOSE_TURN';

/** Default wheel layout — alternating values with two punishing wedges. */
export const DEFAULT_SEGMENTS: readonly Segment[] = [
  200,
  400,
  600,
  800,
  1000,
  'BANKRUPT',
  500,
  'LOSE_TURN',
];

/**
 * Relative weights per segment index (need not sum to 1). The two big rewards
 * and the punishing wedges are rarer than the mid-range values.
 */
export const DEFAULT_WEIGHTS: readonly number[] = [
  6, // 200
  6, // 400
  5, // 600
  4, // 800
  2, // 1000
  3, // BANKRUPT
  6, // 500
  3, // LOSE_TURN
];

export const STARTING_LIVES = 5;

export type Locale = 'en' | 'tr' | 'de';

/** UPPERCASE single-word lists per locale (~40 each). */
export const WORDS: Record<Locale, readonly string[]> = {
  en: [
    'PLANET',
    'GUITAR',
    'JUNGLE',
    'MARKET',
    'ORANGE',
    'PUZZLE',
    'ROCKET',
    'SILVER',
    'TURTLE',
    'WIZARD',
    'CASTLE',
    'DRAGON',
    'FLOWER',
    'GARDEN',
    'HARBOR',
    'ISLAND',
    'KITTEN',
    'LANTERN',
    'MONKEY',
    'NEEDLE',
    'PEPPER',
    'RABBIT',
    'SUMMER',
    'THRONE',
    'VELVET',
    'WINTER',
    'ANCHOR',
    'BRIDGE',
    'CANDLE',
    'DESERT',
    'ENGINE',
    'FOREST',
    'GALAXY',
    'HAMMER',
    'JACKET',
    'LEMON',
    'MIRROR',
    'PENCIL',
    'RIVER',
    'TUNNEL',
  ],
  tr: [
    'KITAP',
    'ELMA',
    'KEDI',
    'BAHCE',
    'GUNES',
    'DENIZ',
    'YILDIZ',
    'KOPRU',
    'ORMAN',
    'CICEK',
    'BALIK',
    'KAPLAN',
    'MARKET',
    'PENCERE',
    'SOKAK',
    'TAVSAN',
    'UCURTMA',
    'VAPUR',
    'YAGMUR',
    'ZEYTIN',
    'ARABA',
    'BULUT',
    'CADIR',
    'DAMLA',
    'EKMEK',
    'FENER',
    'GEMI',
    'HALI',
    'INCIR',
    'KALEM',
    'LIMON',
    'MASA',
    'NEHIR',
    'OKUL',
    'PERDE',
    'SARAY',
    'TARAK',
    'UZUM',
    'YOLCU',
    'ZAMAN',
  ],
  de: [
    'PLANET',
    'GITARRE',
    'GARTEN',
    'BLUME',
    'SONNE',
    'FLUSS',
    'STERN',
    'BRUCKE',
    'INSEL',
    'KATZE',
    'DRACHE',
    'FENSTER',
    'STRASSE',
    'SOMMER',
    'WINTER',
    'WOLKE',
    'REGEN',
    'SCHIFF',
    'SPIEGEL',
    'KERZE',
    'WALD',
    'BERG',
    'KAESE',
    'ZITRONE',
    'APFEL',
    'VOGEL',
    'PFERD',
    'TIGER',
    'AFFE',
    'SCHULE',
    'HAFEN',
    'ANKER',
    'MOTOR',
    'RAKETE',
    'SCHLOSS',
    'HAMMER',
    'NADEL',
    'TUNNEL',
    'WUESTE',
    'GALAXIE',
  ],
};

export interface WheelState {
  /** the word being guessed (UPPERCASE, no spaces) */
  word: string;
  /** which letters have been revealed so far (length === word.length) */
  revealed: boolean[];
  /** letters already guessed (correct or not) */
  guessed: Set<string>;
  /** the wheel layout for this round */
  segments: readonly Segment[];
  /** relative weights aligned with `segments` */
  weights: readonly number[];
  /** index of the segment the wheel landed on (-1 before the first spin) */
  spinIndex: number;
  /** cash value of the current spin (0 for special/no spin) */
  currentSpinValue: number;
  /** points accumulated this round; banked into the host score on a win */
  roundScore: number;
  /** remaining lives */
  lives: number;
  /** has the player spun and not yet guessed? gate for guessing */
  awaitingGuess: boolean;
  /** true once the whole word is revealed */
  won: boolean;
  /** true once lives hit 0 */
  lost: boolean;
}

/** Pick a word for the given locale (falls back to English). */
export function pickWord(rng: () => number, locale: string): string {
  const key = (locale.slice(0, 2).toLowerCase() as Locale) in WORDS ? (locale.slice(0, 2).toLowerCase() as Locale) : 'en';
  const list = WORDS[key];
  return list[Math.floor(rng() * list.length)];
}

/** Spin the wheel — returns the landed segment index (weighted). */
export function spin(rng: () => number, weights: readonly number[]): number {
  return weightedIndex(rng, weights);
}

export interface CreateOptions {
  segments?: readonly Segment[];
  weights?: readonly number[];
  lives?: number;
  /** force a specific word (otherwise drawn from the locale list) */
  word?: string;
}

export function createWheelState(
  rng: () => number,
  locale: string,
  opts: CreateOptions = {},
): WheelState {
  const word = opts.word ?? pickWord(rng, locale);
  return {
    word,
    revealed: new Array(word.length).fill(false),
    guessed: new Set<string>(),
    segments: opts.segments ?? DEFAULT_SEGMENTS,
    weights: opts.weights ?? DEFAULT_WEIGHTS,
    spinIndex: -1,
    currentSpinValue: 0,
    roundScore: 0,
    lives: opts.lives ?? STARTING_LIVES,
    awaitingGuess: false,
    won: false,
    lost: false,
  };
}

/** True once every letter of the word is revealed. */
export function isWordComplete(state: WheelState): boolean {
  return state.revealed.every(Boolean);
}

/** The masked word, e.g. "_ A _ _ E" (revealed letters shown, others as `_`). */
export function maskedWord(state: WheelState): string {
  return state.word
    .split('')
    .map((ch, i) => (state.revealed[i] ? ch : '_'))
    .join(' ');
}

export type SpinResult =
  | { kind: 'value'; value: number; index: number }
  | { kind: 'bankrupt'; index: number }
  | { kind: 'lose_turn'; index: number };

/**
 * Resolve a spin onto a concrete segment index (the index is chosen elsewhere
 * via {@link spin} so the animation can target it). Applies BANKRUPT/LOSE_TURN
 * immediately; cash values arm `awaitingGuess`.
 */
export function applySpin(state: WheelState, index: number): SpinResult {
  if (state.won || state.lost) return { kind: 'value', value: 0, index };
  state.spinIndex = index;
  const seg = state.segments[index];

  if (seg === 'BANKRUPT') {
    state.roundScore = 0;
    state.currentSpinValue = 0;
    state.awaitingGuess = false;
    return { kind: 'bankrupt', index };
  }
  if (seg === 'LOSE_TURN') {
    state.currentSpinValue = 0;
    state.awaitingGuess = false;
    loseLife(state);
    return { kind: 'lose_turn', index };
  }
  state.currentSpinValue = seg;
  state.awaitingGuess = true;
  return { kind: 'value', value: seg, index };
}

function loseLife(state: WheelState): void {
  state.lives = Math.max(0, state.lives - 1);
  if (state.lives <= 0) state.lost = true;
}

export type GuessResult =
  | { kind: 'hit'; letter: string; count: number; gained: number; won: boolean }
  | { kind: 'miss'; letter: string }
  | { kind: 'ignored'; letter: string };

/**
 * Guess a letter. Requires a prior cash spin (`awaitingGuess`).
 * - Hit: reveal every occurrence, add `currentSpinValue × occurrences` to the
 *   round score, and disarm until the next spin.
 * - Miss: lose a life.
 * Already-guessed letters, non-letters, or guesses without a spin are ignored.
 */
export function guessLetter(state: WheelState, rawLetter: string): GuessResult {
  const letter = (rawLetter ?? '').trim().toUpperCase();
  if (state.won || state.lost) return { kind: 'ignored', letter };
  if (letter.length !== 1 || !/[A-ZÇĞİÖŞÜ]/.test(letter)) return { kind: 'ignored', letter };
  if (state.guessed.has(letter)) return { kind: 'ignored', letter };
  if (!state.awaitingGuess) return { kind: 'ignored', letter };

  state.guessed.add(letter);

  let count = 0;
  for (let i = 0; i < state.word.length; i++) {
    if (state.word[i] === letter) {
      state.revealed[i] = true;
      count++;
    }
  }

  // A guess consumes the current spin either way.
  state.awaitingGuess = false;

  if (count === 0) {
    state.currentSpinValue = 0;
    loseLife(state);
    return { kind: 'miss', letter };
  }

  const gained = state.currentSpinValue * count;
  state.roundScore += gained;
  state.currentSpinValue = 0;

  const won = isWordComplete(state);
  if (won) state.won = true;
  return { kind: 'hit', letter, count, gained, won };
}
