/**
 * Pure, deterministic Flappy logic — no DOM, no Math.random (rng is injected),
 * no requestAnimationFrame. Physics is frame-rate independent: it advances by the
 * `dt` (seconds) passed to {@link step}.
 *
 * Everything lives in a normalized "world" coordinate space so the logic is
 * resolution independent — the renderer scales it to pixels. The world is
 * `WORLD_HEIGHT` tall (1.0) and `WORLD_WIDTH` wide; y grows DOWNWARD (0 = top,
 * WORLD_HEIGHT = bottom), matching canvas convention. Therefore an upward flap
 * sets a NEGATIVE vertical velocity.
 */

/** World is one unit tall; y=0 is the top, y=WORLD_HEIGHT is the bottom. */
export const WORLD_HEIGHT = 1.0;
/** World width in the same units (portrait-ish play field). */
export const WORLD_WIDTH = 0.6;

/** Downward gravity acceleration (world units / s²). */
export const GRAVITY = 2.4;
/** Upward velocity applied on a flap (negative = up). */
export const FLAP_VELOCITY = -0.9;
/** Terminal downward speed so the bird never tunnels through pipes. */
export const MAX_FALL_SPEED = 1.3;

/** Horizontal scroll speed of the pipes (world units / s). */
export const PIPE_SPEED = 0.42;
/** Horizontal gap between consecutive pipes (world units). */
export const PIPE_SPACING = 0.38;
/** Half-width of a pipe column (world units). */
export const PIPE_HALF_WIDTH = 0.06;
/** Default half-height of the passable gap between top/bottom pipe. */
export const GAP_HALF = 0.13;

/** Fixed horizontal position of the bird (world units from the left). */
export const BIRD_X = 0.18;
/** Bird collision radius (world units). */
export const BIRD_RADIUS = 0.045;

/** Height of the ground strip at the bottom (collision floor sits above it). */
export const GROUND_HEIGHT = 0.08;

/**
 * Vertical margin kept between a gap centre and the ceiling/ground so a gap is
 * always reachable and never clipped by the edges.
 */
export const GAP_MARGIN = 0.06;

export interface Pipe {
  /** centre x of the pipe column, in world units */
  x: number;
  /** centre y of the passable gap, in world units */
  gapY: number;
  /** half-height of the passable gap */
  gapHalf: number;
  /** whether this pipe has already been counted toward the score */
  passed: boolean;
}

export interface FlappyState {
  /** bird vertical position (world units, y grows downward) */
  y: number;
  /** bird vertical velocity (world units / s; negative = moving up) */
  vy: number;
  pipes: Pipe[];
  score: number;
  alive: boolean;
  /** true before the first flap — the bird hovers and pipes do not scroll */
  started: boolean;
  /** x at which the next pipe will be spawned (tracks the scroll) */
  nextPipeX: number;
  /** gravity (world units/s²) — tunable per difficulty */
  gravity: number;
  /** half-height of the passable gap — tunable per difficulty */
  gapHalf: number;
  /** pipe scroll speed (world units/s) — tunable per difficulty */
  pipeSpeed: number;
}

/** Per-game difficulty knobs (defaults reproduce the original tuning). */
export interface FlappyOptions {
  gravity?: number;
  gapHalf?: number;
  pipeSpeed?: number;
}

/** The lowest (smallest y) a gap centre may be placed. */
export function minGapY(gapHalf: number): number {
  return GAP_MARGIN + gapHalf;
}

/** The highest (largest y) a gap centre may be placed (above the ground). */
export function maxGapY(gapHalf: number): number {
  return WORLD_HEIGHT - GROUND_HEIGHT - GAP_MARGIN - gapHalf;
}

/** Pick a gap centre within the legal vertical bounds using the injected rng. */
export function randomGapY(rng: () => number, gapHalf: number = GAP_HALF): number {
  const lo = minGapY(gapHalf);
  const hi = maxGapY(gapHalf);
  if (hi <= lo) return WORLD_HEIGHT / 2;
  return lo + rng() * (hi - lo);
}

export function createFlappyState(opts: FlappyOptions = {}): FlappyState {
  return {
    y: WORLD_HEIGHT / 2,
    vy: 0,
    pipes: [],
    score: 0,
    alive: true,
    started: false,
    nextPipeX: WORLD_WIDTH + PIPE_SPACING,
    gravity: opts.gravity ?? GRAVITY,
    gapHalf: opts.gapHalf ?? GAP_HALF,
    pipeSpeed: opts.pipeSpeed ?? PIPE_SPEED,
  };
}

/** Apply an upward impulse. The first flap also starts the round. */
export function flap(state: FlappyState): void {
  if (!state.alive) return;
  state.started = true;
  state.vy = FLAP_VELOCITY;
}

function spawnPipe(state: FlappyState, rng: () => number): void {
  state.pipes.push({
    x: state.nextPipeX,
    gapY: randomGapY(rng, state.gapHalf),
    gapHalf: state.gapHalf,
    passed: false,
  });
  state.nextPipeX += PIPE_SPACING;
}

/** Does the bird (circle at BIRD_X, state.y) overlap the given pipe column? */
export function hitsPipe(state: FlappyState, pipe: Pipe): boolean {
  // Closest point on the pipe column (in x) to the bird centre.
  const left = pipe.x - PIPE_HALF_WIDTH;
  const right = pipe.x + PIPE_HALF_WIDTH;
  const nearestX = Math.max(left, Math.min(BIRD_X, right));
  const dx = BIRD_X - nearestX;
  // Bird does not horizontally reach this pipe at all.
  if (Math.abs(dx) > BIRD_RADIUS) return false;
  // Within the column's x-span: collide unless the bird is inside the gap.
  const topOfGap = pipe.gapY - pipe.gapHalf;
  const bottomOfGap = pipe.gapY + pipe.gapHalf;
  const insideGap =
    state.y - BIRD_RADIUS >= topOfGap && state.y + BIRD_RADIUS <= bottomOfGap;
  return !insideGap;
}

/** Did the bird hit the ceiling or the ground? */
export function hitsBounds(state: FlappyState): boolean {
  const floor = WORLD_HEIGHT - GROUND_HEIGHT;
  return state.y - BIRD_RADIUS <= 0 || state.y + BIRD_RADIUS >= floor;
}

export type StepResult = 'idle' | 'fly' | 'score' | 'dead';

/**
 * Advance the simulation by `dt` seconds. Mutates `state`. Frame-rate
 * independent. Returns a coarse description of what happened this step.
 *
 * Note: the score can advance by at most one per step here; pass small, fixed
 * timesteps (the host uses a fixed-step accumulator) for stable behaviour.
 */
export function step(state: FlappyState, dt: number, rng: () => number): StepResult {
  if (!state.alive) return 'dead';

  // Before the first flap the bird gently hovers and the world is still.
  if (!state.started) {
    return 'idle';
  }

  // Integrate vertical motion (gravity), clamped to a terminal speed.
  state.vy += state.gravity * dt;
  if (state.vy > MAX_FALL_SPEED) state.vy = MAX_FALL_SPEED;
  state.y += state.vy * dt;

  // Scroll pipes left and the spawn marker with them.
  const advance = state.pipeSpeed * dt;
  for (const p of state.pipes) p.x -= advance;
  state.nextPipeX -= advance;

  // Spawn while there is room ahead of the right edge.
  while (state.nextPipeX <= WORLD_WIDTH + PIPE_SPACING) {
    spawnPipe(state, rng);
  }

  // Drop pipes that have fully scrolled off the left edge.
  if (state.pipes.length && state.pipes[0].x < -PIPE_HALF_WIDTH - BIRD_RADIUS) {
    state.pipes.shift();
  }

  // Scoring: a pipe is passed once its centre crosses behind the bird.
  let scored = false;
  for (const p of state.pipes) {
    if (!p.passed && p.x + PIPE_HALF_WIDTH < BIRD_X - BIRD_RADIUS) {
      p.passed = true;
      state.score += 1;
      scored = true;
    }
  }

  // Collision: ceiling/ground first, then any pipe.
  if (hitsBounds(state)) {
    state.alive = false;
    return 'dead';
  }
  for (const p of state.pipes) {
    if (hitsPipe(state, p)) {
      state.alive = false;
      return 'dead';
    }
  }

  return scored ? 'score' : 'fly';
}
