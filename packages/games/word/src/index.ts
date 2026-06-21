import type { Game, GameContext, PointerInfo } from '@jellyzap/game-sdk';
import {
  MAX_GUESSES,
  attemptsLeft,
  backspace,
  createWordState,
  submitGuess,
  typeLetter,
  type WordLocale,
  type WordState,
} from './logic';
import { computeLayout, draw } from './render';
import { registerWordSfx } from './sfx';

const SUPPORTED: readonly WordLocale[] = ['en', 'tr', 'de'];

function resolveLocale(locale: string | undefined): WordLocale {
  const base = (locale ?? 'en').slice(0, 2).toLowerCase();
  return (SUPPORTED as readonly string[]).includes(base) ? (base as WordLocale) : 'en';
}

/** Map a physical KeyboardEvent.code (KeyA–KeyZ) to its uppercase letter. */
function letterFromCode(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  return null;
}

export default function createWord(): Game {
  let ctx!: GameContext;
  let state!: WordState;
  let locale: WordLocale = 'en';
  let finished = false;

  function reset(): void {
    locale = resolveLocale(ctx.locale);
    state = createWordState(ctx.rng, locale);
    finished = false;
    ctx.score.reset();
  }

  /** Resolve a localized transient message from the state's message key. */
  function messageText(): string {
    if (!state.message) return '';
    if (state.message === 'short') return ctx.t('game.word.short');
    if (state.message === 'unknown') return ctx.t('game.word.unknown');
    return '';
  }

  function finishIfOver(): void {
    if (finished || state.status === 'playing') return;
    finished = true;
    const won = state.status === 'won';
    // More attempts left → higher score; a loss scores nothing.
    const score = won ? (attemptsLeft(state) + 1) * 100 : 0;
    ctx.audio.play(won ? 'win' : 'lose');
    ctx.score.set(score);
    ctx.hooks.onScore?.(score);
    const isHigh = ctx.score.commitHighScore();
    void ctx.hooks.onGameOver?.(score, isHigh);
  }

  /** Apply a logical action (a letter, 'ENTER', or 'DEL'). */
  function applyKey(key: string): void {
    if (finished || state.status !== 'playing') return;
    if (key === 'ENTER') {
      const before = state.guesses.length;
      const result = submitGuess(state);
      if (result === 'won') {
        ctx.audio.play('correct');
      } else if (result === 'continue' && state.guesses.length > before) {
        ctx.audio.play('submit');
      } else if (result === 'lost') {
        ctx.audio.play('submit');
      }
      finishIfOver();
    } else if (key === 'DEL') {
      if (backspace(state)) ctx.audio.play('type');
    } else {
      if (typeLetter(state, key)) ctx.audio.play('type');
    }
  }

  /** Hit-test a pointer against the on-screen keyboard; returns the key or null. */
  function keyAt(p: PointerInfo): string | null {
    const { keys } = computeLayout(ctx.width, ctx.height, state.locale);
    for (const k of keys) {
      if (p.x >= k.x && p.x <= k.x + k.w && p.y >= k.y && p.y <= k.y + k.h) return k.key;
    }
    return null;
  }

  function handlePointer(p: PointerInfo): void {
    if (state.status !== 'playing') return;
    const key = keyAt(p);
    if (key) applyKey(key);
  }

  return {
    meta: {
      slug: 'word',
      defaultControls: 'both',
      orientation: 'any',
      hasLives: false,
      supportsPause: false,
      aspectRatio: 0.72,
    },
    init(c) {
      ctx = c;
      registerWordSfx(c.audio);
    },
    start() {
      reset();
    },
    update() {
      /* turn-based: all state changes happen on input */
    },
    render() {
      draw(ctx.ctx, state, ctx.width, ctx.height, {
        titleLabel: ctx.t('game.word.title'),
        message: messageText(),
        winLabel: ctx.t('game.word.win'),
        loseLabel: ctx.t('game.word.lose'),
        answerLabel: `${ctx.t('game.word.answer')}: ${state.answer}`,
      });
    },
    resize() {
      /* rendering reads ctx.width/height each frame */
    },
    pause() {
      /* no continuous simulation to pause */
    },
    resume() {
      /* nothing to restore */
    },
    inputEvents: {
      onKeyDown(code) {
        if (code === 'Enter' || code === 'NumpadEnter') {
          applyKey('ENTER');
          return;
        }
        if (code === 'Backspace' || code === 'Delete') {
          applyKey('DEL');
          return;
        }
        const letter = letterFromCode(code);
        if (letter) applyKey(letter);
      },
      onPointerDown(p) {
        // Tap handling lives here (not in onTap) because the host fires BOTH
        // onPointerDown and onTap for a single tap — using one avoids double input.
        handlePointer(p);
      },
    },
    destroy() {
      /* no external resources */
    },
  };
}

export { MAX_GUESSES };
