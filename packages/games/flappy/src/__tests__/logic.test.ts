import { describe, expect, it } from 'vitest';
import { mulberry32 } from '@jellyzap/game-sdk';
import {
  BIRD_RADIUS,
  GAP_HALF,
  GROUND_HEIGHT,
  WORLD_HEIGHT,
  createFlappyState,
  flap,
  hitsBounds,
  hitsPipe,
  maxGapY,
  minGapY,
  randomGapY,
  step,
  type Pipe,
} from '../logic';

const seeded = () => mulberry32(42);

/** A pipe positioned so the bird's x sits inside its column. */
function pipeAtBird(gapY: number, gapHalf = GAP_HALF): Pipe {
  return { x: 0.18, gapY, gapHalf, passed: false };
}

describe('flappy logic — gravity & flap', () => {
  it('gravity increases downward velocity and moves the bird down over dt', () => {
    const s = createFlappyState();
    s.started = true;
    const y0 = s.y;
    const vy0 = s.vy;
    step(s, 1 / 60, seeded());
    expect(s.vy).toBeGreaterThan(vy0); // y grows downward → positive vy is "down"
    expect(s.y).toBeGreaterThan(y0); // bird fell
  });

  it('does not move before the first flap (idle hover)', () => {
    const s = createFlappyState();
    const y0 = s.y;
    const r = step(s, 1 / 60, seeded());
    expect(r).toBe('idle');
    expect(s.y).toBe(y0);
    expect(s.vy).toBe(0);
  });

  it('flap makes the velocity point upward (negative, since y grows downward)', () => {
    const s = createFlappyState();
    s.started = true;
    s.vy = 0.5; // falling
    flap(s);
    expect(s.vy).toBeLessThan(0);
  });

  it('flap starts the round', () => {
    const s = createFlappyState();
    expect(s.started).toBe(false);
    flap(s);
    expect(s.started).toBe(true);
  });

  it('a flap reduces how far the bird falls compared with no flap', () => {
    const a = createFlappyState();
    a.started = true;
    const b = createFlappyState();
    b.started = true;
    flap(b);
    step(a, 0.1, seeded());
    step(b, 0.1, seeded());
    expect(b.y).toBeLessThan(a.y); // flapped bird is higher (smaller y)
  });
});

describe('flappy logic — pipe gap generation', () => {
  it('generates gapY strictly within the legal vertical bounds', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 500; i++) {
      const gapY = randomGapY(rng, GAP_HALF);
      expect(gapY).toBeGreaterThanOrEqual(minGapY(GAP_HALF));
      expect(gapY).toBeLessThanOrEqual(maxGapY(GAP_HALF));
      // the whole gap stays inside the playfield (above the ground, below the ceiling)
      expect(gapY - GAP_HALF).toBeGreaterThan(0);
      expect(gapY + GAP_HALF).toBeLessThan(WORLD_HEIGHT - GROUND_HEIGHT);
    }
  });

  it('is deterministic for a given seed', () => {
    const a = mulberry32(99);
    const b = mulberry32(99);
    const seqA = Array.from({ length: 10 }, () => randomGapY(a, GAP_HALF));
    const seqB = Array.from({ length: 10 }, () => randomGapY(b, GAP_HALF));
    expect(seqA).toEqual(seqB);
  });

  it('spawned pipes (via step) have in-bounds gaps and are deterministic with a seed', () => {
    function run(seed: number): number[] {
      const s = createFlappyState();
      s.started = true;
      const rng = mulberry32(seed);
      // advance enough to spawn several pipes
      for (let i = 0; i < 600; i++) {
        if (!s.alive) break;
        s.y = WORLD_HEIGHT / 2; // keep it alive: park bird in a safe band
        s.vy = 0;
        step(s, 1 / 60, rng);
      }
      return s.pipes.map((p) => p.gapY);
    }
    const r1 = run(123);
    const r2 = run(123);
    expect(r1.length).toBeGreaterThan(0);
    expect(r1).toEqual(r2);
    for (const gy of r1) {
      expect(gy).toBeGreaterThanOrEqual(minGapY(GAP_HALF));
      expect(gy).toBeLessThanOrEqual(maxGapY(GAP_HALF));
    }
  });
});

describe('flappy logic — collision', () => {
  it('collides when the bird overlaps a pipe (outside the gap)', () => {
    const s = createFlappyState();
    s.started = true;
    s.y = 0.2; // near the top
    const pipe = pipeAtBird(0.7); // gap is low; bird at 0.2 is in the solid top pipe
    expect(hitsPipe(s, pipe)).toBe(true);
  });

  it('does not collide when the bird is safely within the gap', () => {
    const s = createFlappyState();
    s.started = true;
    s.y = 0.45;
    const pipe = pipeAtBird(0.45); // gap centred on the bird
    expect(hitsPipe(s, pipe)).toBe(false);
  });

  it('does not collide when the pipe is far away horizontally', () => {
    const s = createFlappyState();
    s.started = true;
    s.y = 0.2;
    const pipe: Pipe = { x: 0.55, gapY: 0.7, gapHalf: GAP_HALF, passed: false };
    expect(hitsPipe(s, pipe)).toBe(false);
  });

  it('step sets alive=false and returns "dead" on a pipe hit', () => {
    const s = createFlappyState();
    s.started = true;
    s.y = 0.2;
    s.vy = 0;
    s.pipes = [pipeAtBird(0.78)];
    s.nextPipeX = 999; // suppress further spawns during this step
    const r = step(s, 1 / 1000, seeded());
    expect(r).toBe('dead');
    expect(s.alive).toBe(false);
  });

  it('detects hitting the ground', () => {
    const s = createFlappyState();
    s.y = WORLD_HEIGHT - GROUND_HEIGHT - BIRD_RADIUS * 0.5; // overlapping the floor
    expect(hitsBounds(s)).toBe(true);
  });

  it('detects hitting the ceiling', () => {
    const s = createFlappyState();
    s.y = BIRD_RADIUS * 0.5; // overlapping the top
    expect(hitsBounds(s)).toBe(true);
  });

  it('does not flag bounds when comfortably in the middle', () => {
    const s = createFlappyState();
    s.y = WORLD_HEIGHT / 2;
    expect(hitsBounds(s)).toBe(false);
  });
});

describe('flappy logic — scoring', () => {
  it('increments score exactly once as a pipe passes the bird', () => {
    const s = createFlappyState();
    s.started = true;
    s.y = WORLD_HEIGHT / 2;
    s.vy = 0;
    s.nextPipeX = 999; // no new spawns
    // A pipe already fully behind the bird in x, not yet counted.
    s.pipes = [{ x: 0.05, gapY: WORLD_HEIGHT / 2, gapHalf: GAP_HALF, passed: false }];

    const r1 = step(s, 1 / 1000, seeded());
    expect(r1).toBe('score');
    expect(s.score).toBe(1);
    expect(s.pipes[0].passed).toBe(true);

    // Stepping again must NOT double-count the same pipe.
    s.y = WORLD_HEIGHT / 2;
    s.vy = 0;
    const r2 = step(s, 1 / 1000, seeded());
    expect(r2).not.toBe('score');
    expect(s.score).toBe(1);
  });

  it('does not score a pipe whose centre is still ahead of the bird', () => {
    const s = createFlappyState();
    s.started = true;
    s.y = WORLD_HEIGHT / 2;
    s.vy = 0;
    s.nextPipeX = 999;
    s.pipes = [{ x: 0.45, gapY: WORLD_HEIGHT / 2, gapHalf: GAP_HALF, passed: false }];
    const r = step(s, 1 / 1000, seeded());
    expect(s.score).toBe(0);
    expect(r).not.toBe('score');
  });
});
