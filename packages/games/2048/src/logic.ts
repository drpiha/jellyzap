/** Pure, deterministic 2048 logic — no DOM, no Math.random (rng is injected). */

export type Dir = 'up' | 'down' | 'left' | 'right';

/** A 4×4 board of tile values; 0 means an empty cell. */
export type Grid = number[][];

export const SIZE = 4;
export const WIN_VALUE = 2048;

export interface Game2048State {
  grid: Grid;
  score: number;
  /** true once a 2048 tile has appeared */
  won: boolean;
  /** true when no legal move remains */
  over: boolean;
}

/** A fresh, all-empty 4×4 grid. */
export function emptyGrid(): Grid {
  return Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => 0));
}

/** Deep copy of a grid. */
export function cloneGrid(grid: Grid): Grid {
  return grid.map((row) => row.slice());
}

function gridsEqual(a: Grid, b: Grid): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (a[r][c] !== b[r][c]) return false;
    }
  }
  return true;
}

/**
 * Slide + merge a single line toward index 0 (i.e. "left").
 * Equal tiles merge once per move; a tile created by a merge cannot merge again
 * in the same slide. Returns the new line plus the points gained from merges.
 */
function slideLine(line: number[]): { line: number[]; gained: number } {
  const tiles = line.filter((v) => v !== 0);
  const out: number[] = [];
  let gained = 0;
  for (let i = 0; i < tiles.length; i++) {
    if (i + 1 < tiles.length && tiles[i] === tiles[i + 1]) {
      const merged = tiles[i] * 2;
      out.push(merged);
      gained += merged;
      i++; // consume the partner so it can't merge again
    } else {
      out.push(tiles[i]);
    }
  }
  while (out.length < SIZE) out.push(0);
  return { line: out, gained };
}

/** Read the four lines of a grid in the order needed to slide `dir` toward index 0. */
function extractLines(grid: Grid, dir: Dir): number[][] {
  const lines: number[][] = [];
  for (let i = 0; i < SIZE; i++) {
    const line: number[] = [];
    for (let j = 0; j < SIZE; j++) {
      switch (dir) {
        case 'left':
          line.push(grid[i][j]);
          break;
        case 'right':
          line.push(grid[i][SIZE - 1 - j]);
          break;
        case 'up':
          line.push(grid[j][i]);
          break;
        case 'down':
          line.push(grid[SIZE - 1 - j][i]);
          break;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** Write the four slid lines back into a fresh grid, reversing `extractLines`. */
function writeLines(lines: number[][], dir: Dir): Grid {
  const grid = emptyGrid();
  for (let i = 0; i < SIZE; i++) {
    for (let j = 0; j < SIZE; j++) {
      const v = lines[i][j];
      switch (dir) {
        case 'left':
          grid[i][j] = v;
          break;
        case 'right':
          grid[i][SIZE - 1 - j] = v;
          break;
        case 'up':
          grid[j][i] = v;
          break;
        case 'down':
          grid[SIZE - 1 - j][i] = v;
          break;
      }
    }
  }
  return grid;
}

export interface MoveResult {
  grid: Grid;
  gained: number;
  moved: boolean;
}

/**
 * Apply a slide+merge in `dir`. Returns a NEW grid (the input is not mutated),
 * the points gained from merges, and whether anything actually moved.
 */
export function move(grid: Grid, dir: Dir): MoveResult {
  const lines = extractLines(grid, dir);
  let gained = 0;
  const slid = lines.map((line) => {
    const res = slideLine(line);
    gained += res.gained;
    return res.line;
  });
  const next = writeLines(slid, dir);
  const moved = !gridsEqual(grid, next);
  return { grid: next, gained, moved };
}

/** List the [row, col] coordinates of every empty cell. */
export function emptyCells(grid: Grid): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === 0) cells.push([r, c]);
    }
  }
  return cells;
}

/**
 * Add a new tile to a random empty cell: a 2 with 90% probability, a 4 with 10%.
 * Mutates and returns the grid. No-op when the grid is full.
 */
export function spawn(grid: Grid, rng: () => number): Grid {
  spawnCell(grid, rng);
  return grid;
}

/**
 * Like {@link spawn}, but returns the [row, col] of the placed tile (or null
 * when the grid was full). Useful for spawn animations.
 */
export function spawnCell(grid: Grid, rng: () => number): [number, number] | null {
  const cells = emptyCells(grid);
  if (cells.length === 0) return null;
  const [r, c] = cells[Math.floor(rng() * cells.length)];
  grid[r][c] = rng() < 0.9 ? 2 : 4;
  return [r, c];
}

/** True if any direction would change the board. */
export function canMove(grid: Grid): boolean {
  if (emptyCells(grid).length > 0) return true;
  // a merge is possible if two orthogonally adjacent cells are equal
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = grid[r][c];
      if (c + 1 < SIZE && grid[r][c + 1] === v) return true;
      if (r + 1 < SIZE && grid[r + 1][c] === v) return true;
    }
  }
  return false;
}

/** True when the board is locked (no empty cells and no possible merge). */
export function isGameOver(grid: Grid): boolean {
  return !canMove(grid);
}

/** True if any tile has reached the win value. */
export function hasWon(grid: Grid): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] >= WIN_VALUE) return true;
    }
  }
  return false;
}

/** Largest tile value on the board. */
export function maxTile(grid: Grid): number {
  let m = 0;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] > m) m = grid[r][c];
    }
  }
  return m;
}

/** A fresh game state with two starting tiles already spawned. */
export function createState(rng: () => number): Game2048State {
  const grid = emptyGrid();
  spawn(grid, rng);
  spawn(grid, rng);
  return { grid, score: 0, won: false, over: false };
}
