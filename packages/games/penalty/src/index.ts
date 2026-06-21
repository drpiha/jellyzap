import type { Game, GameContext, PointerInfo } from '@jellyzap/game-sdk';
import { createPenaltyState, moveAim, nextShot, setAim, shoot, type PenaltyState } from './logic';
import { draw, zoneAt } from './render';
import { registerPenaltySfx } from './sfx';

/** How long the shot result (ball flight + banner) is shown before the next shot. */
const RESULT_TIME = 1.3;

/** Per-difficulty keeper skill + lives. Easier = more lives, weaker keeper. */
const DIFFICULTY: Record<string, { lives: number; readChance: number; coverage: number }> = {
  easy: { lives: 5, readChance: 0.18, coverage: 1 },
  normal: { lives: 4, readChance: 0.33, coverage: 1 },
  hard: { lives: 3, readChance: 0.5, coverage: 2 },
};

const FALLBACK = {
  goal: { en: 'GOAL!', tr: 'GOL!', de: 'TOR!' },
  save: { en: 'SAVED!', tr: 'KURTARDI!', de: 'GEHALTEN!' },
  hint: {
    en: 'Aim (tap or arrows), then shoot',
    tr: 'Nişan al (dokun/ok), sonra şut çek',
    de: 'Ziele (Tippen/Pfeile), dann schießen',
  },
} as const;

export default function createPenalty(): Game {
  let ctx!: GameContext;
  let state!: PenaltyState;
  let resultTimer = 0;
  let ballProgress = 0;
  let pulse = 0;
  let clock = 0;
  let resolved = false;
  let celebrated = false;

  function lang(): 'en' | 'tr' | 'de' {
    const l = (ctx.locale || 'en').slice(0, 2);
    return l === 'tr' || l === 'de' ? l : 'en';
  }

  function cfg() {
    return DIFFICULTY[ctx.difficulty] ?? DIFFICULTY.easy;
  }

  function reset(): void {
    state = createPenaltyState({ lives: cfg().lives });
    resultTimer = 0;
    ballProgress = 0;
    pulse = 0;
    clock = 0;
    resolved = false;
    celebrated = false;
    ctx.score.reset();
    ctx.audio.play('whistle');
  }

  function takeShot(): void {
    if (state.phase !== 'aim') return;
    ctx.audio.play('kick');
    const c = cfg();
    const res = shoot(state, ctx.rng, { readChance: c.readChance, coverage: c.coverage });
    resultTimer = RESULT_TIME;
    ballProgress = 0;
    celebrated = false;
    if (res === 'save') {
      ctx.audio.play('save');
      ctx.juice.shake(0.4);
    } else {
      ctx.audio.play('goal');
      ctx.score.set(state.score);
      ctx.hooks.onScore?.(state.score);
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
      slug: 'penalty',
      defaultControls: 'both',
      orientation: 'portrait',
      hasLives: true,
      supportsPause: true,
      aspectRatio: 0.8,
    },
    init(c) {
      ctx = c;
      registerPenaltySfx(c.audio);
    },
    start() {
      reset();
    },
    update(dt) {
      clock += dt;
      pulse = (Math.sin(clock * 6) + 1) / 2;
      if (resultTimer > 0) {
        resultTimer -= dt;
        ballProgress = Math.min(1, 1 - resultTimer / RESULT_TIME);
        if (state.lastResult === 'goal' && !celebrated && ballProgress > 0.6) {
          celebrated = true;
          ctx.juice.shake(0.2);
          ctx.juice.burst(ctx.width / 2, ctx.height * 0.4, { count: 36, speed: 190, life: 1.0 });
        }
        if (resultTimer <= 0) {
          if (state.phase === 'over') endGame();
          else nextShot(state);
        }
      }
    },
    render() {
      draw(ctx.ctx, state, ctx.width, ctx.height, {
        scoreLabel: ctx.t('game.score'),
        livesLabel: ctx.t('game.lives'),
        goalText: FALLBACK.goal[lang()],
        saveText: FALLBACK.save[lang()],
        aimHint: FALLBACK.hint[lang()],
        ballProgress,
        pulse,
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
        if (state.phase !== 'aim') return;
        const zone = zoneAt(ctx.width, ctx.height, state, p.x, p.y);
        if (zone < 0) return;
        setAim(state, zone);
        takeShot();
      },
      onKeyDown(code) {
        if (state.phase !== 'aim') return;
        switch (code) {
          case 'ArrowLeft':
          case 'KeyA':
            moveAim(state, -1, 0);
            ctx.audio.play('select');
            break;
          case 'ArrowRight':
          case 'KeyD':
            moveAim(state, 1, 0);
            ctx.audio.play('select');
            break;
          case 'ArrowUp':
          case 'KeyW':
            moveAim(state, 0, -1);
            ctx.audio.play('select');
            break;
          case 'ArrowDown':
          case 'KeyS':
            moveAim(state, 0, 1);
            ctx.audio.play('select');
            break;
          case 'Space':
          case 'Enter':
            takeShot();
            break;
          default:
            break;
        }
      },
    },
    destroy() {
      /* no external resources */
    },
  };
}
