import type { Direction, Game, GameContext, PointerInfo } from '@jellyzap/game-sdk';
import { shuffle } from '@jellyzap/game-sdk';
import {
  EMPTY,
  SIZE,
  applyGravity,
  applySwap,
  areAdjacent,
  createBoard,
  findMatches,
  hasAnyValidMove,
  idx,
  isValidSwap,
  refill,
  scoreMatches,
  type Board,
  type Cell,
} from './logic';
import { cellAt, render } from './render';
import { registerMatch3Sfx } from './sfx';

/** Seconds the board pauses on each cascade step so the player can read it. */
const STEP_TIME = 0.18;

const DIR_DELTA: Record<Direction, Cell> = {
  up: { r: -1, c: 0 },
  down: { r: 1, c: 0 },
  left: { r: 0, c: -1 },
  right: { r: 0, c: 1 },
};

export default function createMatch3(): Game {
  let ctx!: GameContext;
  let board: Board = [];
  let selected: Cell | null = null;
  // origin of a press＋swipe gesture, kept separate from `selected` so the
  // tap-to-select flow (managed solely by onTap/handleSelect) is not clobbered
  let pressOrigin: Cell | null = null;
  let gameOver = false;

  // cascade resolution is gated by a timer so steps are visible; logic stays pure
  let resolving = false;
  let stepTimer = 0;
  let chain = 0;

  function reshuffleUntilPlayable(): void {
    // try to rearrange the existing gems into a playable, match-free board;
    // fall back to a fresh board if shuffling cannot produce a move.
    for (let attempt = 0; attempt < 40; attempt++) {
      const shuffled = shuffle(ctx.rng, board);
      const candidate = shuffled.slice();
      // clear any incidental matches so play starts clean
      if (findMatches(candidate).length === 0 && hasAnyValidMove(candidate)) {
        board = candidate;
        return;
      }
    }
    board = createBoard(ctx.rng);
  }

  function reset(): void {
    board = createBoard(ctx.rng);
    if (!hasAnyValidMove(board)) reshuffleUntilPlayable();
    selected = null;
    pressOrigin = null;
    gameOver = false;
    resolving = false;
    stepTimer = 0;
    chain = 0;
    ctx.score.reset();
  }

  /** Run one cascade step immediately (clear → gravity → refill). Returns gems cleared. */
  function cascadeStep(): number {
    const matches = findMatches(board);
    if (matches.length === 0) return 0;
    chain++;
    for (const { r, c } of matches) board[idx(r, c)] = EMPTY;
    const gained = scoreMatches(matches, chain);
    ctx.score.add(gained);
    ctx.hooks.onScore?.(ctx.score.score);
    applyGravity(board);
    refill(board, ctx.rng);
    return matches.length;
  }

  /** Begin resolving after a swap: kick off the timed cascade loop. */
  function beginResolve(): void {
    resolving = true;
    chain = 0;
    stepTimer = 0;
  }

  function endGame(): void {
    gameOver = true;
    resolving = false;
    selected = null;
    ctx.audio.play('gameover');
    const isHigh = ctx.score.commitHighScore();
    void ctx.hooks.onGameOver?.(ctx.score.score, isHigh);
  }

  /** Called when resolution settles: check for remaining moves, reshuffle once, else game over. */
  function afterSettle(): void {
    resolving = false;
    if (hasAnyValidMove(board)) return;
    reshuffleUntilPlayable();
    if (!hasAnyValidMove(board)) endGame();
  }

  function trySwap(a: Cell, b: Cell): boolean {
    if (gameOver || resolving) return false;
    if (!areAdjacent(a, b)) return false;
    if (isValidSwap(board, a, b)) {
      applySwap(board, a, b);
      ctx.audio.play('swap');
      beginResolve();
      return true;
    }
    ctx.audio.play('invalid');
    return false;
  }

  function handleSelect(cell: Cell | null): void {
    if (gameOver || resolving || !cell) return;
    if (board[idx(cell.r, cell.c)] === EMPTY) return;
    if (!selected) {
      selected = cell;
      ctx.audio.play('select');
      return;
    }
    if (selected.r === cell.r && selected.c === cell.c) {
      selected = null; // tapping the same gem deselects
      return;
    }
    if (areAdjacent(selected, cell)) {
      trySwap(selected, cell);
      selected = null;
    } else {
      // re-select a far-away gem
      selected = cell;
      ctx.audio.play('select');
    }
  }

  return {
    meta: {
      slug: 'match3',
      defaultControls: 'both',
      orientation: 'any',
      hasLives: false,
      supportsPause: true,
      aspectRatio: 1,
    },
    init(c) {
      ctx = c;
      registerMatch3Sfx(c.audio);
    },
    start() {
      reset();
    },
    update(dt) {
      if (gameOver || !resolving) return;
      stepTimer -= dt;
      if (stepTimer > 0) return;
      const cleared = cascadeStep();
      if (cleared > 0) {
        ctx.audio.play(chain > 1 ? 'cascade' : 'match');
        stepTimer = STEP_TIME;
      } else {
        afterSettle();
      }
    },
    render() {
      render(ctx.ctx, board, ctx.width, ctx.height, {
        score: ctx.score.score,
        high: ctx.score.highScore,
        gameOver,
        selected,
        scoreLabel: ctx.t('game.score'),
        bestLabel: ctx.t('game.best'),
        overLabel: ctx.t('game.gameOver'),
      });
    },
    resize() {
      /* rendering reads ctx.width/height each frame */
    },
    pause() {
      /* host stops calling update while paused */
    },
    resume() {
      /* nothing to restore */
    },
    inputEvents: {
      // tap a gem, then an adjacent gem, to swap (tap-tap)
      onTap(p: PointerInfo) {
        handleSelect(cellAt(ctx.width, ctx.height, p.x, p.y));
      },
      // press＋swipe: the press records the origin, the swipe direction picks the
      // target. Uses pressOrigin (not selected) so it never fights the tap flow.
      onPointerDown(p: PointerInfo) {
        if (gameOver || resolving) {
          pressOrigin = null;
          return;
        }
        const cell = cellAt(ctx.width, ctx.height, p.x, p.y);
        pressOrigin = cell && board[idx(cell.r, cell.c)] !== EMPTY ? cell : null;
      },
      onSwipe(dir: Direction) {
        if (gameOver || resolving || !pressOrigin) return;
        const d = DIR_DELTA[dir];
        const target: Cell = { r: pressOrigin.r + d.r, c: pressOrigin.c + d.c };
        const origin = pressOrigin;
        pressOrigin = null;
        selected = null; // a swipe-swap also clears any pending tap selection
        if (target.r < 0 || target.r >= SIZE || target.c < 0 || target.c >= SIZE) return;
        trySwap(origin, target);
      },
    },
    destroy() {
      /* no external resources */
    },
  };
}
