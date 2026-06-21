/**
 * Pure, deterministic Penalty Shootout logic — no DOM, no Math.random (rng is
 * injected), no requestAnimationFrame.
 *
 * The goal mouth is a grid of `cols × rows` zones (default 3×2 = 6). The player
 * aims at a zone and shoots; the goalkeeper dives to cover one or more zones. If
 * the shot zone is covered it's a SAVE (lose a life); otherwise it's a GOAL.
 * Keeper "reading" and coverage scale with difficulty (see the index).
 */

export type PenaltyPhase = 'aim' | 'result' | 'over';
export type PenaltyResult = 'goal' | 'save';

export interface PenaltyState {
  cols: number;
  rows: number;
  /** number of zones = cols × rows */
  zones: number;
  /** currently selected aim zone (0..zones-1) */
  aim: number;
  /** zones the keeper covered on the last shot */
  keeperZones: number[];
  /** the zone the ball was shot at on the last shot (-1 before any shot) */
  shotZone: number;
  /** outcome of the last shot */
  lastResult: PenaltyResult | null;
  score: number;
  lives: number;
  phase: PenaltyPhase;
}

export interface PenaltyOptions {
  lives?: number;
  cols?: number;
  rows?: number;
}

/** Keeper behaviour for a single shot (supplied per difficulty). */
export interface ShotConfig {
  /** probability [0,1] the keeper dives onto the player's exact zone */
  readChance: number;
  /** how many zones the keeper covers (1 or 2) */
  coverage: number;
}

export function createPenaltyState(opts: PenaltyOptions = {}): PenaltyState {
  const cols = opts.cols ?? 3;
  const rows = opts.rows ?? 2;
  return {
    cols,
    rows,
    zones: cols * rows,
    aim: Math.floor((cols * rows) / 2),
    keeperZones: [],
    shotZone: -1,
    lastResult: null,
    score: 0,
    lives: opts.lives ?? 5,
    phase: 'aim',
  };
}

/** Directly select an aim zone (e.g. from a pointer tap). */
export function setAim(state: PenaltyState, zone: number): void {
  if (state.phase !== 'aim') return;
  if (zone >= 0 && zone < state.zones) state.aim = zone;
}

/** Move the aim by a grid delta (keyboard). Clamps inside the grid. */
export function moveAim(state: PenaltyState, dcol: number, drow: number): void {
  if (state.phase !== 'aim') return;
  const col = state.aim % state.cols;
  const row = Math.floor(state.aim / state.cols);
  const nc = Math.min(state.cols - 1, Math.max(0, col + dcol));
  const nr = Math.min(state.rows - 1, Math.max(0, row + drow));
  state.aim = nr * state.cols + nc;
}

/** Pick a random in-grid neighbour of `zone` (for 2-zone keeper coverage). */
function neighbourZone(zone: number, cols: number, rows: number, rng: () => number): number {
  const col = zone % cols;
  const row = Math.floor(zone / cols);
  const options: number[] = [];
  if (col > 0) options.push(zone - 1);
  if (col < cols - 1) options.push(zone + 1);
  if (row > 0) options.push(zone - cols);
  if (row < rows - 1) options.push(zone + cols);
  if (options.length === 0) return zone;
  return options[Math.floor(rng() * options.length)];
}

/** Compute which zones the keeper covers for a shot aimed at `aim`. */
export function computeKeeperZones(
  state: PenaltyState,
  aim: number,
  rng: () => number,
  cfg: ShotConfig,
): number[] {
  const primary = rng() < cfg.readChance ? aim : Math.floor(rng() * state.zones);
  const zones = [primary];
  if (cfg.coverage >= 2) {
    const adj = neighbourZone(primary, state.cols, state.rows, rng);
    if (adj !== primary) zones.push(adj);
  }
  return zones;
}

/**
 * Take the shot at the current aim zone. Mutates state and returns the outcome.
 * A save costs a life (game over at zero lives); a goal scores a point.
 */
export function shoot(state: PenaltyState, rng: () => number, cfg: ShotConfig): PenaltyResult {
  if (state.phase === 'over') return state.lastResult ?? 'save';
  state.shotZone = state.aim;
  state.keeperZones = computeKeeperZones(state, state.aim, rng, cfg);
  const saved = state.keeperZones.includes(state.aim);
  if (saved) {
    state.lastResult = 'save';
    state.lives -= 1;
    state.phase = state.lives <= 0 ? 'over' : 'result';
  } else {
    state.lastResult = 'goal';
    state.score += 1;
    state.phase = 'result';
  }
  return state.lastResult;
}

/** Advance from the result screen back to aiming (no-op if game over). */
export function nextShot(state: PenaltyState): void {
  if (state.phase !== 'result') return;
  state.keeperZones = [];
  state.shotZone = -1;
  state.lastResult = null;
  state.phase = 'aim';
}
