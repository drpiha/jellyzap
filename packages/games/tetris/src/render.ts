import { PALETTE, drawText, fillRoundRect, paintBackground, strokeRoundRect } from '@jellyzap/game-sdk';
import { SHAPES, cellsOf, ghostPiece, type PieceType, type TetrisState } from './logic';

export interface RenderInfo {
  score: number;
  high: number;
  gameOver: boolean;
  scoreLabel: string;
  bestLabel: string;
  levelLabel: string;
  linesLabel: string;
  nextLabel: string;
  overLabel: string;
}

const ACCENT = '#a855f7';

/** Bright candy colours per tetromino. */
const COLORS: Record<PieceType, string> = {
  I: '#22d3ee',
  O: '#fbbf24',
  T: '#a855f7',
  S: '#34d399',
  Z: '#fb7185',
  J: '#60a5fa',
  L: '#fb923c',
};

export function render(
  ctx: CanvasRenderingContext2D,
  state: TetrisState,
  w: number,
  h: number,
  info: RenderInfo,
): void {
  paintBackground(ctx, w, h);

  const pad = Math.round(Math.min(w, h) * 0.04);
  const hud = Math.round(Math.min(w, h) * 0.08);

  // Reserve a side panel (for the next-piece preview + stats) on the right.
  const panelW = Math.round(Math.min(w * 0.3, Math.min(w, h) * 0.34));
  const availW = w - pad * 2 - panelW - pad;
  const availH = h - pad * 2 - hud;
  const cell = Math.max(
    4,
    Math.floor(Math.min(availW / state.cols, availH / state.rows)),
  );
  const boardW = cell * state.cols;
  const boardH = cell * state.rows;
  const ox = pad;
  const oy = Math.floor(hud + pad + (availH - boardH) / 2);

  // Board backdrop.
  fillRoundRect(ctx, ox - 6, oy - 6, boardW + 12, boardH + 12, 16, PALETTE.board);

  // Faint grid dots.
  ctx.fillStyle = PALETTE.grid;
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      ctx.fillRect(ox + c * cell + cell / 2 - 1, oy + r * cell + cell / 2 - 1, 2, 2);
    }
  }

  // Locked cells.
  for (let y = 0; y < state.rows; y++) {
    for (let x = 0; x < state.cols; x++) {
      const c = state.grid[y][x];
      if (c !== 0) drawCell(ctx, ox + x * cell, oy + y * cell, cell, COLORS[c]);
    }
  }

  // Ghost piece (where the active piece would land).
  const ghost = ghostPiece(state);
  if (ghost && state.active && !state.over) {
    for (const [x, y] of cellsOf(ghost)) {
      if (y < 0) continue;
      const m = Math.max(1, Math.round(cell * 0.08));
      strokeRoundRect(
        ctx,
        ox + x * cell + m,
        oy + y * cell + m,
        cell - m * 2,
        cell - m * 2,
        Math.max(2, cell * 0.28),
        'rgba(255,255,255,0.28)',
        Math.max(1, Math.round(cell * 0.06)),
      );
    }
  }

  // Active piece.
  if (state.active) {
    for (const [x, y] of cellsOf(state.active)) {
      if (y < 0) continue;
      drawCell(ctx, ox + x * cell, oy + y * cell, cell, COLORS[state.active.type]);
    }
  }

  // HUD title row (score on the left, best on the right).
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

  // Side panel.
  const px = ox + boardW + pad + 6;
  const pw = w - px - pad;
  let py = oy;

  // Next-piece preview box.
  const previewLabelSize = Math.round(Math.min(w, h) * 0.035);
  drawText(ctx, info.nextLabel, px, py, {
    size: previewLabelSize,
    color: PALETTE.inkDim,
    baseline: 'top',
  });
  py += previewLabelSize + 8;
  const boxSize = Math.min(pw, Math.round(cell * 4.5));
  fillRoundRect(ctx, px, py, boxSize, boxSize, 12, PALETTE.panel);
  drawPiecePreview(ctx, state.next, px, py, boxSize);
  py += boxSize + Math.round(Math.min(w, h) * 0.04);

  // Stats (level + lines).
  const statSize = Math.round(Math.min(w, h) * 0.038);
  const lineGap = statSize * 1.9;
  drawText(ctx, info.levelLabel, px, py, { size: statSize * 0.8, color: PALETTE.inkDim, baseline: 'top' });
  drawText(ctx, `${state.level}`, px, py + statSize * 0.85, {
    size: statSize,
    color: PALETTE.ink,
    baseline: 'top',
  });
  py += lineGap;
  drawText(ctx, info.linesLabel, px, py, { size: statSize * 0.8, color: PALETTE.inkDim, baseline: 'top' });
  drawText(ctx, `${state.lines}`, px, py + statSize * 0.85, {
    size: statSize,
    color: PALETTE.ink,
    baseline: 'top',
  });

  // Game-over overlay.
  if (info.gameOver) {
    ctx.fillStyle = 'rgba(8,4,20,0.62)';
    ctx.fillRect(0, 0, w, h);
    drawText(ctx, info.overLabel, w / 2, h / 2 - Math.min(w, h) * 0.04, {
      size: Math.round(Math.min(w, h) * 0.1),
      color: PALETTE.ink,
      align: 'center',
      baseline: 'middle',
    });
    drawText(ctx, `${info.scoreLabel}: ${info.score}`, w / 2, h / 2 + Math.min(w, h) * 0.06, {
      size: Math.round(Math.min(w, h) * 0.05),
      color: ACCENT,
      align: 'center',
      baseline: 'middle',
    });
  }
}

/** A single rounded, glossy block. */
function drawCell(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, color: string): void {
  const m = Math.max(1, Math.round(cell * 0.08));
  fillRoundRect(ctx, x + m, y + m, cell - m * 2, cell - m * 2, Math.max(2, cell * 0.28), color);
  // top-left shine
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.beginPath();
  ctx.roundRect(x + m * 1.6, y + m * 1.6, (cell - m * 2) * 0.42, (cell - m * 2) * 0.32, cell * 0.14);
  ctx.fill();
}

/** Draw `type` centered inside a preview box, scaled to fit. */
function drawPiecePreview(
  ctx: CanvasRenderingContext2D,
  type: PieceType,
  bx: number,
  by: number,
  box: number,
): void {
  const shape = SHAPES[type][0];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [dx, dy] of shape) {
    minX = Math.min(minX, dx);
    minY = Math.min(minY, dy);
    maxX = Math.max(maxX, dx);
    maxY = Math.max(maxY, dy);
  }
  const wCells = maxX - minX + 1;
  const hCells = maxY - minY + 1;
  const pcell = Math.floor((box * 0.7) / Math.max(wCells, hCells));
  const gw = pcell * wCells;
  const gh = pcell * hCells;
  const startX = bx + (box - gw) / 2;
  const startY = by + (box - gh) / 2;
  for (const [dx, dy] of shape) {
    drawCell(ctx, startX + (dx - minX) * pcell, startY + (dy - minY) * pcell, pcell, COLORS[type]);
  }
}
