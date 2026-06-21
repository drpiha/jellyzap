import type { Game, GameContext } from '@jellyzap/game-sdk';
import { createSnakeState, setDirection, step, type Dir, type SnakeState } from './logic';
import { render } from './render';
import { registerSnakeSfx } from './sfx';

const COLS = 19;
const ROWS = 19;

/** Per-difficulty speed: base tick, fastest tick, and how fast it ramps per point. */
const DIFFICULTY: Record<string, { base: number; min: number; ramp: number }> = {
  easy: { base: 0.2, min: 0.11, ramp: 0.003 },
  normal: { base: 0.16, min: 0.07, ramp: 0.004 },
  hard: { base: 0.12, min: 0.05, ramp: 0.006 },
};

function dirFromKey(code: string): Dir | null {
  switch (code) {
    case 'ArrowUp':
    case 'KeyW':
      return 'up';
    case 'ArrowDown':
    case 'KeyS':
      return 'down';
    case 'ArrowLeft':
    case 'KeyA':
      return 'left';
    case 'ArrowRight':
    case 'KeyD':
      return 'right';
    default:
      return null;
  }
}

export default function createSnake(): Game {
  let ctx!: GameContext;
  let state!: SnakeState;
  let acc = 0;
  let cfg = DIFFICULTY.easy;
  let interval = cfg.base;
  let gameOver = false;

  function reset(): void {
    cfg = DIFFICULTY[ctx.difficulty] ?? DIFFICULTY.easy;
    state = createSnakeState(COLS, ROWS, ctx.rng);
    acc = 0;
    interval = cfg.base;
    gameOver = false;
    ctx.score.reset();
  }

  return {
    meta: {
      slug: 'snake',
      defaultControls: 'both',
      orientation: 'any',
      hasLives: false,
      supportsPause: true,
      aspectRatio: 1,
    },
    init(c) {
      ctx = c;
      registerSnakeSfx(c.audio);
    },
    start() {
      reset();
    },
    update(dt) {
      if (gameOver) return;
      acc += dt;
      while (acc >= interval) {
        acc -= interval;
        const result = step(state, ctx.rng);
        if (result === 'eat') {
          ctx.audio.play('eat');
          ctx.juice.shake(0.06);
          ctx.score.set(state.score);
          ctx.hooks.onScore?.(state.score);
          interval = Math.max(cfg.min, cfg.base - state.score * cfg.ramp);
        } else if (result === 'dead') {
          ctx.audio.play('die');
          ctx.juice.shake(0.4);
          ctx.juice.burst(ctx.width / 2, ctx.height / 2, { count: 28, speed: 150, life: 0.8 });
          gameOver = true;
          const isHigh = ctx.score.commitHighScore();
          void ctx.hooks.onGameOver?.(state.score, isHigh);
          break;
        }
      }
    },
    render() {
      render(ctx.ctx, state, ctx.width, ctx.height, {
        score: state.score,
        high: ctx.score.highScore,
        gameOver,
        scoreLabel: ctx.t('game.score'),
        bestLabel: ctx.t('game.best'),
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
        const d = dirFromKey(code);
        if (d && setDirection(state, d)) ctx.audio.play('turn');
      },
      onSwipe(dir) {
        if (setDirection(state, dir)) ctx.audio.play('turn');
      },
    },
    destroy() {
      /* no external resources */
    },
  };
}
