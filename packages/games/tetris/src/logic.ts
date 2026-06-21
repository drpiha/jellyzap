/** Pure, deterministic Tetris logic — no DOM, no Math.random (rng is injected). */

import { shuffle } from '@jellyzap/game-sdk';

export const BOARD_W = 10;
export const BOARD_H = 20;

/** The seven tetromino identities. */
export type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

export const PIECE_TYPES: readonly PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

/** A board cell: 0 = empty, otherwise the PieceType that locked there. */
export type Cell = 0 | PieceType;

export interface Piece {
  type: PieceType;
  /** column of the piece's top-left bounding-box corner */
  x: number;
  /** row of the piece's top-left bounding-box corner */
  y: number;
  /** current rotation index (0..3) */
  rot: number;
}

export interface TetrisState {
  cols: number;
  rows: number;
  /** row-major grid, rows[y][x] */
  grid: Cell[][];
  active: Piece | null;
  /** the next piece type to spawn */
  next: PieceType;
  /** remaining shuffled bag of upcoming pieces (consumed from the end) */
  bag: PieceType[];
  score: number;
  lines: number;
  level: number;
  over: boolean;
}

/**
 * Rotation tables. Each piece has four rotation states; each state is a list of
 * [x, y] offsets relative to the piece's bounding-box top-left corner. These are
 * the classic Super Rotation System shapes laid out in their bounding boxes.
 */
export const SHAPES: Record<PieceType, ReadonlyArray<ReadonlyArray<readonly [number, number]>>> = {
  I: [
    [
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
    ],
    [
      [2, 0],
      [2, 1],
      [2, 2],
      [2, 3],
    ],
    [
      [0, 2],
      [1, 2],
      [2, 2],
      [3, 2],
    ],
    [
      [1, 0],
      [1, 1],
      [1, 2],
      [1, 3],
    ],
  ],
  O: [
    [
      [1, 0],
      [2, 0],
      [1, 1],
      [2, 1],
    ],
    [
      [1, 0],
      [2, 0],
      [1, 1],
      [2, 1],
    ],
    [
      [1, 0],
      [2, 0],
      [1, 1],
      [2, 1],
    ],
    [
      [1, 0],
      [2, 0],
      [1, 1],
      [2, 1],
    ],
  ],
  T: [
    [
      [1, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    [
      [1, 0],
      [1, 1],
      [2, 1],
      [1, 2],
    ],
    [
      [0, 1],
      [1, 1],
      [2, 1],
      [1, 2],
    ],
    [
      [1, 0],
      [0, 1],
      [1, 1],
      [1, 2],
    ],
  ],
  S: [
    [
      [1, 0],
      [2, 0],
      [0, 1],
      [1, 1],
    ],
    [
      [1, 0],
      [1, 1],
      [2, 1],
      [2, 2],
    ],
    [
      [1, 1],
      [2, 1],
      [0, 2],
      [1, 2],
    ],
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 2],
    ],
  ],
  Z: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [2, 1],
    ],
    [
      [2, 0],
      [1, 1],
      [2, 1],
      [1, 2],
    ],
    [
      [0, 1],
      [1, 1],
      [1, 2],
      [2, 2],
    ],
    [
      [1, 0],
      [0, 1],
      [1, 1],
      [0, 2],
    ],
  ],
  J: [
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    [
      [1, 0],
      [2, 0],
      [1, 1],
      [1, 2],
    ],
    [
      [0, 1],
      [1, 1],
      [2, 1],
      [2, 2],
    ],
    [
      [1, 0],
      [1, 1],
      [0, 2],
      [1, 2],
    ],
  ],
  L: [
    [
      [2, 0],
      [0, 1],
      [1, 1],
      [2, 1],
    ],
    [
      [1, 0],
      [1, 1],
      [1, 2],
      [2, 2],
    ],
    [
      [0, 1],
      [1, 1],
      [2, 1],
      [0, 2],
    ],
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [1, 2],
    ],
  ],
};

/** Wall-kick x offsets to try, in order, when a rotation collides. */
export const KICKS: readonly number[] = [-1, 1, -2, 2];

/** Points awarded per simultaneous line clear (index 1..4), before the level multiplier. */
const LINE_SCORES = [0, 100, 300, 500, 800];

function emptyGrid(cols: number, rows: number): Cell[][] {
  const grid: Cell[][] = [];
  for (let y = 0; y < rows; y++) {
    grid.push(new Array<Cell>(cols).fill(0));
  }
  return grid;
}

/** Absolute board cells occupied by `piece` in its current position/rotation. */
export function cellsOf(piece: Piece): Array<readonly [number, number]> {
  const shape = SHAPES[piece.type][piece.rot % 4];
  return shape.map(([dx, dy]) => [piece.x + dx, piece.y + dy] as const);
}

/** True if `piece` fits on `grid` without overlap or going out of bounds. */
export function isValid(grid: Cell[][], piece: Piece): boolean {
  const rows = grid.length;
  const cols = grid[0].length;
  for (const [x, y] of cellsOf(piece)) {
    if (x < 0 || x >= cols || y >= rows) return false;
    // y < 0 (above the board) is allowed during spawn / rotation
    if (y >= 0 && grid[y][x] !== 0) return false;
  }
  return true;
}

/** Refill `bag` from a freshly shuffled set of all seven pieces when empty. */
function ensureBag(state: TetrisState, rng: () => number): void {
  if (state.bag.length === 0) {
    state.bag = shuffle(rng, PIECE_TYPES);
  }
}

/** Pull the next piece type from the 7-bag, refilling as needed. */
export function drawFromBag(state: TetrisState, rng: () => number): PieceType {
  ensureBag(state, rng);
  return state.bag.pop() as PieceType;
}

/** A fresh piece of `type` centered at the top of the board. */
export function spawnPiece(type: PieceType): Piece {
  return { type, x: 3, y: 0, rot: 0 };
}

export function createTetrisState(rng: () => number): TetrisState {
  const state: TetrisState = {
    cols: BOARD_W,
    rows: BOARD_H,
    grid: emptyGrid(BOARD_W, BOARD_H),
    active: null,
    next: 'I',
    bag: [],
    score: 0,
    lines: 0,
    level: 0,
    over: false,
  };
  // Prime the "next" preview, then spawn the first active piece.
  state.next = drawFromBag(state, rng);
  spawn(state, rng);
  return state;
}

/**
 * Spawn the queued `next` piece as the new active piece and refill `next`.
 * If the spawned piece immediately collides, the game is over.
 * Returns true if the spawn succeeded, false on game over.
 */
export function spawn(state: TetrisState, rng: () => number): boolean {
  const piece = spawnPiece(state.next);
  state.next = drawFromBag(state, rng);
  if (!isValid(state.grid, piece)) {
    state.active = piece;
    state.over = true;
    return false;
  }
  state.active = piece;
  return true;
}

/** Attempt to shift the active piece by `dx` columns. Returns true on success. */
export function move(state: TetrisState, dx: number): boolean {
  if (!state.active || state.over) return false;
  const moved = { ...state.active, x: state.active.x + dx };
  if (isValid(state.grid, moved)) {
    state.active = moved;
    return true;
  }
  return false;
}

/**
 * Rotate the active piece clockwise (`dir` = 1) or counter-clockwise (`dir` = -1).
 * If the rotated piece collides, basic wall-kicks (x offsets -1,+1,-2,+2) are
 * tried. Returns true if the piece rotated (possibly after a kick).
 */
export function rotate(state: TetrisState, dir = 1): boolean {
  if (!state.active || state.over) return false;
  const rot = (state.active.rot + (dir > 0 ? 1 : 3)) % 4;
  const rotated = { ...state.active, rot };
  if (isValid(state.grid, rotated)) {
    state.active = rotated;
    return true;
  }
  for (const kx of KICKS) {
    const kicked = { ...rotated, x: rotated.x + kx };
    if (isValid(state.grid, kicked)) {
      state.active = kicked;
      return true;
    }
  }
  return false;
}

/** Move the active piece down one row if possible. Returns true if it moved. */
export function softDrop(state: TetrisState): boolean {
  if (!state.active || state.over) return false;
  const moved = { ...state.active, y: state.active.y + 1 };
  if (isValid(state.grid, moved)) {
    state.active = moved;
    return true;
  }
  return false;
}

/** The piece the active piece would become if dropped straight down. */
export function ghostPiece(state: TetrisState): Piece | null {
  if (!state.active) return null;
  let p = { ...state.active };
  while (true) {
    const moved = { ...p, y: p.y + 1 };
    if (isValid(state.grid, moved)) p = moved;
    else break;
  }
  return p;
}

/** Stamp the active piece into the grid. Does not clear lines or respawn. */
export function lock(state: TetrisState): void {
  if (!state.active) return;
  for (const [x, y] of cellsOf(state.active)) {
    if (y >= 0 && y < state.rows && x >= 0 && x < state.cols) {
      state.grid[y][x] = state.active.type;
    }
  }
  state.active = null;
}

/**
 * Remove all full rows, shifting the rows above down. Returns the number of
 * rows cleared.
 */
export function clearLines(state: TetrisState): number {
  const kept: Cell[][] = [];
  for (let y = 0; y < state.rows; y++) {
    if (state.grid[y].some((c) => c === 0)) kept.push(state.grid[y]);
  }
  const cleared = state.rows - kept.length;
  if (cleared > 0) {
    const fresh: Cell[][] = [];
    for (let i = 0; i < cleared; i++) fresh.push(new Array<Cell>(state.cols).fill(0));
    state.grid = fresh.concat(kept);
  }
  return cleared;
}

/** Apply scoring + level/line bookkeeping for `cleared` simultaneous lines. */
export function applyClear(state: TetrisState, cleared: number): void {
  if (cleared <= 0) return;
  const base = LINE_SCORES[Math.min(cleared, 4)];
  state.score += base * (state.level + 1);
  state.lines += cleared;
  state.level = Math.floor(state.lines / 10);
}

export interface LockResult {
  cleared: number;
  /** false if the next spawn collided → game over */
  spawned: boolean;
}

/**
 * Lock the active piece, clear any completed lines, score them, then spawn the
 * next piece. The high-level "the piece has landed" transition.
 */
export function lockAndNext(state: TetrisState, rng: () => number): LockResult {
  lock(state);
  const cleared = clearLines(state);
  applyClear(state, cleared);
  const spawned = spawn(state, rng);
  return { cleared, spawned };
}

/** Gravity interval in seconds for the current level. Shrinks as you level up. */
export function gravityInterval(level: number): number {
  return Math.max(0.05, 0.8 - level * 0.07);
}

export type StepKind = 'move' | 'lock' | 'over';

export interface StepResult {
  kind: StepKind;
  /** rows cleared on a 'lock' tick (0 otherwise) */
  cleared: number;
  /** false when the post-lock spawn collided → game over */
  spawned: boolean;
}

/**
 * Advance gravity by one tick: drop the active piece, or lock + spawn if it has
 * landed. Mutates `state`. Returns what happened this tick, including how many
 * lines were cleared so callers can drive scoring / SFX.
 */
export function gravityStep(state: TetrisState, rng: () => number): StepResult {
  if (state.over || !state.active) return { kind: 'over', cleared: 0, spawned: false };
  if (softDrop(state)) return { kind: 'move', cleared: 0, spawned: true };
  const res = lockAndNext(state, rng);
  return { kind: res.spawned ? 'lock' : 'over', cleared: res.cleared, spawned: res.spawned };
}

/**
 * Hard drop: slam the active piece to the bottom, lock it and spawn the next.
 * Returns the lock result (and the number of rows fallen as `dropped`).
 */
export function hardDrop(state: TetrisState, rng: () => number): LockResult & { dropped: number } {
  if (!state.active || state.over) return { cleared: 0, spawned: !state.over, dropped: 0 };
  let dropped = 0;
  while (softDrop(state)) dropped++;
  const res = lockAndNext(state, rng);
  return { ...res, dropped };
}
