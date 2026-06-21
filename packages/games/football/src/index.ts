import type { Game, GameContext, PointerInfo } from '@jellyzap/game-sdk';
import { createFootballState, shoot, step, type FootballState, type StepEvent } from './logic';
import { draw, pointerToField } from './render';
import { registerFootballSfx } from './sfx';

/** Per-difficulty: easier = more time, slower defender + keeper. */
const DIFFICULTY: Record<string, { time: number; defenderSpeed: number; keeperSpeed: number }> = {
  easy: { time: 80, defenderSpeed: 32, keeperSpeed: 34 },
  normal: { time: 65, defenderSpeed: 44, keeperSpeed: 48 },
  hard: { time: 55, defenderSpeed: 56, keeperSpeed: 62 },
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
  let resolved = false;

  function lang(): 'en' | 'tr' | 'de' {
    const l = (ctx.locale || 'en').slice(0, 2);
    return l === 'tr' || l === 'de' ? l : 'en';
  }

  function reset(): void {
    const d = DIFFICULTY[ctx.difficulty] ?? DIFFICULTY.easy;
    state = createFootballState({
      time: d.time,
      defenderSpeed: d.defenderSpeed,
      keeperSpeed: d.keeperSpeed,
    });
    touchTarget = null;
    flashTimer = 0;
    flashType = null;
    resolved = false;
    ctx.score.reset();
    ctx.audio.play('whistle');
  }

  function flash(type: Exclude<StepEvent, 'none'>): void {
    flashType = type;
    flashTimer = 0.9;
  }

  function takeShot(): void {
    if (shoot(state)) ctx.audio.play('kick');
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
        ctx.juice.shake(0.25);
        ctx.juice.burst(ctx.width / 2, ctx.height * 0.35, { count: 38, speed: 200, life: 1.0 });
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

      if (flashTimer > 0) flashTimer = Math.max(0, flashTimer - dt);
      if (state.timeLeft <= 0) endGame(); // step() flips phase to 'over' at zero
    },
    render() {
      const banner =
        flashTimer > 0 && flashType
          ? { text: BANNER[flashType][lang()], color: BANNER[flashType].color }
          : null;
      draw(ctx.ctx, state, ctx.width, ctx.height, {
        scoreLabel: ctx.t('game.score'),
        timeLabel: ctx.t('game.time'),
        banner,
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
      onTap() {
        // a quick tap shoots and stops the player (drag to steer instead)
        touchTarget = null;
        takeShot();
      },
      onKeyDown(code) {
        if (code === 'Space' || code === 'Enter') takeShot();
      },
    },
    destroy() {
      /* no external resources */
    },
  };
}
