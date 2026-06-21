import type { Game, GameContext } from '@jellyzap/game-sdk';
import { createFlappyState, flap, step, type FlappyState } from './logic';
import { draw } from './render';
import { registerFlappySfx } from './sfx';

/** Fixed logic timestep (seconds) used to keep physics stable and deterministic. */
const FIXED_DT = 1 / 120;
/** Safety cap so a long stall can't spiral the accumulator. */
const MAX_ACC = 0.25;

export default function createFlappy(): Game {
  let ctx!: GameContext;
  let state!: FlappyState;
  let acc = 0;
  let gameOver = false;

  function reset(): void {
    state = createFlappyState();
    acc = 0;
    gameOver = false;
    ctx.score.reset();
  }

  function doFlap(): void {
    if (gameOver) return;
    flap(state);
    ctx.audio.play('flap');
  }

  return {
    meta: {
      slug: 'flappy',
      defaultControls: 'both',
      orientation: 'portrait',
      hasLives: false,
      supportsPause: true,
      aspectRatio: 0.6,
    },
    init(c) {
      ctx = c;
      registerFlappySfx(c.audio);
    },
    start() {
      reset();
    },
    update(dt) {
      if (gameOver) return;
      acc += Math.min(dt, MAX_ACC);
      while (acc >= FIXED_DT) {
        acc -= FIXED_DT;
        const result = step(state, FIXED_DT, ctx.rng);
        if (result === 'score') {
          ctx.audio.play('score');
          ctx.score.set(state.score);
          ctx.hooks.onScore?.(state.score);
        } else if (result === 'dead') {
          ctx.audio.play('hit');
          ctx.audio.play('gameover');
          gameOver = true;
          const isHigh = ctx.score.commitHighScore();
          void ctx.hooks.onGameOver?.(state.score, isHigh);
          break;
        }
      }
    },
    render() {
      draw(ctx.ctx, state, ctx.width, ctx.height, {
        score: state.score,
        high: ctx.score.highScore,
        gameOver,
        started: state.started,
        scoreLabel: ctx.t('game.score'),
        bestLabel: ctx.t('game.best'),
        overLabel: ctx.t('game.gameOver'),
        startLabel: ctx.t('game.tapToStart'),
        againLabel: ctx.t('game.playAgain'),
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
      onTap() {
        doFlap();
      },
      onPointerDown() {
        doFlap();
      },
      onKeyDown(code) {
        if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') doFlap();
      },
    },
    destroy() {
      /* no external resources */
    },
  };
}
