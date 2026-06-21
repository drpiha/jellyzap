/**
 * Render-layer "juice" — screen shake + particles + easing helpers.
 *
 * This is purely COSMETIC. It is driven by the host on the render side and never
 * feeds back into game logic, so games stay deterministic. It may therefore use
 * Math.random freely (the determinism check only scans the game packages).
 */
import type { BurstOptions } from './types';

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
}

export interface ParticleSystem {
  burst(x: number, y: number, opts?: BurstOptions): void;
  update(dt: number): void;
  draw(ctx: CanvasRenderingContext2D): void;
  clear(): void;
  readonly count: number;
}

const DEFAULT_PALETTE = ['#ffd166', '#ff6392', '#8ac6ff', '#a0f0c0', '#c79bff'];

/** A tiny pooled particle system. `max` caps live particles (oldest are dropped). */
export function createParticles(max = 280): ParticleSystem {
  const pool: Particle[] = [];

  function pickColor(color: string | string[]): string {
    if (Array.isArray(color)) return color[Math.floor(Math.random() * color.length)] ?? '#fff';
    return color;
  }

  return {
    burst(x, y, opts = {}) {
      const count = opts.count ?? 12;
      const speed = opts.speed ?? 90;
      const spread = opts.spread ?? Math.PI * 2;
      const gravity = opts.gravity ?? 220;
      const life = opts.life ?? 0.6;
      const size = opts.size ?? 4;
      const color = opts.color ?? DEFAULT_PALETTE;
      const full = spread >= Math.PI * 2;
      for (let i = 0; i < count; i++) {
        if (pool.length >= max) pool.shift();
        const ang = full
          ? Math.random() * Math.PI * 2
          : -Math.PI / 2 + (Math.random() - 0.5) * spread;
        const sp = speed * (0.5 + Math.random() * 0.7);
        const ml = life * (0.7 + Math.random() * 0.6);
        pool.push({
          x,
          y,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp,
          life: ml,
          maxLife: ml,
          size: size * (0.6 + Math.random() * 0.8),
          color: pickColor(color),
          gravity,
        });
      }
    },
    update(dt) {
      for (let i = pool.length - 1; i >= 0; i--) {
        const p = pool[i];
        p.life -= dt;
        if (p.life <= 0) {
          pool.splice(i, 1);
          continue;
        }
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    },
    draw(ctx) {
      for (const p of pool) {
        const a = Math.max(0, p.life / p.maxLife);
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        const s = p.size * (0.4 + 0.6 * a);
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      }
      ctx.globalAlpha = 1;
    },
    clear() {
      pool.length = 0;
    },
    get count() {
      return pool.length;
    },
  };
}

export interface Shaker {
  /** add trauma in [0,1]; shake amplitude is proportional to trauma² */
  add(trauma: number): void;
  update(dt: number): void;
  /** current pixel offset to apply to the view */
  offset(): { x: number; y: number };
  readonly trauma: number;
}

/** Trauma-based screen shake (Squirrel Eiserloh style): smooth, self-decaying. */
export function createShaker(maxOffset = 8, decayPerSec = 1.6): Shaker {
  let trauma = 0;
  let t = 0;
  return {
    add(amount) {
      trauma = Math.min(1, Math.max(0, trauma + amount));
    },
    update(dt) {
      t += dt;
      if (trauma > 0) trauma = Math.max(0, trauma - decayPerSec * dt);
    },
    offset() {
      if (trauma <= 0) return { x: 0, y: 0 };
      const power = trauma * trauma;
      // layered sines give a smooth pseudo-random wobble without per-frame RNG
      const x = (Math.sin(t * 47.3) + Math.sin(t * 91.7) * 0.5) * maxOffset * power;
      const y = (Math.cos(t * 53.1) + Math.cos(t * 97.3) * 0.5) * maxOffset * power;
      return { x, y };
    },
    get trauma() {
      return trauma;
    },
  };
}

/** Common easing functions for hand-rolled tweens in game render code. */
export const ease = {
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outElastic: (t: number) => {
    if (t === 0 || t === 1) return t;
    const c4 = (2 * Math.PI) / 3;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
};
