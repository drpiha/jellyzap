/**
 * Pure, deterministic Breakout (brick breaker) logic.
 *
 * No DOM, no `Math.random` (an rng is injected where needed), no
 * `requestAnimationFrame`. The simulation runs on an abstract, resolution
 * independent coordinate field (WIDTH x HEIGHT). The renderer maps these
 * abstract units to device pixels, so the logic never needs to know how big the
 * canvas is. All motion is integrated with a delta-time (`dt`, seconds) so the
 * game behaves identically regardless of frame rate.
 */

/** Abstract play-field width in logical units. */
export const WIDTH = 100;
/** Abstract play-field height in logical units. */
export const HEIGHT = 130;

/** Vertical position of the paddle's top edge. */
export const PADDLE_Y = 120;
/** Paddle thickness. */
export const PADDLE_H = 3;
/** Default paddle width. */
export const PADDLE_W = 20;
/** Ball radius. */
export const BALL_R = 1.6;
/** Ball speed (units per second). */
export const BALL_SPEED = 70;
/** Starting number of lives. */
export const START_LIVES = 3;
/** Maximum bounce angle off the paddle, measured from vertical (radians). */
export const MAX_BOUNCE = (60 * Math.PI) / 180;

export type Status = 'playing' | 'won' | 'lost';

export interface Paddle {
  /** centre x of the paddle */
  x: number;
  /** full width of the paddle */
  w: number;
}

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

export interface Brick {
  /** left edge */
  x: number;
  /** top edge */
  y: number;
  w: number;
  h: number;
  alive: boolean;
  /** fill colour (CSS hex) */
  color: string;
  /** hits remaining before the brick breaks */
  hits: number;
  /** points awarded when destroyed */
  points: number;
}

export interface BreakoutState {
  width: number;
  height: number;
  paddle: Paddle;
  ball: Ball;
  bricks: Brick[];
  lives: number;
  score: number;
  status: Status;
  level: number;
  /** true once the ball has been launched off the paddle */
  launched: boolean;
  /** launch speed (units/s); set by difficulty */
  ballSpeed: number;
}

/** Per-difficulty tuning knobs for a fresh game. */
export interface BreakoutOptions {
  lives?: number;
  paddleW?: number;
  ballSpeed?: number;
}

/** What happened during a single {@link step}; useful for SFX/feedback. */
export interface StepEvents {
  wall: boolean;
  paddle: boolean;
  /** number of bricks destroyed this step */
  bricksHit: number;
  /** a life was lost this step */
  lostLife: boolean;
  won: boolean;
  lost: boolean;
}

/** Brick colour rows from top (toughest) to bottom (softest), with point values. */
const ROW_STYLES: { color: string; hits: number; points: number }[] = [
  { color: '#fb7185', hits: 1, points: 7 },
  { color: '#fb923c', hits: 1, points: 6 },
  { color: '#fbbf24', hits: 1, points: 5 },
  { color: '#34d399', hits: 1, points: 4 },
  { color: '#22d3ee', hits: 1, points: 3 },
  { color: '#a855f7', hits: 1, points: 2 },
];

/**
 * Build the brick layout for `level`. Higher levels add rows (up to the number
 * of available colours) and shrink the gaps slightly. Pure: depends only on its
 * argument.
 */
export function buildLevel(level: number): Brick[] {
  const cols = 9;
  const rows = Math.min(ROW_STYLES.length, 3 + level);
  const marginX = 6;
  const top = 14;
  const gap = 1.4;
  const usableW = WIDTH - marginX * 2;
  const brickW = (usableW - gap * (cols - 1)) / cols;
  const brickH = 4;

  const bricks: Brick[] = [];
  for (let r = 0; r < rows; r++) {
    const style = ROW_STYLES[r % ROW_STYLES.length];
    for (let c = 0; c < cols; c++) {
      bricks.push({
        x: marginX + c * (brickW + gap),
        y: top + r * (brickH + gap),
        w: brickW,
        h: brickH,
        alive: true,
        color: style.color,
        hits: style.hits,
        points: style.points,
      });
    }
  }
  return bricks;
}

/** Reset the ball to rest on top of the paddle, ready to be launched. */
export function resetBall(state: BreakoutState): void {
  state.ball.x = state.paddle.x;
  state.ball.y = PADDLE_Y - state.ball.r - 0.1;
  state.ball.vx = 0;
  state.ball.vy = 0;
  state.launched = false;
}

/**
 * Advance an in-progress game to the next level: rebuild a harder brick layout,
 * rest the ball on the paddle, and resume play. Score and lives carry over.
 */
export function advanceLevel(state: BreakoutState): void {
  state.level += 1;
  state.bricks = buildLevel(state.level);
  state.status = 'playing';
  resetBall(state);
}

/** Create a fresh game state at `level` (default 1), optionally tuned by difficulty. */
export function createBreakoutState(level = 1, opts: BreakoutOptions = {}): BreakoutState {
  const state: BreakoutState = {
    width: WIDTH,
    height: HEIGHT,
    paddle: { x: WIDTH / 2, w: opts.paddleW ?? PADDLE_W },
    ball: { x: WIDTH / 2, y: PADDLE_Y - BALL_R - 0.1, vx: 0, vy: 0, r: BALL_R },
    bricks: buildLevel(level),
    lives: opts.lives ?? START_LIVES,
    score: 0,
    status: 'playing',
    level,
    launched: false,
    ballSpeed: opts.ballSpeed ?? BALL_SPEED,
  };
  return state;
}

/** Move the paddle so its centre sits at `x`, clamped to the field. */
export function setPaddle(state: BreakoutState, x: number): void {
  const half = state.paddle.w / 2;
  state.paddle.x = clamp(x, half, WIDTH - half);
  if (!state.launched) {
    // the resting ball rides along with the paddle
    state.ball.x = state.paddle.x;
  }
}

/** Nudge the paddle by `dx` units (keyboard control). */
export function movePaddle(state: BreakoutState, dx: number): void {
  setPaddle(state, state.paddle.x + dx);
}

/** Launch the resting ball upward, angled slightly by the paddle offset. */
export function launchBall(state: BreakoutState): void {
  if (state.launched || state.status !== 'playing') return;
  state.launched = true;
  const angle = -Math.PI / 2 + 0.25; // up and a touch to the right
  const speed = state.ballSpeed || BALL_SPEED;
  state.ball.vx = Math.cos(angle) * speed;
  state.ball.vy = Math.sin(angle) * speed;
}

/**
 * Advance the simulation by `dt` seconds. Mutates `state`. The ball moves,
 * reflects off the side walls and ceiling, bounces off the paddle (the angle
 * depends on where it hits), and destroys bricks on contact. If the ball falls
 * below the bottom edge a life is lost; at zero lives the game is `lost`.
 * Clearing every brick sets the status to `won`.
 *
 * Movement is sub-stepped so the ball cannot tunnel through thin bricks or the
 * paddle at large `dt`.
 */
export function step(state: BreakoutState, dt: number): StepEvents {
  const ev: StepEvents = {
    wall: false,
    paddle: false,
    bricksHit: 0,
    lostLife: false,
    won: false,
    lost: false,
  };
  if (state.status !== 'playing' || dt <= 0) return ev;
  if (!state.launched) return ev;

  const speed = Math.hypot(state.ball.vx, state.ball.vy) || BALL_SPEED;
  // keep each sub-step shorter than the ball radius so collisions never tunnel
  const maxAdvance = state.ball.r * 0.5;
  const steps = Math.max(1, Math.ceil((speed * dt) / maxAdvance));
  const sub = dt / steps;

  for (let i = 0; i < steps && state.status === 'playing'; i++) {
    advance(state, sub, ev);
  }
  return ev;
}

function advance(state: BreakoutState, dt: number, ev: StepEvents): void {
  const ball = state.ball;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  // left / right walls
  if (ball.x - ball.r < 0) {
    ball.x = ball.r;
    ball.vx = Math.abs(ball.vx);
    ev.wall = true;
  } else if (ball.x + ball.r > WIDTH) {
    ball.x = WIDTH - ball.r;
    ball.vx = -Math.abs(ball.vx);
    ev.wall = true;
  }

  // ceiling
  if (ball.y - ball.r < 0) {
    ball.y = ball.r;
    ball.vy = Math.abs(ball.vy);
    ev.wall = true;
  }

  // paddle
  collidePaddle(state, ev);

  // bricks
  collideBricks(state, ev);

  // fell below the bottom edge -> lose the ball
  if (ball.y - ball.r > HEIGHT) {
    loseLife(state, ev);
  }
}

function collidePaddle(state: BreakoutState, ev: StepEvents): void {
  const ball = state.ball;
  if (ball.vy <= 0) return; // only when travelling downward
  const half = state.paddle.w / 2;
  const left = state.paddle.x - half;
  const right = state.paddle.x + half;
  const top = PADDLE_Y;
  const bottom = PADDLE_Y + PADDLE_H;

  const within =
    ball.x + ball.r >= left &&
    ball.x - ball.r <= right &&
    ball.y + ball.r >= top &&
    ball.y - ball.r <= bottom;
  if (!within) return;

  // reflect upward; horizontal speed depends on where it struck the paddle
  const offset = clamp((ball.x - state.paddle.x) / half, -1, 1);
  const angle = -Math.PI / 2 + offset * MAX_BOUNCE;
  const speed = Math.hypot(ball.vx, ball.vy) || BALL_SPEED;
  ball.vx = Math.cos(angle) * speed;
  ball.vy = Math.sin(angle) * speed; // always negative -> upward
  ball.y = top - ball.r; // lift clear so it cannot re-trigger next sub-step
  ev.paddle = true;
}

function collideBricks(state: BreakoutState, ev: StepEvents): void {
  const ball = state.ball;
  for (const brick of state.bricks) {
    if (!brick.alive) continue;
    if (!circleHitsRect(ball.x, ball.y, ball.r, brick.x, brick.y, brick.w, brick.h)) {
      continue;
    }

    // decide reflection axis by the smaller penetration depth
    const ballCx = ball.x;
    const ballCy = ball.y;
    const brickCx = brick.x + brick.w / 2;
    const brickCy = brick.y + brick.h / 2;
    const overlapX = brick.w / 2 + ball.r - Math.abs(ballCx - brickCx);
    const overlapY = brick.h / 2 + ball.r - Math.abs(ballCy - brickCy);

    if (overlapX < overlapY) {
      ball.vx = ballCx < brickCx ? -Math.abs(ball.vx) : Math.abs(ball.vx);
      ball.x += ballCx < brickCx ? -overlapX : overlapX;
    } else {
      ball.vy = ballCy < brickCy ? -Math.abs(ball.vy) : Math.abs(ball.vy);
      ball.y += ballCy < brickCy ? -overlapY : overlapY;
    }

    brick.hits -= 1;
    if (brick.hits <= 0) {
      brick.alive = false;
      state.score += brick.points;
      ev.bricksHit += 1;
      if (state.bricks.every((b) => !b.alive)) {
        state.status = 'won';
        ev.won = true;
      }
    }
    // one brick per sub-step keeps the response stable
    break;
  }
}

function loseLife(state: BreakoutState, ev: StepEvents): void {
  state.lives -= 1;
  ev.lostLife = true;
  if (state.lives <= 0) {
    state.lives = 0;
    state.status = 'lost';
    ev.lost = true;
    return;
  }
  resetBall(state);
}

/** True when a circle overlaps an axis-aligned rectangle. */
function circleHitsRect(
  cx: number,
  cy: number,
  r: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
): boolean {
  const nearestX = clamp(cx, rx, rx + rw);
  const nearestY = clamp(cy, ry, ry + rh);
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy <= r * r;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}
