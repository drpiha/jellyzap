import type { Direction, Game, GameContext } from '@jellyzap/game-sdk';
import {
  WIN_VALUE,
  createState,
  hasWon,
  isGameOver,
  move,
  spawnCell,
  type Dir,
  type Game2048State,
} from './logic';
import { render } from './render';
import { register2048Sfx } from './sfx';

const POP_DURATION = 0.12; // seconds for the spawn "pop" animation

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

export default function create2048(): Game {
  let ctx!: GameContext;
  let state!: Game2048State;
  let popCell: [number, number] | null = null;
  let popTime = 0;

  function reset(): void {
    state = createState(ctx.rng);
    popCell = null;
    popTime = 0;
    ctx.score.reset();
  }

  function tryMove(dir: Dir): void {
    if (state.over) return;
    const result = move(state.grid, dir);
    if (!result.moved) return;

    state.grid = result.grid;
    state.score += result.gained;

    if (result.gained > 0) {
      ctx.audio.play('merge');
      ctx.juice.shake(Math.min(0.3, 0.04 + result.gained / 2048));
    } else {
      ctx.audio.play('move');
    }

    // a successful move always reveals a new tile
    popCell = spawnCell(state.grid, ctx.rng);
    ctx.audio.play('spawn');
    popTime = 0;

    ctx.score.set(state.score);
    ctx.hooks.onScore?.(state.score);
    // 2048 has no lives and can run indefinitely after reaching 2048; commit the
    // record on every gain so leaving mid-run never loses it and the "Best" HUD
    // (which reads highScore) tracks the live score. commitHighScore is idempotent.
    ctx.score.commitHighScore();

    if (!state.won && hasWon(state.grid)) {
      state.won = true;
      ctx.juice.shake(0.3);
      ctx.juice.burst(ctx.width / 2, ctx.height / 2, { count: 46, speed: 200, life: 1.1 });
    }

    if (isGameOver(state.grid)) {
      state.over = true;
      ctx.audio.play('gameover');
      const isHigh = ctx.score.commitHighScore();
      void ctx.hooks.onGameOver?.(state.score, isHigh);
    }
  }

  return {
    meta: {
      slug: '2048',
      defaultControls: 'both',
      orientation: 'any',
      hasLives: false,
      supportsPause: true,
      aspectRatio: 1,
    },
    init(c) {
      ctx = c;
      register2048Sfx(c.audio);
    },
    start() {
      reset();
    },
    update(dt) {
      if (popCell && popTime < POP_DURATION) {
        popTime = Math.min(POP_DURATION, popTime + dt);
      }
    },
    render() {
      render(
        ctx.ctx,
        {
          grid: state.grid,
          score: state.score,
          high: ctx.score.highScore,
          gameOver: state.over,
          scoreLabel: ctx.t('game.score'),
          bestLabel: ctx.t('game.best'),
          overLabel: ctx.t('game.gameOver'),
          // language-neutral: the milestone tile value itself
          winLabel: `${WIN_VALUE}!`,
          showWinBanner: state.won,
          pop: popCell ? popTime / POP_DURATION : 1,
          popCell,
        },
        ctx.width,
        ctx.height,
      );
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
        if (d) tryMove(d);
      },
      onSwipe(dir: Direction) {
        tryMove(dir);
      },
    },
    destroy() {
      // persist any pending record if the player leaves mid-run
      ctx.score.commitHighScore();
    },
  };
}
