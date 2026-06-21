/** Pure, deterministic Snake logic — no DOM, no Math.random (rng is injected). */

export interface Vec {
  x: number;
  y: number;
}

export type Dir = 'up' | 'down' | 'left' | 'right';

export interface SnakeState {
  cols: number;
  rows: number;
  /** head is index 0 */
  snake: Vec[];
  dir: Dir;
  pendingDir: Dir;
  food: Vec;
  alive: boolean;
  score: number;
  /** remaining segments still to grow */
  grow: number;
}

const DELTA: Record<Dir, Vec> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

export function placeFood(state: SnakeState, rng: () => number): Vec {
  const occupied = new Set(state.snake.map((s) => s.y * state.cols + s.x));
  const free: number[] = [];
  for (let i = 0; i < state.cols * state.rows; i++) if (!occupied.has(i)) free.push(i);
  if (free.length === 0) return state.food;
  const idx = free[Math.floor(rng() * free.length)];
  return { x: idx % state.cols, y: Math.floor(idx / state.cols) };
}

export function createSnakeState(cols: number, rows: number, rng: () => number): SnakeState {
  const cx = Math.floor(cols / 2);
  const cy = Math.floor(rows / 2);
  const snake: Vec[] = [
    { x: cx, y: cy },
    { x: cx - 1, y: cy },
    { x: cx - 2, y: cy },
  ];
  const state: SnakeState = {
    cols,
    rows,
    snake,
    dir: 'right',
    pendingDir: 'right',
    food: { x: 0, y: 0 },
    alive: true,
    score: 0,
    grow: 0,
  };
  state.food = placeFood(state, rng);
  return state;
}

/** Queue a new heading. Returns true only when it is an accepted, new direction. */
export function setDirection(state: SnakeState, dir: Dir): boolean {
  if (dir === OPPOSITE[state.dir]) return false; // cannot reverse onto the neck
  if (dir === state.pendingDir) return false; // no change
  state.pendingDir = dir;
  return true;
}

export type StepResult = 'move' | 'eat' | 'dead';

/** Advance one tick. Mutates `state`. Returns what happened. */
export function step(state: SnakeState, rng: () => number): StepResult {
  if (!state.alive) return 'dead';
  state.dir = state.pendingDir;
  const d = DELTA[state.dir];
  const head = state.snake[0];
  const nx = head.x + d.x;
  const ny = head.y + d.y;

  if (nx < 0 || ny < 0 || nx >= state.cols || ny >= state.rows) {
    state.alive = false;
    return 'dead';
  }

  const ate = nx === state.food.x && ny === state.food.y;
  const willGrow = state.grow > 0 || ate;

  for (let i = 0; i < state.snake.length; i++) {
    // the tail tip vacates this tick unless the snake is growing
    if (i === state.snake.length - 1 && !willGrow) continue;
    const seg = state.snake[i];
    if (seg.x === nx && seg.y === ny) {
      state.alive = false;
      return 'dead';
    }
  }

  state.snake.unshift({ x: nx, y: ny });
  if (ate) {
    state.score += 1;
    state.grow += 2;
    state.food = placeFood(state, rng);
  }
  if (state.grow > 0) state.grow -= 1;
  else state.snake.pop();

  return ate ? 'eat' : 'move';
}
