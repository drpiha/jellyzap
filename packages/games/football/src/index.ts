import type { Game, GameContext, PointerInfo } from '@jellyzap/game-sdk';
import { createFootballState, shoot, step, type FootballState, type StepEvent } from './logic';
import { draw, pointerToField, type PlayerPose } from './render';
import { registerFootballSfx } from './sfx';

/**
 * Per-difficulty tuning. Easy is deliberately very winnable: a wide goal, one
 * slow defender, and a slow, short-reach keeper, so kids score often.
 */
const DIFFICULTY: Record<
  string,
  {
    time: number;
    defenderCount: number;
    defenderSpeed: number;
    keeperSpeed: number;
    keeperReach: number;
    goalW: number;
    predictiveKeeper: boolean;
  }
> = {
  easy: { time: 90, defenderCount: 1, defenderSpeed: 26, keeperSpeed: 26, keeperReach: 7, goalW: 60, predictiveKeeper: false },
  normal: { time: 70, defenderCount: 2, defenderSpeed: 40, keeperSpeed: 44, keeperReach: 9, goalW: 50, predictiveKeeper: false },
  hard: { time: 55, defenderCount: 3, defenderSpeed: 52, keeperSpeed: 58, keeperReach: 10, goalW: 42, predictiveKeeper: true },
};

const BANNER = {
  goal: { en: 'GOAL!', tr: 'GOL!', de: 'TOR!', color: '#fff04d' },
  miss: { en: 'Missed!', tr: 'Kaçtı!', de: 'Daneben!', color: '#ffffff' },
  tackle: { en: 'Tackled!', tr: 'Top kapıldı!', de: 'Erobert!', color: '#ff9b9b' },
} as const;

export default function createFootball(): Game {
  let ctx!: GameContext;
  let state!: FootballState;
  let touchTarget: { x: number; y: number } | null = null;
  let flashTimer = 0;
  let flashType: Exclude<StepEvent, 'none'> | null = null;
  let kickTimer = 0;
  let clock = 0;
  let resolved = false;

  function lang(): 'en' | 'tr' | 'de' {
    const l = (ctx.locale || 'en').slice(0, 2);
    return l === 'tr' || l === 'de' ? l : 'en';
  }

  function reset(): void {
    const d = DIFFICULTY[ctx.difficulty] ?? DIFFICULTY.easy;
    state = createFootballState({
      time: d.time,
      defenderCount: d.defenderCount,
      defenderSpeed: d.defenderSpeed,
      keeperSpeed: d.keeperSpeed,
      keeperReach: d.keeperReach,
      goalW: d.goalW,
      predictiveKeeper: d.predictiveKeeper,
    });
    touchTarget = null;
    flashTimer = 0;
    flashType = null;
    kickTimer = 0;
    clock = 0;
    resolved = false;
    ctx.score.reset();
    ctx.audio.play('whistle');
  }

  function flash(type: Exclude<StepEvent, 'none'>): void {
    flashType = type;
    flashTimer = 0.9;
  }

  function takeShot(aimX: number, aimY: number): void {
    if (shoot(state, aimX, aimY)) {
      ctx.audio.play('kick');
      kickTimer = 0.18;
    }
  }

  function endGame(): void {
    if (resolved) return;
    resolved = true;
    ctx.audio.play('whistle');
    const isHigh = ctx.score.commitHighScore();
    void ctx.hooks.onGameOver?.(state.score, isHigh);
  }

  return {
    meta: {
      slug: 'football',
      defaultControls: 'both',
      orientation: 'portrait',
      hasLives: false,
      supportsPause: true,
      aspectRatio: 0.72,
    },
    init(c) {
      ctx = c;
      registerFootballSfx(c.audio);
    },
    start() {
      reset();
    },
    update(dt) {
      if (state.phase === 'over') return;
      clock += dt;
      if (kickTimer > 0) kickTimer = Math.max(0, kickTimer - dt);
      if (flashTimer > 0) flashTimer = Math.max(0, flashTimer - dt);

      let dx = 0;
      let dy = 0;
      const keys = ctx.input.keys;
      if (keys.has('ArrowLeft') || keys.has('KeyA')) dx -= 1;
      if (keys.has('ArrowRight') || keys.has('KeyD')) dx += 1;
      if (keys.has('ArrowUp') || keys.has('KeyW')) dy -= 1;
      if (keys.has('ArrowDown') || keys.has('KeyS')) dy += 1;
      if (dx === 0 && dy === 0 && touchTarget) {
        const tdx = touchTarget.x - state.player.x;
        const tdy = touchTarget.y - state.player.y;
        if (Math.hypot(tdx, tdy) > 1.5) {
          dx = tdx;
          dy = tdy;
        }
      }

      const ev = step(state, dx, dy, dt);
      if (ev === 'goal') {
        ctx.audio.play('goal');
        ctx.juice.shake(0.3);
        ctx.juice.burst(ctx.width / 2, ctx.height * 0.32, { count: 44, speed: 210, life: 1.2 });
        ctx.score.set(state.score);
        ctx.hooks.onScore?.(state.score);
        flash('goal');
      } else if (ev === 'miss') {
        ctx.audio.play('miss');
        flash('miss');
      } else if (ev === 'tackle') {
        ctx.audio.play('tackle');
        ctx.juice.shake(0.35);
        flash('tackle');
      }

      if (state.timeLeft <= 0) endGame(); // step() flips phase to 'over' at zero
    },
    render() {
      const banner =
        flashTimer > 0 && flashType
          ? { text: BANNER[flashType][lang()], color: BANNER[flashType].color }
          : null;
      let pose: PlayerPose = 'run';
      if (state.phase === 'celebrate') pose = 'celebrate';
      else if (kickTimer > 0) pose = 'kick';
      draw(ctx.ctx, state, ctx.width, ctx.height, {
        scoreLabel: ctx.t('game.score'),
        timeLabel: ctx.t('game.time'),
        banner,
        clock,
        playerPose: pose,
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
      onPointerDown(p: PointerInfo) {
        touchTarget = pointerToField(ctx.width, ctx.height, p.x, p.y);
      },
      onPointerMove(p: PointerInfo) {
        if (touchTarget) touchTarget = pointerToField(ctx.width, ctx.height, p.x, p.y);
      },
      onPointerUp() {
        touchTarget = null;
      },
      onTap(p: PointerInfo) {
        // a quick tap shoots toward the tapped spot (aim a corner!) and stops moving
        touchTarget = null;
        const aim = pointerToField(ctx.width, ctx.height, p.x, p.y);
        takeShot(aim.x, aim.y);
      },
      onKeyDown(code) {
        if (code === 'Space' || code === 'Enter') {
          // aim up-pitch, nudged in the direction the player is moving
          takeShot(state.player.x + state.player.vx * 0.4, 0);
        }
      },
    },
    destroy() {
      /* no external resources */
    },
  };
}
