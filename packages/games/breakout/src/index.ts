import type { Game, GameContext, PointerInfo } from '@jellyzap/game-sdk';
import {
  advanceLevel,
  buildLevel,
  createBreakoutState,
  launchBall,
  movePaddle,
  resetBall,
  setPaddle,
  step,
  WIDTH,
  HEIGHT,
  type BreakoutState,
} from './logic';
import { draw } from './render';
import { registerBreakoutSfx } from './sfx';

/** Paddle keyboard speed in abstract units per second. */
const KEY_SPEED = 90;

export default function createBreakout(): Game {
  let ctx!: GameContext;
  let state!: BreakoutState;
  let ended = false;

  function reset(): void {
    state = createBreakoutState(1);
    ended = false;
    ctx.score.reset();
  }

  /** Convert a canvas-logical x (CSS px) into an abstract field x. */
  function pointerToFieldX(canvasX: number): number {
    const w = ctx.width;
    const h = ctx.height;
    const hud = Math.round(Math.min(w, h) * 0.08);
    const pad = Math.round(Math.min(w, h) * 0.03);
    const availW = w - pad * 2;
    const availH = h - pad * 2 - hud;
    const scale = Math.min(availW / WIDTH, availH / HEIGHT);
    const fieldW = WIDTH * scale;
    const ox = (w - fieldW) / 2;
    return (canvasX - ox) / scale;
  }

  function aimPaddle(p: PointerInfo): void {
    setPaddle(state, pointerToFieldX(p.x));
  }

  function endGame(): void {
    if (ended) return;
    ended = true;
    ctx.audio.play('gameover');
    ctx.score.set(state.score);
    const isHigh = ctx.score.commitHighScore();
    void ctx.hooks.onGameOver?.(state.score, isHigh);
  }

  return {
    meta: {
      slug: 'breakout',
      defaultControls: 'both',
      orientation: 'any',
      hasLives: true,
      supportsPause: true,
      aspectRatio: WIDTH / HEIGHT,
    },
    init(c) {
      ctx = c;
      registerBreakoutSfx(c.audio);
    },
    start() {
      reset();
    },
    update(dt) {
      if (state.status !== 'playing') return;

      // keyboard paddle movement (held keys)
      const keys = ctx.input.keys;
      let dir = 0;
      if (keys.has('ArrowLeft') || keys.has('KeyA')) dir -= 1;
      if (keys.has('ArrowRight') || keys.has('KeyD')) dir += 1;
      if (dir !== 0) movePaddle(state, dir * KEY_SPEED * dt);

      // auto-launch on Space / Up for keyboard players
      if (
        !state.launched &&
        (ctx.input.justPressed('Space') ||
          ctx.input.justPressed('ArrowUp') ||
          ctx.input.justPressed('KeyW'))
      ) {
        launchBall(state);
      }

      const prevScore = state.score;
      const ev = step(state, dt);

      if (ev.wall) ctx.audio.play('bounce');
      if (ev.paddle) ctx.audio.play('paddle');
      if (ev.bricksHit > 0) ctx.audio.play('brick');

      if (state.score !== prevScore) {
        ctx.score.set(state.score);
        ctx.hooks.onScore?.(state.score);
      }

      if (ev.lostLife && state.status === 'playing') ctx.audio.play('loseLife');

      if (ev.won) {
        // clearing every brick advances to a harder level rather than ending —
        // this is what makes the level system live and fires the level-up hook
        ctx.audio.play('win');
        advanceLevel(state);
        ctx.hooks.onLevelUp?.(state.level);
      } else if (ev.lost) {
        endGame();
      }
    },
    render() {
      draw(ctx.ctx, state, ctx.width, ctx.height, {
        score: state.score,
        high: ctx.score.highScore,
        lives: state.lives,
        status: state.status,
        launched: state.launched,
        scoreLabel: ctx.t('game.score'),
        bestLabel: ctx.t('game.best'),
        livesLabel: ctx.t('game.lives'),
        wonLabel: ctx.t('game.youWin'),
        lostLabel: ctx.t('game.gameOver'),
        launchLabel: ctx.t('game.tapToLaunch'),
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
      onPointerDown(p) {
        aimPaddle(p);
        launchBall(state);
      },
      onPointerMove(p) {
        aimPaddle(p);
      },
      onTap(p) {
        aimPaddle(p);
        launchBall(state);
      },
      onKeyDown(code) {
        if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') {
          launchBall(state);
        }
      },
    },
    destroy() {
      /* no external resources */
    },
  };
}

// re-export so the host/tests can reach the pure model through the package entry
export {
  advanceLevel,
  buildLevel,
  createBreakoutState,
  launchBall,
  movePaddle,
  resetBall,
  setPaddle,
  step,
  type BreakoutState,
};
