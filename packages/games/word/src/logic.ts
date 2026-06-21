/** Pure, deterministic Word (Wordle-style) logic — no DOM, no Math.random (rng is injected). */

export type LetterStatus = 'correct' | 'present' | 'absent';
export type WordLocale = 'en' | 'tr' | 'de';

export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;

/**
 * Per-locale UPPERCASE word lists of common 5-letter words.
 * Turkish entries use real Turkish letters (Ç, Ş, Ğ, Ü, Ö, İ) where natural.
 * Counting is done by code point, so the dotted/dotless I distinction is preserved.
 */
export const WORD_LISTS: Record<WordLocale, readonly string[]> = {
  en: [
    'APPLE', 'BEACH', 'BRAIN', 'BREAD', 'BRICK', 'BRUSH', 'CHAIR', 'CHEST', 'CLOCK', 'CLOUD',
    'CRANE', 'DANCE', 'DREAM', 'DRINK', 'EAGLE', 'EARTH', 'FAITH', 'FIELD', 'FLAME', 'FLASH',
    'FLOOR', 'FRESH', 'FRUIT', 'GHOST', 'GLASS', 'GRAPE', 'GRASS', 'GREEN', 'HEART', 'HOUSE',
    'JUICE', 'KNIFE', 'LIGHT', 'LEMON', 'MONEY', 'MOUSE', 'MUSIC', 'NIGHT', 'OCEAN', 'PAINT',
    'PEACE', 'PHONE', 'PIANO', 'PLANT', 'PLATE', 'POWER', 'QUEEN', 'QUICK', 'QUIET', 'RIVER',
    'ROBOT', 'ROUND', 'SHARP', 'SHEEP', 'SHINE', 'SHIRT', 'SMILE', 'SNAKE', 'SOUND', 'SPACE',
    'SPARK', 'SPOON', 'STONE', 'STORM', 'SUGAR', 'SWEET', 'TABLE', 'TIGER', 'TOAST', 'TOWER',
    'TRAIN', 'TREND', 'TRUCK', 'WATCH', 'WATER', 'WHALE', 'WHEAT', 'WORLD', 'YOUTH', 'ZEBRA',
  ],
  tr: [
    'ABLUK', 'AKŞAM', 'ARABA', 'ARMUT', 'BADEM', 'BALIK', 'BARIŞ', 'BAYIR', 'BEBEK', 'BİBER',
    'BİLET', 'BULUT', 'BURUN', 'ÇAKIL', 'ÇELİK', 'ÇİÇEK', 'ÇİZGİ', 'ÇOBAN', 'ÇORAP', 'ÇORBA',
    'DAVET', 'DEMİR', 'DUMAN', 'DÜNYA', 'EKMEK', 'ELMAS', 'GÖLGE', 'GÜNEŞ', 'GÜVEN', 'HABER',
    'HAYAL', 'HAYAT', 'HEDEF', 'HEKİM', 'GÜZEL', 'İNSAN', 'KADIN', 'KALEM', 'KARGA', 'KAVUN',
    'KAYIK', 'KEBAP', 'KİRAZ', 'KİTAP', 'KÖMÜR', 'KÖPEK', 'KÖPRÜ', 'LİMON', 'MARUL', 'MASAL',
    'MEYVE', 'ORMAN', 'OYNAK', 'PASTA', 'PATEN', 'SABAH', 'SALON', 'SARAY', 'SEBZE', 'SİMİT',
    'ŞEHİR', 'ŞEKER', 'BAHAR', 'TABAK', 'TARAK', 'TAVUK', 'TUZAK', 'VAGON', 'YANIT', 'YATAK',
    'YEMEK', 'YILAN', 'YOLCU', 'ZEMİN', 'YEŞİL', 'ÜZGÜN', 'MUTLU', 'ÖĞLEN', 'ÇADIR', 'ÇOCUK',
  ],
  de: [
    'ABEND', 'AFFEN', 'APFEL', 'BIRNE', 'BLUME', 'BODEN', 'BRIEF', 'DACHS', 'EISEN', 'ENGEL',
    'ESSEN', 'FEDER', 'FISCH', 'FLUSS', 'GABEL', 'GEIST', 'GLANZ', 'HONIG', 'HUNDE', 'JACKE',
    'KÄFER', 'KATER', 'KETTE', 'KLANG', 'KÖNIG', 'KRONE', 'LAMPE', 'LEBEN', 'LICHT', 'MAUER',
    'MILCH', 'MUSIK', 'NACHT', 'NEBEL', 'NUDEL', 'OZEAN', 'PFERD', 'PIANO', 'PLATZ', 'PUNKT',
    'REGEN', 'REICH', 'RIESE', 'SALAT', 'SCHAF', 'SEGEL', 'SONNE', 'SPIEL', 'STADT', 'STEIN',
    'STERN', 'STUHL', 'STURM', 'TAFEL', 'TASSE', 'TIGER', 'TISCH', 'TRAUM', 'VOGEL', 'WAGEN',
    'KRAFT', 'WANGE', 'WELLE', 'WIESE', 'WOLKE', 'ZEBRA', 'FROST', 'ZWERG', 'BLATT', 'BLITZ',
    'DONAU', 'BRUST', 'WURST', 'HASEN', 'INSEL', 'KISTE', 'LÖWEN', 'KREIS', 'STAUB', 'RABEN',
  ],
};

/** Pick a random answer from the locale's word list using the injected RNG. */
export function pickAnswer(rng: () => number, locale: WordLocale): string {
  const list = WORD_LISTS[locale] ?? WORD_LISTS.en;
  return list[Math.floor(rng() * list.length)];
}

/** True when `word` (case-insensitively) is in the locale's list. */
export function isValidWord(word: string, locale: WordLocale): boolean {
  const list = WORD_LISTS[locale] ?? WORD_LISTS.en;
  const upper = localeUpper(word, locale).trim();
  return list.includes(upper);
}

/**
 * Score a guess against the answer using the STANDARD two-pass Wordle algorithm.
 *
 * Pass 1: mark every exact-position match as 'correct' and decrement that
 *   letter's remaining count in the answer.
 * Pass 2: for the still-unmarked tiles, mark 'present' only while there are
 *   remaining (unconsumed) copies of that letter in the answer; otherwise
 *   'absent'. This makes duplicate letters behave correctly — extra copies in
 *   the guess beyond what the answer holds are reported as 'absent'.
 *
 * Both inputs are compared in upper case and by code point (Array.from), so
 * multi-byte / Turkish letters are handled as single units.
 */
export function scoreGuess(guess: string, answer: string): LetterStatus[] {
  const g = Array.from(guess.toUpperCase());
  const a = Array.from(answer.toUpperCase());
  const n = Math.max(g.length, a.length);

  const result: LetterStatus[] = new Array(n).fill('absent');
  const remaining = new Map<string, number>();
  for (const ch of a) remaining.set(ch, (remaining.get(ch) ?? 0) + 1);

  // Pass 1 — exact matches consume a copy of the letter.
  for (let i = 0; i < n; i++) {
    if (g[i] !== undefined && g[i] === a[i]) {
      result[i] = 'correct';
      remaining.set(g[i], (remaining.get(g[i]) ?? 0) - 1);
    }
  }

  // Pass 2 — present, limited by the remaining (unconsumed) letter counts.
  for (let i = 0; i < n; i++) {
    if (result[i] === 'correct' || g[i] === undefined) continue;
    const left = remaining.get(g[i]) ?? 0;
    if (left > 0) {
      result[i] = 'present';
      remaining.set(g[i], left - 1);
    }
  }

  return result;
}

/** A row of statuses is a win only when every tile is 'correct'. */
export function isWin(statuses: readonly LetterStatus[]): boolean {
  return statuses.length === WORD_LENGTH && statuses.every((s) => s === 'correct');
}

/** Locale-aware upper casing (Turkish i → İ, ı stays). */
export function localeUpper(word: string, locale: WordLocale): string {
  if (locale === 'tr') return word.toLocaleUpperCase('tr-TR');
  if (locale === 'de') return word.toLocaleUpperCase('de-DE');
  return word.toUpperCase();
}

export interface WordState {
  locale: WordLocale;
  answer: string;
  /** submitted guesses, each an UPPERCASE string of length WORD_LENGTH */
  guesses: string[];
  /** scored statuses parallel to `guesses` */
  statuses: LetterStatus[][];
  /** the row currently being typed (not yet submitted) */
  current: string;
  status: 'playing' | 'won' | 'lost';
  /** transient message key/text shown under the grid */
  message: string;
  /** best status seen per letter, for keyboard coloring */
  keyStatus: Record<string, LetterStatus>;
}

/** Create a fresh game state with a freshly picked answer. */
export function createWordState(rng: () => number, locale: WordLocale): WordState {
  return {
    locale,
    answer: pickAnswer(rng, locale),
    guesses: [],
    statuses: [],
    current: '',
    status: 'playing',
    message: '',
    keyStatus: {},
  };
}

/** Append a typed letter to the current row (no-op when full or finished). */
export function typeLetter(state: WordState, letter: string): boolean {
  if (state.status !== 'playing') return false;
  if (Array.from(state.current).length >= WORD_LENGTH) return false;
  const up = localeUpper(letter, state.locale);
  if (Array.from(up).length !== 1) return false;
  state.current += up;
  state.message = '';
  return true;
}

/** Remove the last letter from the current row. */
export function backspace(state: WordState): boolean {
  if (state.status !== 'playing') return false;
  const chars = Array.from(state.current);
  if (chars.length === 0) return false;
  chars.pop();
  state.current = chars.join('');
  state.message = '';
  return true;
}

export type SubmitResult = 'invalid-length' | 'invalid-word' | 'won' | 'lost' | 'continue';

/** Try to submit the current row. Mutates `state`. Returns what happened. */
export function submitGuess(state: WordState): SubmitResult {
  if (state.status !== 'playing') return 'continue';
  const guess = state.current;
  if (Array.from(guess).length !== WORD_LENGTH) {
    state.message = 'short';
    return 'invalid-length';
  }
  if (!isValidWord(guess, state.locale)) {
    state.message = 'unknown';
    return 'invalid-word';
  }

  const statuses = scoreGuess(guess, state.answer);
  state.guesses.push(guess);
  state.statuses.push(statuses);
  state.current = '';
  state.message = '';
  updateKeyStatus(state, guess, statuses);

  if (isWin(statuses)) {
    state.status = 'won';
    return 'won';
  }
  if (state.guesses.length >= MAX_GUESSES) {
    state.status = 'lost';
    return 'lost';
  }
  return 'continue';
}

/** Number of guesses remaining (0 when out of attempts). */
export function attemptsLeft(state: WordState): number {
  return Math.max(0, MAX_GUESSES - state.guesses.length);
}

const STATUS_RANK: Record<LetterStatus, number> = { absent: 0, present: 1, correct: 2 };

function updateKeyStatus(state: WordState, guess: string, statuses: LetterStatus[]): void {
  const chars = Array.from(guess);
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const next = statuses[i];
    const prev = state.keyStatus[ch];
    if (prev === undefined || STATUS_RANK[next] > STATUS_RANK[prev]) {
      state.keyStatus[ch] = next;
    }
  }
}
