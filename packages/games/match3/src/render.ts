import { PALETTE, drawText, fillRoundRect, paintBackground, strokeRoundRect } from '@jellyzap/game-sdk';
import { EMPTY, SIZE, get, type Board, type Cell } from './logic';

const ACCENT = '#f472b6';

/** Six distinct, candy-bright gem colors keyed by type id (0..5). */
const GEM_COLORS = [
  '#ff5d73', // 0 ruby red
  '#ffb13b', // 1 amber orange
  '#ffe94d', // 2 lemon yellow
  '#4ade80', // 3 lime green
  '#38bdf8', // 4 sky blue
  '#c084fc', // 5 grape purple
] as const;

export type GemShape = 'circle' | 'square' | 'diamond' | 'triangle' | 'hexagon' | 'heart';

/** A distinct shape per gem id so the board reads even without color. */
const GEM_SHAPES: GemShape[] = ['circle', 'square', 'diamond', 'triangle', 'hexagon', 'heart'];

export interface BoardLayout {
  ox: number;
  oy: number;
  cell: number;
}

/** Compute the board origin + cell size for a given canvas. Shared with input hit-testing. */
export function computeLayout(w: number, h: number): BoardLayout {
  const pad = Math.round(Math.min(w, h) * 0.04);
  const hud = Math.round(Math.min(w, h) * 0.1);
  const availW = w - pad * 2;
  const availH = h - pad * 2 - hud;
  const cell = Math.max(4, Math.floor(Math.min(availW / SIZE, availH / SIZE)));
  const boardW = cell * SIZE;
  const boardH = cell * SIZE;
  const ox = Math.floor((w - boardW) / 2);
  const oy = Math.floor(hud + (h - hud - boardH) / 2);
  return { ox, oy, cell };
}

/** Map canvas-logical coordinates to a grid cell, or null if outside the board. */
export function cellAt(w: number, h: number, x: number, y: number): Cell | null {
  const { ox, oy, cell } = computeLayout(w, h);
  const c = Math.floor((x - ox) / cell);
  const r = Math.floor((y - oy) / cell);
  if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return null;
  return { r, c };
}

export interface RenderInfo {
  score: number;
  high: number;
  gameOver: boolean;
  selected: Cell | null;
  scoreLabel: string;
  bestLabel: string;
  overLabel: string;
}

export function render(
  ctx: CanvasRenderingContext2D,
  board: Board,
  w: number,
  h: number,
  info: RenderInfo,
): void {
  paintBackground(ctx, w, h);

  const { ox, oy, cell } = computeLayout(w, h);
  const boardW = cell * SIZE;
  const boardH = cell * SIZE;

  // board backing
  fillRoundRect(ctx, ox - 6, oy - 6, boardW + 12, boardH + 12, 16, PALETTE.board);

  // checkerboard cell tints for readability
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if ((r + c) % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.fillRect(ox + c * cell, oy + r * cell, cell, cell);
      }
    }
  }

  // gems
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = get(board, r, c);
      if (v === EMPTY) continue;
      drawGem(ctx, ox + c * cell, oy + r * cell, cell, v);
    }
  }

  // selection highlight
  if (info.selected) {
    const { r, c } = info.selected;
    const m = Math.max(1, Math.round(cell * 0.06));
    strokeRoundRect(
      ctx,
      ox + c * cell + m,
      oy + r * cell + m,
      cell - m * 2,
      cell - m * 2,
      Math.max(3, cell * 0.22),
      ACCENT,
      Math.max(2, Math.round(cell * 0.08)),
    );
  }

  // HUD
  const pad = Math.round(Math.min(w, h) * 0.04);
  const hud = Math.round(Math.min(w, h) * 0.1);
  drawText(ctx, `${info.scoreLabel}: ${info.score}`, pad, pad + hud * 0.5, {
    size: Math.round(hud * 0.4),
    color: PALETTE.ink,
    baseline: 'middle',
  });
  drawText(ctx, `${info.bestLabel}: ${info.high}`, w - pad, pad + hud * 0.5, {
    size: Math.round(hud * 0.4),
    color: PALETTE.inkDim,
    align: 'right',
    baseline: 'middle',
  });

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

function drawGem(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  cell: number,
  type: number,
): void {
  const color = GEM_COLORS[type % GEM_COLORS.length];
  const shape = GEM_SHAPES[type % GEM_SHAPES.length];
  const m = Math.max(1, Math.round(cell * 0.12));
  const x = cx + m;
  const y = cy + m;
  const s = cell - m * 2;
  const midX = x + s / 2;
  const midY = y + s / 2;
  const rad = s / 2;

  ctx.fillStyle = color;
  ctx.beginPath();
  switch (shape) {
    case 'circle':
      ctx.arc(midX, midY, rad, 0, Math.PI * 2);
      break;
    case 'square':
      ctx.roundRect(x, y, s, s, Math.max(2, s * 0.22));
      break;
    case 'diamond':
      ctx.moveTo(midX, y);
      ctx.lineTo(x + s, midY);
      ctx.lineTo(midX, y + s);
      ctx.lineTo(x, midY);
      ctx.closePath();
      break;
    case 'triangle':
      ctx.moveTo(midX, y);
      ctx.lineTo(x + s, y + s);
      ctx.lineTo(x, y + s);
      ctx.closePath();
      break;
    case 'hexagon':
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 2;
        const px = midX + rad * Math.cos(a);
        const py = midY + rad * Math.sin(a);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    case 'heart': {
      const t = rad;
      ctx.moveTo(midX, midY + t * 0.7);
      ctx.bezierCurveTo(midX + t, midY, midX + t * 0.5, midY - t, midX, midY - t * 0.25);
      ctx.bezierCurveTo(midX - t * 0.5, midY - t, midX - t, midY, midX, midY + t * 0.7);
      ctx.closePath();
      break;
    }
  }
  ctx.fill();

  // glossy highlight
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.arc(midX - s * 0.18, midY - s * 0.18, Math.max(1, s * 0.12), 0, Math.PI * 2);
  ctx.fill();
}
