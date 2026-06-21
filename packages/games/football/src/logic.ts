/**
 * Pure, deterministic Football ("Goal Hunt") logic — no DOM, no Math.random, no
 * requestAnimationFrame. Top-down, time-attack: dribble up the pitch, dodge the
 * defenders, and beat the keeper with an AIMED shot.
 *
 * There is NO death — only the clock — so it stays gentle. A tackle just resets
 * the ball to your start. Difficulty scales goal width, keeper reach/skill,
 * defender count/speed and match time (see the index).
 *
 * Movers carry a velocity so the renderer can face them and animate a run cycle.
 */

export const FW = 100;
export const FH = 150;
/** y where the keeper patrols / blocks */
export const KEEPER_Y = 9;
export const PLAYER_R = 4.2;
export const TACKLE_R = 7;
/** seconds the goal celebration freezes play */
export const CELEBRATE_TIME = 1.1;

const START_PLAYER = { x: FW / 2, y: FH - 16 };

export type Phase = 'play' | 'celebrate' | 'over';
export type StepEvent = 'none' | 'goal' | 'miss' | 'tackle';

export interface Mover {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface FootballState {
  player: Mover;
  defenders: Mover[];
  keeper: { x: number; vx: number };
  ball: { x: number; y: number; vx: number; vy: number; held: boolean; pastKeeper: boolean; spin: number };
  score: number;
  timeLeft: number;
  phase: Phase;
  cooldown: number;
  celebrateTimer: number;
  lastEvent: StepEvent;
  // tuning
  playerSpeed: number;
  defenderSpeed: number;
  defenderCount: number;
  keeperSpeed: number;
  keeperReach: number;
  goalW: number;
  ballSpeed: number;
  predictiveKeeper: boolean;
}

export interface FootballOptions {
  time?: number;
  playerSpeed?: number;
  defenderSpeed?: number;
  defenderCount?: number;
  keeperSpeed?: number;
  keeperReach?: number;
  goalW?: number;
  ballSpeed?: number;
  predictiveKeeper?: boolean;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function mouthLeft(state: FootballState): number {
  return (FW - state.goalW) / 2;
}
export function mouthRight(state: FootballState): number {
  return (FW + state.goalW) / 2;
}

/** Defenders start spread across the middle third, in front of the player. */
function placeDefenders(state: FootballState): void {
  const n = state.defenderCount;
  state.defenders = [];
  for (let i = 0; i < n; i++) {
    state.defenders.push({
      x: (FW * (i + 1)) / (n + 1),
      y: FH * (0.42 + 0.1 * (i % 2)),
      vx: 0,
      vy: 0,
    });
  }
}

export function createFootballState(opts: FootballOptions = {}): FootballState {
  const state: FootballState = {
    player: { x: START_PLAYER.x, y: START_PLAYER.y, vx: 0, vy: 0 },
    defenders: [],
    keeper: { x: FW / 2, vx: 0 },
    ball: { x: START_PLAYER.x, y: START_PLAYER.y - 4, vx: 0, vy: 0, held: true, pastKeeper: false, spin: 0 },
    score: 0,
    timeLeft: opts.time ?? 80,
    phase: 'play',
    cooldown: 0,
    celebrateTimer: 0,
    lastEvent: 'none',
    playerSpeed: opts.playerSpeed ?? 62,
    defenderSpeed: opts.defenderSpeed ?? 30,
    defenderCount: opts.defenderCount ?? 1,
    keeperSpeed: opts.keeperSpeed ?? 30,
    keeperReach: opts.keeperReach ?? 9,
    goalW: opts.goalW ?? 52,
    ballSpeed: opts.ballSpeed ?? 96,
    predictiveKeeper: opts.predictiveKeeper ?? false,
  };
  placeDefenders(state);
  return state;
}

function resetPlay(state: FootballState, event: StepEvent): void {
  state.player.x = START_PLAYER.x;
  state.player.y = START_PLAYER.y;
  state.player.vx = 0;
  state.player.vy = 0;
  placeDefenders(state);
  state.keeper.x = FW / 2;
  state.keeper.vx = 0;
  state.ball.held = true;
  state.ball.pastKeeper = false;
  state.ball.vx = 0;
  state.ball.vy = 0;
  state.ball.x = state.player.x;
  state.ball.y = state.player.y - 4;
  state.cooldown = 0.7;
  state.lastEvent = event;
}

/**
 * Shoot the held ball toward (aimX, aimY). The aim is forced to have an upward
 * component (the goal is at the top) so a shot always heads goalward.
 */
export function shoot(state: FootballState, aimX: number, aimY: number): boolean {
  if (state.phase !== 'play' || !state.ball.held) return false;
  const tx = clamp(aimX, 0, FW);
  const ty = Math.min(aimY, state.player.y - 12); // always aim up the pitch
  let dx = tx - state.player.x;
  let dy = ty - state.player.y;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;
  state.ball.held = false;
  state.ball.pastKeeper = false;
  state.ball.x = state.player.x;
  state.ball.y = state.player.y - PLAYER_R;
  state.ball.vx = dx * state.ballSpeed;
  state.ball.vy = dy * state.ballSpeed;
  return true;
}

function moveBall(state: FootballState, dt: number): StepEvent {
  const b = state.ball;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.spin += (Math.hypot(b.vx, b.vy) / 6) * dt;
  // crossing the keeper line: blocked if the keeper covers the ball's x
  if (!b.pastKeeper && b.y <= KEEPER_Y) {
    b.pastKeeper = true;
    if (Math.abs(b.x - state.keeper.x) <= state.keeperReach) {
      resetPlay(state, 'miss');
      return 'miss';
    }
  }
  if (b.y <= 0) {
    const inGoal = b.x >= mouthLeft(state) && b.x <= mouthRight(state);
    if (inGoal) {
      state.score += 1;
      state.celebrateTimer = CELEBRATE_TIME;
      state.phase = 'celebrate';
      state.lastEvent = 'goal';
      return 'goal';
    }
    resetPlay(state, 'miss');
    return 'miss';
  }
  if (b.x < -2 || b.x > FW + 2 || b.y > FH) {
    resetPlay(state, 'miss');
    return 'miss';
  }
  return 'none';
}

function stepKeeper(state: FootballState, dt: number): void {
  let targetX: number;
  if (!state.ball.held && state.ball.vy < 0) {
    if (state.predictiveKeeper) {
      const t = (KEEPER_Y - state.ball.y) / state.ball.vy; // vy<0, ball above line → t>0
      targetX = state.ball.x + state.ball.vx * Math.max(0, t);
    } else {
      targetX = state.ball.x;
    }
  } else {
    targetX = state.player.x; // shade across to the shooter while the ball is held
  }
  targetX = clamp(targetX, mouthLeft(state) + 1, mouthRight(state) - 1);
  const move = state.keeperSpeed * dt;
  const d = targetX - state.keeper.x;
  const stepX = Math.abs(d) <= move ? d : Math.sign(d) * move;
  state.keeper.x += stepX;
  state.keeper.vx = stepX / Math.max(dt, 1e-4);
}

function stepDefenders(state: FootballState, dt: number): void {
  for (const def of state.defenders) {
    // chase a small lead ahead of the player's motion
    const tx = state.player.x + state.player.vx * 0.3;
    const ty = state.player.y + state.player.vy * 0.3;
    const dx = tx - def.x;
    const dy = ty - def.y;
    const d = Math.hypot(dx, dy) || 1;
    const vx = (dx / d) * state.defenderSpeed;
    const vy = (dy / d) * state.defenderSpeed;
    def.x = clamp(def.x + vx * dt, PLAYER_R, FW - PLAYER_R);
    def.y = clamp(def.y + vy * dt, PLAYER_R, FH - PLAYER_R);
    def.vx = vx;
    def.vy = vy;
  }
}

function tackled(state: FootballState): boolean {
  if (state.cooldown > 0) return false;
  for (const def of state.defenders) {
    if (Math.hypot(state.player.x - def.x, state.player.y - def.y) < TACKLE_R) return true;
  }
  return false;
}

/**
 * Advance by `dt`. `dirX`/`dirY` is the player's intended movement direction in
 * [-1,1]. Returns the notable event this step (for SFX / juice).
 */
export function step(state: FootballState, dirX: number, dirY: number, dt: number): StepEvent {
  if (state.phase === 'over') return 'none';

  // goal celebration freezes play (and the clock) briefly
  if (state.phase === 'celebrate') {
    state.celebrateTimer -= dt;
    state.ball.spin += dt * 4;
    if (state.celebrateTimer <= 0) {
      resetPlay(state, 'none');
      state.phase = 'play';
    }
    return 'none';
  }

  state.timeLeft -= dt;
  if (state.cooldown > 0) state.cooldown = Math.max(0, state.cooldown - dt);

  // player movement (velocity stored for facing/animation)
  const len = Math.hypot(dirX, dirY);
  if (len > 0) {
    state.player.vx = (dirX / len) * state.playerSpeed;
    state.player.vy = (dirY / len) * state.playerSpeed;
  } else {
    state.player.vx = 0;
    state.player.vy = 0;
  }
  state.player.x = clamp(state.player.x + state.player.vx * dt, PLAYER_R, FW - PLAYER_R);
  state.player.y = clamp(state.player.y + state.player.vy * dt, PLAYER_R, FH - PLAYER_R);

  stepDefenders(state, dt);
  stepKeeper(state, dt);

  let ev: StepEvent = 'none';
  if (state.ball.held) {
    state.ball.x = state.player.x;
    state.ball.y = state.player.y - 4;
    if (tackled(state)) {
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
