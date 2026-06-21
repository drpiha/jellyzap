import type { Game, GameContext } from '@jellyzap/game-sdk';
import {
  aiInput,
  createKartsState,
  fire,
  grantContinue,
  normAngle,
  stepKart,
  stepProjectiles,
  ARENA,
  KART_RADIUS,
  NO_INPUT,
  type KartInput,
  type KartsState,
} from './logic';
import { draw } from './render';
import { registerKartsSfx } from './sfx';

/** How a touch target maps back to arena-unit coordinates for the player kart. */
interface View {
  ox: number;
  oy: number;
  size: number;
  scale: number;
}

function computeView(arena: number, w: number, h: number): View {
  const hud = Math.round(Math.min(w, h) * 0.09);
  const pad = Math.round(Math.min(w, h) * 0.04);
  const availW = w - pad * 2;
  const availH = h - pad * 2 - hud;
  const size = Math.max(40, Math.min(availW, availH));
  const ox = Math.floor((w - size) / 2);
  const oy = Math.floor(hud + (h - hud - size) / 2);
  return { ox, oy, size, scale: size / arena };
}

export default function createKarts(): Game {
  let ctx!: GameContext;
  let state!: KartsState;
  let gameOver = false;
  let continueUsed = false;
  let resolvingContinue = false;

  // touch steering: an arena-space target the player auto-drives toward
  let touchTarget: { x: number; y: number } | null = null;
  // engine sfx throttle so we don't spam the audio manager every tick
  let engineAcc = 0;

  function reset(): void {
    state = createKartsState(ARENA);
    gameOver = false;
    continueUsed = false;
    resolvingContinue = false;
    touchTarget = null;
    engineAcc = 0;
    ctx.score.reset();
  }

  /** Build the player's input from held keys + any active touch target. */
  function playerInput(dt: number): KartInput {
    const keys = ctx.input.keys;
    const player = state.karts[0];

    let accel = keys.has('ArrowUp') || keys.has('KeyW');
    let turn = 0;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) turn -= 1;
    if (keys.has('ArrowRight') || keys.has('KeyD')) turn += 1;
    let fireNow = ctx.input.justPressed?.('Space') ?? false;

    // touch: steer toward the last pointer position and auto-accelerate
    if (touchTarget && player.alive) {
      const dx = touchTarget.x - player.x;
      const dy = touchTarget.y - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist > KART_RADIUS) {
        const desired = Math.atan2(dy, dx);
        const diff = normAngle(desired - player.angle);
        if (diff > 0.05) turn = 1;
        else if (diff < -0.05) turn = -1;
        accel = true;
      }
    }

    void dt;
    return { accel, turn, fire: fireNow };
  }

  function pointerToArena(px: number, py: number): { x: number; y: number } {
    const v = computeView(state.arena, ctx.width, ctx.height);
    const x = Math.max(0, Math.min(state.arena, (px - v.ox) / v.scale));
    const y = Math.max(0, Math.min(state.arena, (py - v.oy) / v.scale));
    return { x, y };
  }

  function firePlayer(): void {
    const player = state.karts[0];
    if (player && player.alive && fire(state, player)) {
      ctx.audio.play('shoot');
    }
  }

  async function handlePlayerOutOfLives(): Promise<void> {
    if (resolvingContinue) return;
    resolvingContinue = true;
    gameOver = true;
    ctx.audio.play('gameover');

    if (!continueUsed && ctx.hooks.onRewardRequested) {
      const ok = await ctx.hooks.onRewardRequested('continue');
      if (ok) {
        continueUsed = true;
        grantContinue(state);
        gameOver = false;
        resolvingContinue = false;
        return;
      }
    }

    const isHigh = ctx.score.commitHighScore();
    void ctx.hooks.onGameOver?.(state.score, isHigh);
    resolvingContinue = false;
  }

  return {
    meta: {
      slug: 'karts',
      defaultControls: 'both',
      orientation: 'any',
      hasLives: true,
      supportsPause: true,
      aspectRatio: 1,
    },
    init(c) {
      ctx = c;
      registerKartsSfx(c.audio);
    },
    start() {
      reset();
      ctx.hooks.onGameStart?.();
    },
    update(dt) {
      if (gameOver || resolvingContinue) return;

      // player
      const pIn = playerInput(dt);
      const player = state.karts[0];
      stepKart(player, pIn, dt, state.arena);
      if (pIn.fire) firePlayer();

      // engine rumble while throttling (throttled playback)
      if (pIn.accel && player.alive) {
        engineAcc += dt;
        if (engineAcc >= 0.12) {
          engineAcc = 0;
          ctx.audio.play('engine');
        }
      } else {
        engineAcc = 0;
      }

      // bots: steer toward the player, fire when aimed
      for (let i = 1; i < state.karts.length; i++) {
        const bot = state.karts[i];
        const aIn = bot.alive ? aiInput(bot, player, dt) : NO_INPUT;
        stepKart(bot, aIn, dt, state.arena);
        if (aIn.fire && fire(state, bot)) ctx.audio.play('shoot');
      }

      // projectiles + collisions
      const res = stepProjectiles(state, dt);
      if (res.hits > 0) ctx.audio.play('hit');
      if (res.kills > 0) {
        ctx.audio.play('explode');
        ctx.score.set(state.score);
        ctx.hooks.onScore?.(state.score);
      }
      if (res.playerDied) ctx.audio.play('explode');

      // out of lives → rewarded continue or game over
      if (state.gameOver && !resolvingContinue) {
        void handlePlayerOutOfLives();
      }
    },
    render() {
      draw(ctx.ctx, state, ctx.width, ctx.height, {
        score: state.score,
        high: ctx.score.highScore,
        lives: state.lives,
        gameOver,
        scoreLabel: ctx.t('game.score'),
        bestLabel: ctx.t('game.best'),
        livesLabel: ctx.t('game.lives'),
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
        if (code === 'Space') firePlayer();
      },
      onPointerDown(p) {
        touchTarget = pointerToArena(p.x, p.y);
      },
      onPointerMove(p) {
        if (touchTarget) touchTarget = pointerToArena(p.x, p.y);
      },
      onPointerUp() {
        touchTarget = null;
      },
      onTap() {
        firePlayer();
      },
    },
    destroy() {
      /* no external resources */
    },
  };
}
