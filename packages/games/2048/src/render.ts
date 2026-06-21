import { PALETTE, drawText, fillRoundRect, paintBackground } from '@jellyzap/game-sdk';
import { SIZE, type Grid } from './logic';

export interface RenderInfo {
  grid: Grid;
  score: number;
  high: number;
  gameOver: boolean;
  scoreLabel: string;
  bestLabel: string;
  overLabel: string;
  /** language-neutral text shown as a banner when 2048 is first reached */
  winLabel: string;
  /** true while the "you reached 2048" banner should be shown */
  showWinBanner: boolean;
  /** 0..1 progress of a spawn "pop" animation (1 = settled) */
  pop?: number;
  /** [row, col] of the most recently spawned tile, animated by `pop` */
  popCell?: [number, number] | null;
}

/** Background / text color for each tile value. Empty cells use the slot color. */
function tileColors(value: number): { bg: string; fg: string } {
  switch (value) {
    case 2:
      return { bg: '#3a2d63', fg: PALETTE.ink };
    case 4:
      return { bg: '#473474', fg: PALETTE.ink };
    case 8:
      return { bg: '#7c3aed', fg: PALETTE.ink };
    case 16:
      return { bg: '#9333ea', fg: PALETTE.ink };
    case 32:
      return { bg: '#c026d3', fg: PALETTE.ink };
    case 64:
      return { bg: '#e11d75', fg: PALETTE.ink };
    case 128:
      return { bg: '#f59e0b', fg: '#1a1006' };
    case 256:
      return { bg: '#f97316', fg: '#1a1006' };
    case 512:
      return { bg: '#fbbf24', fg: '#1a1006' };
    case 1024:
      return { bg: '#fcd34d', fg: '#1a1006' };
    default:
      // 2048 and beyond — the bright accent jackpot tile
      return { bg: '#fde047', fg: '#1a1006' };
  }
}

function fontSizeFor(value: number, cell: number): number {
  const digits = String(value).length;
  let scale = 0.46;
  if (digits >= 4) scale = 0.3;
  else if (digits === 3) scale = 0.38;
  return Math.round(cell * scale);
}

export function render(
  ctx: CanvasRenderingContext2D,
  info: RenderInfo,
  w: number,
  h: number,
): void {
  paintBackground(ctx, w, h);

  const pad = Math.round(Math.min(w, h) * 0.04);
  const hud = Math.round(Math.min(w, h) * 0.09);
  const availW = w - pad * 2;
  const availH = h - pad * 2 - hud;
  const board = Math.max(40, Math.min(availW, availH));
  const ox = Math.floor((w - board) / 2);
  const oy = Math.floor(hud + (h - hud - board) / 2);

  const gap = Math.max(4, Math.round(board * 0.025));
  const cell = Math.floor((board - gap * (SIZE + 1)) / SIZE);
  const radius = Math.max(4, Math.round(cell * 0.14));

  // board backing
  fillRoundRect(ctx, ox - gap, oy - gap, board + gap, board + gap, radius + 6, PALETTE.board);

  const { grid, pop, popCell } = info;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const x = ox + gap + c * (cell + gap);
      const y = oy + gap + r * (cell + gap);
      const value = grid[r][c];

      // empty slot
      fillRoundRect(ctx, x, y, cell, cell, radius, PALETTE.grid);

      if (value === 0) continue;

      const { bg, fg } = tileColors(value);

      // subtle pop on the freshly spawned tile
      let scale = 1;
      if (pop !== undefined && pop < 1 && popCell && popCell[0] === r && popCell[1] === c) {
        scale = 0.5 + 0.5 * pop;
      }
      const inset = (cell * (1 - scale)) / 2;

      fillRoundRect(ctx, x + inset, y + inset, cell - inset * 2, cell - inset * 2, radius, bg);
      drawText(ctx, String(value), x + cell / 2, y + cell / 2, {
        size: fontSizeFor(value, cell) * scale,
        color: fg,
        align: 'center',
        baseline: 'middle',
        weight: 800,
      });
    }
  }

  // HUD
  drawText(ctx, `${info.scoreLabel}: ${info.score}`, pad, pad + hud * 0.5, {
    size: Math.round(hud * 0.42),
    color: PALETTE.ink,
    baseline: 'middle',
  });
  drawText(ctx, `${info.bestLabel}: ${info.high}`, w - pad, pad + hud * 0.5, {
    size: Math.round(hud * 0.42),
    color: PALETTE.inkDim,
    align: 'right',
    baseline: 'middle',
  });

  // A subtle, non-blocking "2048!" banner the first time the win value appears.
  if (info.showWinBanner && !info.gameOver) {
    drawText(ctx, info.winLabel, w / 2, oy - gap - hud * 0.05, {
      size: Math.round(hud * 0.5),
      color: PALETTE.warn,
      align: 'center',
      baseline: 'bottom',
      weight: 800,
    });
  }

  if (info.gameOver) {
    ctx.fillStyle = 'rgba(8,4,20,0.62)';
    ctx.fillRect(0, 0, w, h);
    drawText(ctx, info.overLabel, w / 2, h / 2, {
      size: Math.round(Math.min(w, h) * 0.11),
      color: PALETTE.ink,
      align: 'center',
      baseline: 'middle',
    });
  }
}
