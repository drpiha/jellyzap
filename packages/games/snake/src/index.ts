import type { Game, GameContext } from '@jellyzap/game-sdk';
import { createSnakeState, setDirection, step, type Dir, type SnakeState } from './logic';
import { render } from './render';
import { registerSnakeSfx } from './sfx';

const COLS = 19;
const ROWS = 19;
const BASE_INTERVAL = 0.16;
const MIN_INTERVAL = 0.06;

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
  let interval = BASE_INTERVAL;
  let gameOver = false;

  function reset(): void {
    state = createSnakeState(COLS, ROWS, ctx.rng);
    acc = 0;
    interval = BASE_INTERVAL;
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
          ctx.score.set(state.score);
          ctx.hooks.onScore?.(state.score);
          interval = Math.max(MIN_INTERVAL, BASE_INTERVAL - state.score * 0.004);
        } else if (result === 'dead') {
          ctx.audio.play('die');
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
        if (d) setDirection(state, d);
      },
      onSwipe(dir) {
        setDirection(state, dir);
      },
    },
    destroy() {
      /* no external resources */
    },
  };
}
