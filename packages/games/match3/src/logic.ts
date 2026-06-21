/** Pure, deterministic Match-3 logic — no DOM, no Math.random (rng is injected). */

/** Number of distinct gem types (ids 0..5). */
export const GEM_TYPES = 6;
/** Board side length (8×8). */
export const SIZE = 8;
/** An empty cell (used transiently between clear → gravity → refill). */
export const EMPTY = -1;

/** Base points awarded for each cleared gem. */
export const BASE_POINTS = 10;

/** Board is a flat row-major array of gem type ids (0..5) or EMPTY. */
export type Board = number[];

export interface Cell {
  r: number;
  c: number;
}

export interface MatchState {
  board: Board;
  score: number;
  /** highest cascade chain reached in the most recent resolve (for HUD/sfx) */
  lastCascade: number;
  /** gems cleared in the most recent resolve */
  lastCleared: number;
}

export function idx(r: number, c: number): number {
  return r * SIZE + c;
}

export function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
}

export function get(board: Board, r: number, c: number): number {
  return board[idx(r, c)];
}

export function areAdjacent(a: Cell, b: Cell): boolean {
  const dr = Math.abs(a.r - b.r);
  const dc = Math.abs(a.c - b.c);
  return dr + dc === 1;
}

/**
 * Generate a full board with NO pre-existing matches. We fill cell by cell and
 * reject any gem that would complete a run of 3 with the two cells already
 * placed to its left or above, picking from the remaining candidates instead.
 */
export function createBoard(rng: () => number): Board {
  const board: Board = new Array(SIZE * SIZE).fill(EMPTY);
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const forbidden = new Set<number>();
      // would create a horizontal triple with the two cells to the left
      if (c >= 2 && get(board, r, c - 1) === get(board, r, c - 2)) {
        forbidden.add(get(board, r, c - 1));
      }
      // would create a vertical triple with the two cells above
      if (r >= 2 && get(board, r - 1, c) === get(board, r - 2, c)) {
        forbidden.add(get(board, r - 1, c));
      }
      const candidates: number[] = [];
      for (let t = 0; t < GEM_TYPES; t++) if (!forbidden.has(t)) candidates.push(t);
      board[idx(r, c)] = candidates[Math.floor(rng() * candidates.length)];
    }
  }
  return board;
}

/**
 * Find every cell that is part of a horizontal or vertical run of 3+ identical
 * gems. Returns a flat list of unique matched cells.
 */
export function findMatches(board: Board): Cell[] {
  const matched = new Array<boolean>(SIZE * SIZE).fill(false);

  // horizontal runs
  for (let r = 0; r < SIZE; r++) {
    let runStart = 0;
    for (let c = 1; c <= SIZE; c++) {
      const same =
        c < SIZE && get(board, r, c) !== EMPTY && get(board, r, c) === get(board, r, runStart);
      if (!same) {
        const len = c - runStart;
        if (len >= 3) for (let k = runStart; k < c; k++) matched[idx(r, k)] = true;
        runStart = c;
      }
    }
  }

  // vertical runs
  for (let c = 0; c < SIZE; c++) {
    let runStart = 0;
    for (let r = 1; r <= SIZE; r++) {
      const same =
        r < SIZE && get(board, r, c) !== EMPTY && get(board, r, c) === get(board, runStart, c);
      if (!same) {
        const len = r - runStart;
        if (len >= 3) for (let k = runStart; k < r; k++) matched[idx(k, c)] = true;
        runStart = r;
      }
    }
  }

  const cells: Cell[] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (matched[idx(r, c)]) cells.push({ r, c });
    }
  }
  return cells;
}

/** Swap two cells in place. */
export function applySwap(board: Board, a: Cell, b: Cell): void {
  const ia = idx(a.r, a.c);
  const ib = idx(b.r, b.c);
  const tmp = board[ia];
  board[ia] = board[ib];
  board[ib] = tmp;
}

/**
 * True only when `a` and `b` are adjacent AND swapping them produces at least
 * one match. Pure: operates on a copy.
 */
export function isValidSwap(board: Board, a: Cell, b: Cell): boolean {
  if (!inBounds(a.r, a.c) || !inBounds(b.r, b.c)) return false;
  if (!areAdjacent(a, b)) return false;
  if (get(board, a.r, a.c) === EMPTY || get(board, b.r, b.c) === EMPTY) return false;
  const copy = board.slice();
  applySwap(copy, a, b);
  return findMatches(copy).length > 0;
}

/**
 * Clear all currently-matched cells (set to EMPTY). Returns the number of gems
 * cleared.
 */
export function clearMatches(board: Board): number {
  const cells = findMatches(board);
  for (const { r, c } of cells) board[idx(r, c)] = EMPTY;
  return cells.length;
}

/**
 * Make gems fall into empty cells below them, column by column. Empties end up
 * at the top of each column.
 */
export function applyGravity(board: Board): void {
  for (let c = 0; c < SIZE; c++) {
    let write = SIZE - 1;
    for (let r = SIZE - 1; r >= 0; r--) {
      const v = get(board, r, c);
      if (v !== EMPTY) {
        board[idx(write, c)] = v;
        write--;
      }
    }
    for (let r = write; r >= 0; r--) board[idx(r, c)] = EMPTY;
  }
}

/** Fill every empty cell with a fresh random gem (from the top). */
export function refill(board: Board, rng: () => number): void {
  for (let i = 0; i < board.length; i++) {
    if (board[i] === EMPTY) board[i] = Math.floor(rng() * GEM_TYPES);
  }
}

/**
 * Is there any legal move on the current board? Tries swapping each cell with
 * its right and bottom neighbour.
 */
export function hasAnyValidMove(board: Board): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (c + 1 < SIZE && isValidSwap(board, { r, c }, { r, c: c + 1 })) return true;
      if (r + 1 < SIZE && isValidSwap(board, { r, c }, { r: r + 1, c })) return true;
    }
  }
  return false;
}

/** Points for clearing `n` gems in a single group on cascade chain `chain` (1-based). */
export function scoreFor(n: number, chain: number): number {
  // bigger groups score more than the sum of their parts; deeper cascades multiply
  const groupBonus = n + Math.max(0, n - 3); // 3→3, 4→5, 5→7 ...
  return BASE_POINTS * groupBonus * chain;
}

/** Partition matched cells into 4-connected groups (one per contiguous run/blob). */
export function groupMatches(cells: Cell[]): Cell[][] {
  const present = new Set(cells.map((p) => idx(p.r, p.c)));
  const seen = new Set<number>();
  const groups: Cell[][] = [];
  for (const start of cells) {
    if (seen.has(idx(start.r, start.c))) continue;
    const group: Cell[] = [];
    const stack: Cell[] = [start];
    seen.add(idx(start.r, start.c));
    while (stack.length) {
      const cur = stack.pop() as Cell;
      group.push(cur);
      const neighbours = [
        { r: cur.r - 1, c: cur.c },
        { r: cur.r + 1, c: cur.c },
        { r: cur.r, c: cur.c - 1 },
        { r: cur.r, c: cur.c + 1 },
      ];
      for (const nb of neighbours) {
        if (!inBounds(nb.r, nb.c)) continue;
        const id = idx(nb.r, nb.c);
        if (present.has(id) && !seen.has(id)) {
          seen.add(id);
          stack.push(nb);
        }
      }
    }
    groups.push(group);
  }
  return groups;
}

/**
 * Total points for the cells cleared in one resolve step. Each connected group is
 * scored on its own size (so two separate 3-runs score 3+3, not one inflated 6).
 */
export function scoreMatches(cells: Cell[], chain: number): number {
  let total = 0;
  for (const group of groupMatches(cells)) total += scoreFor(group.length, chain);
  return total;
}

export interface ResolveResult {
  /** total gems cleared across all cascade steps */
  cleared: number;
  /** total points scored */
  scored: number;
  /** number of cascade steps that produced matches */
  cascades: number;
}

/**
 * Resolve the board to a stable state: repeatedly clear matches, apply gravity
 * and refill until no matches remain. Mutates `board`. Deterministic given rng.
 */
export function resolveBoard(board: Board, rng: () => number): ResolveResult {
  let cleared = 0;
  let scored = 0;
  let chain = 0;
  // a hard cap guards against pathological loops; a real board always settles
  for (let guard = 0; guard < SIZE * SIZE * 2; guard++) {
    const matches = findMatches(board);
    if (matches.length === 0) break;
    chain++;
    cleared += matches.length;
    scored += scoreMatches(matches, chain);
    for (const { r, c } of matches) board[idx(r, c)] = EMPTY;
    applyGravity(board);
    refill(board, rng);
  }
  return { cleared, scored, cascades: chain };
}

export function createMatchState(rng: () => number): MatchState {
  return { board: createBoard(rng), score: 0, lastCascade: 0, lastCleared: 0 };
}
