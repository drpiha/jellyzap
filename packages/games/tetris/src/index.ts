import type { Game, GameContext } from '@jellyzap/game-sdk';
import {
  createTetrisState,
  gravityInterval,
  gravityStep,
  hardDrop,
  move,
  rotate,
  softDrop,
  type TetrisState,
} from './logic';
import { render } from './render';
import { registerTetrisSfx } from './sfx';

/**
 * Locale-aware fallbacks for labels the shared i18n dictionary does not (yet)
 * define. The host's `t()` returns the key verbatim when it is missing, so we
 * detect that and substitute a localized default instead of showing a raw key.
 */
const FALLBACK: Record<string, Record<string, string>> = {
  'game.level': { en: 'Level', tr: 'Seviye', de: 'Level' },
  'game.lines': { en: 'Lines', tr: 'Satır', de: 'Reihen' },
  'game.next': { en: 'Next', tr: 'Sıradaki', de: 'Nächstes' },
};

export default function createTetris(): Game {
  let ctx!: GameContext;
  let state!: TetrisState;
  let acc = 0;
  let gameOver = false;

  /** Translate `key`, falling back to a localized default if it is undefined. */
  function label(key: string): string {
    const v = ctx.t(key);
    if (v !== key) return v;
    const f = FALLBACK[key];
    if (!f) return v;
    const lang = (ctx.locale || 'en').slice(0, 2);
    return f[lang] ?? f.en;
  }

  function reset(): void {
    state = createTetrisState(ctx.rng);
    acc = 0;
    gameOver = state.over;
    ctx.score.reset();
  }

  function syncScore(): void {
    ctx.score.set(state.score);
    ctx.hooks.onScore?.(state.score);
  }

  function endGame(): void {
    if (gameOver) return;
    gameOver = true;
    ctx.audio.play('gameover');
    syncScore();
    const isHigh = ctx.score.commitHighScore();
    void ctx.hooks.onGameOver?.(state.score, isHigh);
  }

  /**
   * Apply the outcome of a lock/clear: sounds, scoring, level-up + game over.
   * `levelBefore` is the level captured *before* the lock ran, since the lock may
   * have already bumped `state.level` via line clears.
   */
  function afterLock(cleared: number, spawned: boolean, levelBefore: number): void {
    if (cleared > 0) {
      ctx.audio.play('lineclear');
      ctx.juice.shake(0.1 * cleared); // bigger clears shake harder (Tetris = 0.4)
    } else {
      ctx.audio.play('lock');
    }
    syncScore();
    if (state.level > levelBefore) {
      ctx.hooks.onLevelUp?.(state.level);
      ctx.juice.shake(0.25);
      ctx.juice.burst(ctx.width / 2, ctx.height / 2, { count: 40, speed: 190, life: 1.0 });
    }
    if (!spawned) endGame();
  }

  return {
    meta: {
      slug: 'tetris',
      defaultControls: 'both',
      orientation: 'portrait',
      hasLives: false,
      supportsPause: true,
      aspectRatio: 0.625, // 10 / 16, leaving room for the side panel
    },
    init(c) {
      ctx = c;
      registerTetrisSfx(c.audio);
    },
    start() {
      reset();
    },
    update(dt) {
      if (gameOver || state.over) return;
      acc += dt;
      const interval = gravityInterval(state.level);
      while (acc >= interval) {
        acc -= interval;
        const levelBefore = state.level;
        const res = gravityStep(state, ctx.rng);
        if (res.kind === 'lock') {
          afterLock(res.cleared, res.spawned, levelBefore);
        } else if (res.kind === 'over') {
          endGame();
          break;
        }
      }
    },
    render() {
      render(ctx.ctx, state, ctx.width, ctx.height, {
        score: state.score,
        high: ctx.score.highScore,
        gameOver: gameOver || state.over,
        scoreLabel: ctx.t('game.score'),
        bestLabel: ctx.t('game.best'),
        levelLabel: label('game.level'),
        linesLabel: label('game.lines'),
        nextLabel: label('game.next'),
        overLabel: ctx.t('game.gameOver'),
      });
    },
    resize() {
      /* rendering reads ctx.width/height each frame */
    },
    pause() {
      /* host stops calling update while paused */
    },
    resume() {
      /* nothing to restore */
    },
    inputEvents: {
      onKeyDown(code) {
        if (gameOver || state.over) return;
        switch (code) {
          case 'ArrowLeft':
          case 'KeyA':
            if (move(state, -1)) ctx.audio.play('move');
            break;
          case 'ArrowRight':
          case 'KeyD':
            if (move(state, 1)) ctx.audio.play('move');
            break;
          case 'ArrowUp':
          case 'KeyW':
            if (rotate(state, 1)) ctx.audio.play('rotate');
            break;
          case 'ArrowDown':
          case 'KeyS':
            if (softDrop(state)) {
              acc = 0;
              ctx.audio.play('move');
            }
            break;
          case 'Space': {
            const levelBefore = state.level;
            const res = hardDrop(state, ctx.rng);
            ctx.audio.play('drop');
            acc = 0;
            afterLock(res.cleared, res.spawned, levelBefore);
            break;
          }
          default:
            break;
        }
      },
      onSwipe(dir) {
        if (gameOver || state.over) return;
        if (dir === 'left') {
          if (move(state, -1)) ctx.audio.play('move');
        } else if (dir === 'right') {
          if (move(state, 1)) ctx.audio.play('move');
        } else if (dir === 'down') {
          if (softDrop(state)) {
            acc = 0;
            ctx.audio.play('move');
          }
        } else if (dir === 'up') {
          if (rotate(state, 1)) ctx.audio.play('rotate');
        }
      },
      onTap() {
        if (gameOver || state.over) return;
        if (rotate(state, 1)) ctx.audio.play('rotate');
      },
    },
    destroy() {
      /* no external resources */
    },
  };
}
