/**
 * Pure, deterministic Football ("Goal Hunt") logic — no DOM, no Math.random, no
 * requestAnimationFrame. Top-down, time-attack: dribble up the pitch, dodge a
 * defender, and shoot past a sliding keeper to score as many goals as you can.
 *
 * There is NO death — the only pressure is the clock — so it stays gentle for
 * younger players. A tackle simply resets the ball to your start.
 *
 * All distances are in abstract field units (FW × FH); the renderer scales them.
 */

export const FW = 100;
export const FH = 150;
/** goal mouth spans [MOUTH_LEFT, MOUTH_RIGHT] along the top edge (y = 0) */
export const MOUTH_LEFT = 28;
export const MOUTH_RIGHT = 72;
/** y where the keeper patrols / blocks */
export const KEEPER_Y = 8;
/** keeper block half-width and tackle radius */
export const KEEPER_R = 7;
export const TACKLE_R = 7;
export const PLAYER_R = 4;

const START_PLAYER = { x: FW / 2, y: FH - 14 };
const START_DEFENDER = { x: FW / 2, y: FH * 0.5 };

export type Phase = 'play' | 'over';
export type StepEvent = 'none' | 'goal' | 'miss' | 'tackle';

export interface FootballState {
  player: { x: number; y: number };
  defender: { x: number; y: number };
  keeper: { x: number };
  ball: { x: number; y: number; vx: number; vy: number; held: boolean; pastKeeper: boolean };
  score: number;
  timeLeft: number;
  phase: Phase;
  cooldown: number;
  lastEvent: StepEvent;
  // tuning (set per difficulty)
  playerSpeed: number;
  defenderSpeed: number;
  keeperSpeed: number;
  ballSpeed: number;
}

export interface FootballOptions {
  time?: number;
  playerSpeed?: number;
  defenderSpeed?: number;
  keeperSpeed?: number;
  ballSpeed?: number;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

export function createFootballState(opts: FootballOptions = {}): FootballState {
  return {
    player: { ...START_PLAYER },
    defender: { ...START_DEFENDER },
    keeper: { x: FW / 2 },
    ball: { x: START_PLAYER.x, y: START_PLAYER.y - 3, vx: 0, vy: 0, held: true, pastKeeper: false },
    score: 0,
    timeLeft: opts.time ?? 75,
    phase: 'play',
    cooldown: 0,
    lastEvent: 'none',
    playerSpeed: opts.playerSpeed ?? 60,
    defenderSpeed: opts.defenderSpeed ?? 34,
    keeperSpeed: opts.keeperSpeed ?? 34,
    ballSpeed: opts.ballSpeed ?? 95,
  };
}

/** Put the ball back on the player's foot after a goal / miss / tackle. */
function resetPlay(state: FootballState, event: StepEvent): void {
  state.player.x = START_PLAYER.x;
  state.player.y = START_PLAYER.y;
  state.defender.x = START_DEFENDER.x;
  state.defender.y = START_DEFENDER.y;
  state.ball.held = true;
  state.ball.pastKeeper = false;
  state.ball.vx = 0;
  state.ball.vy = 0;
  state.ball.x = state.player.x;
  state.ball.y = state.player.y - 3;
  state.cooldown = 0.8;
  state.lastEvent = event;
}

/** Shoot the held ball straight up the pitch toward the goal. Returns true if shot. */
export function shoot(state: FootballState): boolean {
  if (state.phase !== 'play' || !state.ball.held) return false;
  state.ball.held = false;
  state.ball.pastKeeper = false;
  state.ball.x = state.player.x;
  state.ball.y = state.player.y - PLAYER_R;
  state.ball.vx = 0;
  state.ball.vy = -state.ballSpeed;
  return true;
}

function moveBall(state: FootballState, dt: number): StepEvent {
  const b = state.ball;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  // crossing the keeper line: blocked if the keeper covers the ball's x
  if (!b.pastKeeper && b.y <= KEEPER_Y) {
    b.pastKeeper = true;
    if (Math.abs(b.x - state.keeper.x) <= KEEPER_R) {
      resetPlay(state, 'miss');
      return 'miss';
    }
  }
  // reached the goal line
  if (b.y <= 0) {
    const inGoal = b.x >= MOUTH_LEFT && b.x <= MOUTH_RIGHT;
    if (inGoal) {
      state.score += 1;
      resetPlay(state, 'goal');
      return 'goal';
    }
    resetPlay(state, 'miss');
    return 'miss';
  }
  // off the field
  if (b.x < 0 || b.x > FW || b.y > FH) {
    resetPlay(state, 'miss');
    return 'miss';
  }
  return 'none';
}

/**
 * Advance the simulation by `dt`. `dirX`/`dirY` are the player's intended
 * movement direction in [-1,1] (from keys or a touch target). Returns the
 * notable event this step (for SFX / juice).
 */
export function step(state: FootballState, dirX: number, dirY: number, dt: number): StepEvent {
  if (state.phase === 'over') return 'none';

  state.timeLeft -= dt;
  if (state.cooldown > 0) state.cooldown = Math.max(0, state.cooldown - dt);

  // player
  const len = Math.hypot(dirX, dirY) || 1;
  state.player.x = clamp(state.player.x + (dirX / len) * state.playerSpeed * dt, PLAYER_R, FW - PLAYER_R);
  state.player.y = clamp(
    state.player.y + (dirY / len) * state.playerSpeed * dt,
    PLAYER_R,
    FH - PLAYER_R,
  );

  // defender chases the player
  {
    const dx = state.player.x - state.defender.x;
    const dy = state.player.y - state.defender.y;
    const d = Math.hypot(dx, dy) || 1;
    state.defender.x = clamp(state.defender.x + (dx / d) * state.defenderSpeed * dt, PLAYER_R, FW - PLAYER_R);
    state.defender.y = clamp(state.defender.y + (dy / d) * state.defenderSpeed * dt, PLAYER_R, FH - PLAYER_R);
  }

  // keeper tracks the ball (or the player while the ball is held)
  {
    const targetX = state.ball.held ? state.player.x : state.ball.x;
    const kx = clamp(targetX, MOUTH_LEFT, MOUTH_RIGHT);
    const move = state.keeperSpeed * dt;
    if (Math.abs(kx - state.keeper.x) <= move) state.keeper.x = kx;
    else state.keeper.x += Math.sign(kx - state.keeper.x) * move;
  }

  let ev: StepEvent = 'none';
  if (state.ball.held) {
    state.ball.x = state.player.x;
    state.ball.y = state.player.y - 3;
    if (
      state.cooldown <= 0 &&
      dist(state.player.x, state.player.y, state.defender.x, state.defender.y) < TACKLE_R
    ) {
      resetPlay(state, 'tackle');
      ev = 'tackle';
    }
  } else {
    ev = moveBall(state, dt);
  }

  if (state.timeLeft <= 0) {
    state.timeLeft = 0;
    state.phase = 'over';
  }
  if (ev !== 'none') state.lastEvent = ev;
  return ev;
}
