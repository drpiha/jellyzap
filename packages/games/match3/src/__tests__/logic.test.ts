import { describe, expect, it } from 'vitest';
import { mulberry32 } from '@jellyzap/game-sdk';
import {
  EMPTY,
  GEM_TYPES,
  SIZE,
  applyGravity,
  clearMatches,
  createBoard,
  findMatches,
  get,
  idx,
  isValidSwap,
  refill,
  resolveBoard,
  type Board,
} from '../logic';

/** Build an 8×8 board from per-cell values; `f(r,c)` returns a gem id. */
function makeBoard(f: (r: number, c: number) => number): Board {
  const b: Board = new Array(SIZE * SIZE);
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) b[idx(r, c)] = f(r, c);
  return b;
}

/** A board with no possible 3-in-a-row from a base pattern (offset stripes). */
function checker(r: number, c: number): number {
  // 4 distinct ids in a 2×2 tiling repeated → never three identical adjacent
  return ((r % 2) * 2 + (c % 2)) % GEM_TYPES;
}

describe('match3 logic', () => {
  it('findMatches detects a horizontal run of 3', () => {
    const b = makeBoard(checker);
    b[idx(2, 1)] = 5;
    b[idx(2, 2)] = 5;
    b[idx(2, 3)] = 5;
    const cells = findMatches(b);
    expect(cells).toHaveLength(3);
    expect(cells.every((p) => p.r === 2)).toBe(true);
    expect(cells.map((p) => p.c).sort()).toEqual([1, 2, 3]);
  });

  it('findMatches detects a vertical run of 3', () => {
    const b = makeBoard(checker);
    b[idx(1, 4)] = 5;
    b[idx(2, 4)] = 5;
    b[idx(3, 4)] = 5;
    const cells = findMatches(b);
    expect(cells).toHaveLength(3);
    expect(cells.every((p) => p.c === 4)).toBe(true);
    expect(cells.map((p) => p.r).sort()).toEqual([1, 2, 3]);
  });

  it('findMatches detects a run of 4 in a row', () => {
    const b = makeBoard(checker);
    for (let c = 1; c <= 4; c++) b[idx(5, c)] = 5;
    const cells = findMatches(b);
    expect(cells).toHaveLength(4);
    expect(cells.map((p) => p.c).sort()).toEqual([1, 2, 3, 4]);
  });

  it('isValidSwap is true when a swap creates a match', () => {
    // row 0: [0,0,_,1,...] with a matching gem one cell below the gap; swapping
    // fills the gap to complete three-in-a-row.
    const b = makeBoard(checker);
    b[idx(0, 0)] = 0;
    b[idx(0, 1)] = 0;
    b[idx(0, 2)] = 1; // breaks the run
    b[idx(1, 2)] = 0; // swapping (0,2)<->(1,2) puts a 0 at (0,2) → 0,0,0
    // make sure the swap target's new spot doesn't accidentally also matter
    b[idx(1, 1)] = 2;
    b[idx(1, 3)] = 2;
    expect(isValidSwap(b, { r: 0, c: 2 }, { r: 1, c: 2 })).toBe(true);
  });

  it('isValidSwap is false for a swap that makes no match', () => {
    const b = makeBoard(checker);
    // adjacent but swapping two checker cells creates nothing
    expect(isValidSwap(b, { r: 0, c: 0 }, { r: 0, c: 1 })).toBe(false);
  });

  it('isValidSwap is false for non-adjacent cells', () => {
    const b = makeBoard(checker);
    expect(isValidSwap(b, { r: 0, c: 0 }, { r: 2, c: 2 })).toBe(false);
  });

  it('clearMatches + applyGravity moves gems down into emptied cells', () => {
    const b = makeBoard(checker);
    // column 0 top three identical → vertical match, then gravity pulls down
    b[idx(0, 0)] = 5;
    b[idx(1, 0)] = 5;
    b[idx(2, 0)] = 5;
    // record what sits below the matched run before clearing
    const belowBefore: number[] = [];
    for (let r = 3; r < SIZE; r++) belowBefore.push(get(b, r, 0));

    const cleared = clearMatches(b);
    expect(cleared).toBe(3);
    // immediately after clearing, the three cells are empty
    expect(get(b, 0, 0)).toBe(EMPTY);
    expect(get(b, 1, 0)).toBe(EMPTY);
    expect(get(b, 2, 0)).toBe(EMPTY);

    applyGravity(b);
    // the empties have risen to the top three of the column...
    expect(get(b, 0, 0)).toBe(EMPTY);
    expect(get(b, 1, 0)).toBe(EMPTY);
    expect(get(b, 2, 0)).toBe(EMPTY);
    // ...and the survivors stacked at the bottom, in original order
    const bottom: number[] = [];
    for (let r = 3; r < SIZE; r++) bottom.push(get(b, r, 0));
    expect(bottom).toEqual(belowBefore);
  });

  it('refill leaves no empty cells (seeded)', () => {
    const rng = mulberry32(7);
    const b = makeBoard(() => EMPTY);
    refill(b, rng);
    expect(b.some((v) => v === EMPTY)).toBe(false);
    expect(b.every((v) => v >= 0 && v < GEM_TYPES)).toBe(true);
  });

  it('createBoard has no immediate matches (seeded)', () => {
    for (const seed of [1, 42, 123, 999, 2026]) {
      const b = createBoard(mulberry32(seed));
      expect(b).toHaveLength(SIZE * SIZE);
      expect(b.every((v) => v >= 0 && v < GEM_TYPES)).toBe(true);
      expect(findMatches(b)).toHaveLength(0);
    }
  });

  it('resolveBoard settles to a stable, full board with no matches (seeded)', () => {
    const rng = mulberry32(2026);
    const b = makeBoard(checker);
    // seed a match so there is something to resolve
    b[idx(4, 1)] = 5;
    b[idx(4, 2)] = 5;
    b[idx(4, 3)] = 5;
    const res = resolveBoard(b, rng);
    expect(res.cleared).toBeGreaterThanOrEqual(3);
    expect(res.scored).toBeGreaterThan(0);
    expect(findMatches(b)).toHaveLength(0);
    expect(b.some((v) => v === EMPTY)).toBe(false);
  });
});
