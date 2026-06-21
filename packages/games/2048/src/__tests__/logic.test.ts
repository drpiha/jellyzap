import { describe, expect, it } from 'vitest';
import { mulberry32 } from '@jellyzap/game-sdk';
import {
  canMove,
  emptyCells,
  isGameOver,
  move,
  spawn,
  type Grid,
} from '../logic';

const seeded = () => mulberry32(123);

describe('2048 move — slide & merge', () => {
  it('merges a pair sliding left: [2,2,0,0] → [4,0,0,0] gained 4', () => {
    const grid: Grid = [
      [2, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const res = move(grid, 'left');
    expect(res.grid[0]).toEqual([4, 0, 0, 0]);
    expect(res.gained).toBe(4);
    expect(res.moved).toBe(true);
  });

  it('does not triple-merge: [2,2,2,2] left → [4,4,0,0] gained 8', () => {
    const grid: Grid = [
      [2, 2, 2, 2],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const res = move(grid, 'left');
    expect(res.grid[0]).toEqual([4, 4, 0, 0]);
    expect(res.gained).toBe(8);
  });

  it('compacts across gaps: [2,0,2,0] left → [4,0,0,0]', () => {
    const grid: Grid = [
      [2, 0, 2, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const res = move(grid, 'left');
    expect(res.grid[0]).toEqual([4, 0, 0, 0]);
    expect(res.gained).toBe(4);
  });

  it('slides and merges right correctly', () => {
    const grid: Grid = [
      [2, 0, 2, 4],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const res = move(grid, 'right');
    expect(res.grid[0]).toEqual([0, 0, 4, 4]);
    expect(res.gained).toBe(4);
    expect(res.moved).toBe(true);
  });

  it('slides and merges up correctly', () => {
    const grid: Grid = [
      [2, 0, 0, 0],
      [2, 0, 0, 0],
      [4, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const res = move(grid, 'up');
    expect(res.grid.map((row) => row[0])).toEqual([4, 4, 0, 0]);
    expect(res.gained).toBe(4);
  });

  it('slides and merges down correctly', () => {
    const grid: Grid = [
      [4, 0, 0, 0],
      [2, 0, 0, 0],
      [2, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const res = move(grid, 'down');
    expect(res.grid.map((row) => row[0])).toEqual([0, 0, 4, 4]);
    expect(res.gained).toBe(4);
  });

  it('reports moved:false for a no-op move', () => {
    const grid: Grid = [
      [2, 4, 8, 16],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const res = move(grid, 'left');
    expect(res.moved).toBe(false);
    expect(res.gained).toBe(0);
    expect(res.grid).toEqual(grid);
  });

  it('does not mutate the input grid', () => {
    const grid: Grid = [
      [2, 2, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const snapshot = grid.map((row) => row.slice());
    move(grid, 'left');
    expect(grid).toEqual(snapshot);
  });
});

describe('2048 spawn', () => {
  it('reduces the empty-cell count by one and places only a 2 or 4', () => {
    const grid: Grid = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    const before = emptyCells(grid).length;
    const rng = seeded();
    spawn(grid, rng);
    const after = emptyCells(grid).length;
    expect(after).toBe(before - 1);

    const values = grid.flat().filter((v) => v !== 0);
    expect(values).toHaveLength(1);
    expect([2, 4]).toContain(values[0]);
  });

  it('only ever places 2 or 4 across many seeded spawns', () => {
    for (let seed = 0; seed < 50; seed++) {
      const grid: Grid = [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ];
      spawn(grid, mulberry32(seed));
      const v = grid.flat().find((x) => x !== 0);
      expect([2, 4]).toContain(v);
    }
  });

  it('is a no-op on a full grid', () => {
    const grid: Grid = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ];
    const snapshot = grid.map((row) => row.slice());
    spawn(grid, seeded());
    expect(grid).toEqual(snapshot);
  });
});

describe('2048 game-over detection', () => {
  it('isGameOver is true on a full board with no merges', () => {
    const grid: Grid = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ];
    expect(canMove(grid)).toBe(false);
    expect(isGameOver(grid)).toBe(true);
  });

  it('isGameOver is false when an adjacent merge exists', () => {
    const grid: Grid = [
      [2, 2, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 4],
      [4, 2, 4, 2],
    ];
    expect(canMove(grid)).toBe(true);
    expect(isGameOver(grid)).toBe(false);
  });

  it('isGameOver is false when an empty cell exists', () => {
    const grid: Grid = [
      [2, 4, 2, 4],
      [4, 2, 4, 2],
      [2, 4, 2, 0],
      [4, 2, 4, 2],
    ];
    expect(isGameOver(grid)).toBe(false);
  });
});
