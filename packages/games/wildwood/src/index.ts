import type { Game, GameContext, PointerInfo } from '@jellyzap/game-sdk';
import {
  createWildwoodState,
  step,
  type StepInput,
  type WildwoodEvent,
  type WildwoodOptions,
  type WildwoodState,
} from './logic';
import { computeView, draw, pointerToWorld, type Banner } from './render';
import { registerWildwoodSfx } from './sfx';

/**
 * Per-difficulty tuning. Easy is deliberately gentle for younger players: a long
 * day to gather, a slow-burning fire, and few, weak wolves. Hard squeezes time,
 * fuel and patience while sending bigger, faster packs.
 */
const DIFFICULTY: Record<string, WildwoodOptions> = {
  easy: {
    maxHealth: 120,
    hungerDrain: 1.2,
    starveDamage: 3,
    chillDamage: 2.5,
    fireBurnDay: 0.9,
    fireBurnNight: 1.8,
    startFuel: 62,
    startWood: 4,
    startFood: 3,
    attackDamage: 14,
    dayLength: 24,
    nightLength: 16,
    baseWolves: 2,
    wolvesPerNight: 1,
    maxWolves: 12,
    wolfSpeed: 20,
    wolfHealth: 18,
    wolfDamage: 7,
    treeCount: 11,
    bushCount: 7,
  },
  normal: {
    maxHealth: 100,
    hungerDrain: 1.6,
    starveDamage: 4,
    chillDamage: 3.5,
    fireBurnDay: 1.1,
    fireBurnNight: 2.2,
    startFuel: 50,
    startWood: 3,
    startFood: 2,
    attackDamage: 12,
    dayLength: 22,
    nightLength: 18,
    baseWolves: 3,
    wolvesPerNight: 1,
    maxWolves: 15,
    wolfSpeed: 24,
    wolfHealth: 22,
    wolfDamage: 9,
    treeCount: 10,
    bushCount: 6,
  },
  hard: {
    maxHealth: 90,
    hungerDrain: 2,
    starveDamage: 5,
    chillDamage: 5,
    fireBurnDay: 1.3,
    fireBurnNight: 2.6,
    startFuel: 44,
    startWood: 2,
    startFood: 2,
    attackDamage: 11,
    dayLength: 20,
    nightLength: 20,
    baseWolves: 4,
    wolvesPerNight: 2,
    maxWolves: 18,
    wolfSpeed: 28,
    wolfHealth: 26,
    wolfDamage: 11,
    treeCount: 9,
    bushCount: 6,
  },
};

type Lang = 'en' | 'tr' | 'de';

const TEXT = {
  night: { en: 'Night', tr: 'Gece', de: 'Nacht' },
  best: { en: 'Best', tr: 'En iyi', de: 'Beste' },
  wood: { en: 'Wood', tr: 'Odun', de: 'Holz' },
  food: { en: 'Food', tr: 'Yiyecek', de: 'Essen' },
  nightfall: {
    en: 'Night falls — stay in the light!',
    tr: 'Gece çöküyor — ışıkta kal!',
    de: 'Die Nacht bricht herein — bleib im Licht!',
  },
  firelow: {
    en: 'The fire is low — feed it wood!',
    tr: 'Ateş azalıyor — odun at!',
    de: 'Das Feuer wird schwach — leg Holz nach!',
  },
  fireout: {
    en: 'The fire went out!',
    tr: 'Ateş söndü!',
    de: 'Das Feuer ist aus!',
  },
  survivedOne: { en: 'night survived', tr: 'gece atlatıldı', de: 'Nacht überstanden' },
  survivedMany: { en: 'nights survived', tr: 'gece atlatıldı', de: 'Nächte überstanden' },
  won: {
    en: 'You survived 99 nights!',
    tr: '99 geceyi atlattın!',
    de: 'Du hast 99 Nächte überlebt!',
  },
} as const;

export default function createWildwood(): Game {
  let ctx!: GameContext;
  let state!: WildwoodState;
  let touchTarget: { x: number; y: number } | null = null;
  let tapAttack = false;
  let clock = 0;
  let banner: Banner | null = null;
  let bannerTimer = 0;
  let resolved = false;

  function lang(): Lang {
    const l = (ctx.locale || 'en').slice(0, 2);
    return l === 'tr' || l === 'de' ? l : 'en';
  }

  function setBanner(text: string, color: string, time: number, sub?: string): void {
    banner = { text, color, sub };
    bannerTimer = time;
  }

  function reset(): void {
    const opts = DIFFICULTY[ctx.difficulty] ?? DIFFICULTY.easy;
    state = createWildwoodState(opts, ctx.rng);
    touchTarget = null;
    tapAttack = false;
    clock = 0;
    banner = null;
    bannerTimer = 0;
    resolved = false;
    ctx.score.reset();
  }

  /** Convert a world point to a screen point for particle bursts. */
  function screen(wx: number, wy: number): { x: number; y: number } {
    const v = computeView(ctx.width, ctx.height);
    return { x: v.ox + wx * v.s, y: v.oy + wy * v.s };
  }

  function endGame(won: boolean): void {
    if (resolved) return;
    resolved = true;
    ctx.audio.play(won ? 'won' : 'gameover');
    ctx.score.set(state.survived);
    const isHigh = ctx.score.commitHighScore();
    void ctx.hooks.onGameOver?.(state.survived, isHigh);
  }

  function handleEvent(ev: WildwoodEvent): void {
    const L = lang();
    switch (ev) {
      case 'chop': {
        ctx.audio.play('chop');
        const s = screen(state.player.x, state.player.y);
        ctx.juice.burst(s.x, s.y, { count: 5, color: ['#8a5a2b', '#b07a3a'], speed: 60, life: 0.4 });
        break;
      }
      case 'pick': {
        ctx.audio.play('pick');
        const s = screen(state.player.x, state.player.y);
        ctx.juice.burst(s.x, s.y, { count: 4, color: ['#e2455a', '#4caf50'], speed: 55, life: 0.4 });
        break;
      }
      case 'feed':
        ctx.audio.play('feed');
        break;
      case 'eat':
        ctx.audio.play('eat');
        break;
      case 'swing':
        ctx.audio.play('swing');
        break;
      case 'hit':
        ctx.audio.play('hit');
        ctx.juice.shake(0.18);
        break;
      case 'wolfdie': {
        ctx.audio.play('wolfdie');
        ctx.juice.shake(0.2);
        const s = screen(state.player.x, state.player.y);
        ctx.juice.burst(s.x, s.y, { count: 12, color: ['#23252e', '#55585f'], speed: 110, life: 0.5 });
        break;
      }
      case 'bite': {
        ctx.audio.play('bite');
        ctx.juice.shake(0.4);
        const s = screen(state.player.x, state.player.y);
        ctx.juice.burst(s.x, s.y, { count: 8, color: ['#e0455e', '#ff7a7a'], speed: 90, life: 0.5 });
        break;
      }
      case 'nightfall':
        ctx.audio.play('nightfall');
        setBanner(TEXT.nightfall[L], '#9db4ff', 2.2);
        break;
      case 'dawn': {
        ctx.audio.play('dawn');
        const n = state.survived;
        const word = n === 1 ? TEXT.survivedOne[L] : TEXT.survivedMany[L];
        setBanner(`${n} ${word}`, '#ffd86b', 2.2);
        ctx.score.set(n);
        ctx.hooks.onScore?.(n);
        ctx.hooks.onLevelUp?.(state.night);
        break;
      }
      case 'firelow':
        ctx.audio.play('firelow');
        setBanner(TEXT.firelow[L], '#ff9f43', 1.6);
        break;
      case 'fireout':
        ctx.audio.play('fireout');
        ctx.juice.shake(0.3);
        setBanner(TEXT.fireout[L], '#ff6b6b', 1.8);
        break;
      case 'won':
        setBanner(TEXT.won[lang()], '#7CFCB4', 3, undefined);
        ctx.juice.shake(0.5);
        ctx.juice.burst(ctx.width / 2, ctx.height * 0.4, { count: 60, speed: 200, life: 1.3 });
        endGame(true);
        break;
      case 'gameover':
        endGame(false);
        break;
      default:
        break;
    }
  }

  function buildInput(): StepInput {
    let mx = 0;
    let my = 0;
    const keys = ctx.input.keys;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) mx -= 1;
    if (keys.has('ArrowRight') || keys.has('KeyD')) mx += 1;
    if (keys.has('ArrowUp') || keys.has('KeyW')) my -= 1;
    if (keys.has('ArrowDown') || keys.has('KeyS')) my += 1;

    if (mx === 0 && my === 0 && touchTarget) {
      const dx = touchTarget.x - state.player.x;
      const dy = touchTarget.y - state.player.y;
      if (Math.hypot(dx, dy) > 1.5) {
        mx = dx;
        my = dy;
      }
    }

    const attack = keys.has('Space') || keys.has('Enter') || keys.has('KeyJ') || tapAttack;
    tapAttack = false;
    return { moveX: mx, moveY: my, attack };
  }

  return {
    meta: {
      slug: 'wildwood',
      defaultControls: 'both',
      orientation: 'portrait',
      hasLives: false,
      supportsPause: true,
      aspectRatio: 140 / 160,
    },
    init(c) {
      ctx = c;
      registerWildwoodSfx(c.audio);
    },
    start() {
      reset();
    },
    update(dt) {
      clock += dt;
      if (bannerTimer > 0) {
        bannerTimer -= dt;
        if (bannerTimer <= 0) banner = null;
      }
      if (state.phase !== 'play') return;

      const input = buildInput();
      step(state, input, dt, ctx.rng);
      for (const ev of state.events) handleEvent(ev);
    },
    render() {
      draw(ctx.ctx, state, ctx.width, ctx.height, {
        clock,
        best: ctx.score.highScore,
        labels: {
          night: TEXT.night[lang()],
          best: TEXT.best[lang()],
          wood: TEXT.wood[lang()],
          food: TEXT.food[lang()],
        },
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
        touchTarget = pointerToWorld(ctx.width, ctx.height, p.x, p.y);
      },
      onPointerMove(p: PointerInfo) {
        if (touchTarget) touchTarget = pointerToWorld(ctx.width, ctx.height, p.x, p.y);
      },
      onPointerUp() {
        touchTarget = null;
      },
      onTap() {
        // a quick tap (no drag) is an attack swing; movement uses drag instead
        touchTarget = null;
        tapAttack = true;
      },
    },
    destroy() {
      /* no external resources */
    },
  };
}
