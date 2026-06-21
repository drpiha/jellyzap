import { describe, expect, it } from 'vitest';
import { mulberry32 } from '@jellyzap/game-sdk';
import {
  BOARD_H,
  BOARD_W,
  cellsOf,
  clearLines,
  createTetrisState,
  drawFromBag,
  hardDrop,
  isValid,
  lock,
  lockAndNext,
  move,
  PIECE_TYPES,
  rotate,
  spawn,
  spawnPiece,
  type Cell,
  type PieceType,
  type TetrisState,
} from '../logic';

const seeded = () => mulberry32(12345);

/** A blank state with no active piece, for hand-built scenarios. */
function blankState(): TetrisState {
  const grid: Cell[][] = [];
  for (let y = 0; y < BOARD_H; y++) grid.push(new Array<Cell>(BOARD_W).fill(0));
  return {
    cols: BOARD_W,
    rows: BOARD_H,
    grid,
    active: null,
    next: 'I',
    bag: [],
    score: 0,
    lines: 0,
    level: 0,
    over: false,
  };
}

/** A board cell key for set membership in assertions. */
const key = (x: number, y: number) => `${x},${y}`;

describe('tetris logic', () => {
  it('spawns a piece occupying its expected cells', () => {
    const s = blankState();
    s.next = 'I';
    spawn(s, seeded());
    expect(s.active).not.toBeNull();
    const occupied = new Set(cellsOf(s.active!).map(([x, y]) => key(x, y)));
    // I-piece (rot 0) at spawn x=3,y=0 occupies the horizontal row at y=1.
    expect(occupied).toEqual(new Set([key(3, 1), key(4, 1), key(5, 1), key(6, 1)]));
  });

  it('spawnPiece centers a fresh piece at the top', () => {
    const p = spawnPiece('T');
    expect(p).toEqual({ type: 'T', x: 3, y: 0, rot: 0 });
  });

  it('moves left and right but respects the walls', () => {
    const s = blankState();
    s.active = spawnPiece('O'); // O occupies columns 1..2 of its box → board cols 4..5
    expect(move(s, -1)).toBe(true);
    expect(s.active!.x).toBe(2);
    // Slide all the way to the left wall.
    while (move(s, -1)) {
      /* keep moving */
    }
    // O's left-most block sits at box column 1, so x can go down to -1.
    expect(s.active!.x).toBe(-1);
    const leftCells = cellsOf(s.active!);
    expect(Math.min(...leftCells.map(([x]) => x))).toBe(0);
    expect(move(s, -1)).toBe(false);
  });

  it('stops moving when blocked by locked cells', () => {
    const s = blankState();
    s.active = spawnPiece('O'); // board cols 4..5 at rows 0..1
    // Wall off column 6 so the O cannot move right.
    s.grid[0][6] = 'I';
    s.grid[1][6] = 'I';
    expect(move(s, 1)).toBe(false);
    expect(s.active!.x).toBe(3);
  });

  it('rotation changes orientation', () => {
    const s = blankState();
    s.active = spawnPiece('T');
    expect(s.active!.rot).toBe(0);
    expect(rotate(s, 1)).toBe(true);
    expect(s.active!.rot).toBe(1);
    expect(rotate(s, -1)).toBe(true);
    expect(s.active!.rot).toBe(0);
  });

  it('kicks an I-piece off the left wall when rotating, without overlap', () => {
    const s = blankState();
    // Vertical I flush against the left wall: rot 1 occupies box column 2.
    s.active = { type: 'I', x: -2, y: 0, rot: 1 };
    expect(isValid(s.grid, s.active)).toBe(true);
    // Rotating to horizontal (rot 2) at x=-2 would put cells at x=-2..1 → invalid;
    // a wall-kick must shift it right so it fits.
    expect(rotate(s, 1)).toBe(true);
    expect(s.active!.rot).toBe(2);
    expect(isValid(s.grid, s.active)).toBe(true);
    const xs = cellsOf(s.active!).map(([x]) => x);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
  });

  it('rejects a rotation with no valid kick', () => {
    const s = blankState();
    s.active = { type: 'T', x: 3, y: 5, rot: 0 };
    // Surround the piece so neither the rotation nor any x-kick can fit.
    for (let y = 4; y <= 8; y++) {
      for (let x = 0; x < BOARD_W; x++) {
        // leave only the four cells the current T occupies
        const occ = new Set(cellsOf(s.active).map(([cx, cy]) => key(cx, cy)));
        if (!occ.has(key(x, y))) s.grid[y][x] = 'Z';
      }
    }
    const before = s.active.rot;
    expect(rotate(s, 1)).toBe(false);
    expect(s.active.rot).toBe(before);
  });

  it('clears one full row and shifts rows above down', () => {
    const s = blankState();
    // Fill the bottom row completely.
    const bottom = BOARD_H - 1;
    for (let x = 0; x < BOARD_W; x++) s.grid[bottom][x] = 'L';
    // Put a single marker block one row above, at column 0.
    s.grid[bottom - 1][0] = 'T';
    const cleared = clearLines(s);
    expect(cleared).toBe(1);
    // The marker should now sit on the (new) bottom row.
    expect(s.grid[bottom][0]).toBe('T');
    // Every other cell of the bottom row is empty again.
    for (let x = 1; x < BOARD_W; x++) expect(s.grid[bottom][x]).toBe(0);
    // Grid height is preserved.
    expect(s.grid.length).toBe(BOARD_H);
  });

  it('clearing four rows scores 800 × (level + 1)', () => {
    const s = blankState();
    s.level = 0;
    // Build four full rows except one shared empty column, then drop a vertical
    // I-piece into that column so the lock completes all four lines at once.
    const col = 0;
    for (let y = BOARD_H - 4; y < BOARD_H; y++) {
      for (let x = 0; x < BOARD_W; x++) {
        if (x !== col) s.grid[y][x] = 'J';
      }
    }
    // Vertical I (rot 1) occupies box column 2 → place so its column lands on col 0.
    s.active = { type: 'I', x: col - 2, y: BOARD_H - 4, rot: 1 };
    expect(isValid(s.grid, s.active)).toBe(true);
    const res = lockAndNext(s, seeded());
    expect(res.cleared).toBe(4);
    expect(s.score).toBe(800);
    expect(s.lines).toBe(4);

    // And again at level 4 the same clear is worth 800 × 5.
    const s2 = blankState();
    s2.level = 4;
    for (let y = BOARD_H - 4; y < BOARD_H; y++) {
      for (let x = 0; x < BOARD_W; x++) {
        if (x !== col) s2.grid[y][x] = 'J';
      }
    }
    s2.active = { type: 'I', x: col - 2, y: BOARD_H - 4, rot: 1 };
    const before = s2.score;
    lockAndNext(s2, seeded());
    expect(s2.score - before).toBe(800 * 5);
  });

  it('hard drop locks the piece at the bottom and clears a completed line', () => {
    const s = blankState();
    const bottom = BOARD_H - 1;
    // Fill the bottom row except the four columns the horizontal I will fill.
    for (let x = 4; x < BOARD_W; x++) s.grid[bottom][x] = 'O';
    // Horizontal I (rot 0) spans box columns 0..3 → board cols 0..3 at x=0.
    s.active = { type: 'I', x: 0, y: 0, rot: 0 };
    const res = hardDrop(s, seeded());
    expect(res.cleared).toBe(1);
    expect(res.dropped).toBeGreaterThan(0);
  });

  it('the 7-bag yields all seven pieces before any repeats', () => {
    const s = blankState();
    s.bag = [];
    const rng = seeded();
    const drawn: PieceType[] = [];
    for (let i = 0; i < 7; i++) drawn.push(drawFromBag(s, rng));
    expect(new Set(drawn).size).toBe(7);
    for (const t of PIECE_TYPES) expect(drawn).toContain(t);
    // The eighth draw starts a brand new bag → it is allowed to repeat,
    // but the *next seven* must again be a full permutation.
    const drawn2: PieceType[] = [];
    for (let i = 0; i < 7; i++) drawn2.push(drawFromBag(s, rng));
    expect(new Set(drawn2).size).toBe(7);
  });

  it('createTetrisState is deterministic and ready to play', () => {
    const a = createTetrisState(mulberry32(99));
    const b = createTetrisState(mulberry32(99));
    expect(a.active).not.toBeNull();
    expect(a.over).toBe(false);
    expect(a.active!.type).toBe(b.active!.type);
    expect(a.next).toBe(b.next);
  });

  it('flags game over when a spawned piece collides with the stack', () => {
    const s = blankState();
    s.next = 'O';
    // Block the O's spawn footprint (board cols 4..5, rows 0..1).
    for (const [x, y] of cellsOf(spawnPiece('O'))) s.grid[y][x] = 'Z';
    const ok = spawn(s, seeded());
    expect(ok).toBe(false);
    expect(s.over).toBe(true);
  });

  it('lock stamps the active piece type into the grid', () => {
    const s = blankState();
    s.active = { type: 'T', x: 3, y: 5, rot: 0 };
    const cells = cellsOf(s.active);
    lock(s);
    expect(s.active).toBeNull();
    for (const [x, y] of cells) expect(s.grid[y][x]).toBe('T');
  });
});
