import { PALETTE, drawText, fillRoundRect, paintBackground } from '@jellyzap/game-sdk';
import type { MemoryState } from './logic';

const ACCENT = '#38bdf8';

export interface RenderInfo {
  moves: number;
  pairs: number;
  found: number;
  won: boolean;
  score: number;
  movesLabel: string;
  pairsLabel: string;
  scoreLabel: string;
  winLabel: string;
}

export interface GridLayout {
  cols: number;
  rows: number;
  /** card box size (square) */
  size: number;
  /** gap between cards */
  gap: number;
  /** top-left origin of the grid */
  ox: number;
  oy: number;
}

/** Pick a near-square column/row split for `count` cards. */
export function gridDimensions(count: number): { cols: number; rows: number } {
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  return { cols, rows };
}

/**
 * Compute the shared grid geometry. render() and pointer hit-testing both call
 * this so a tap always maps to the card drawn under it.
 */
export function computeLayout(count: number, w: number, h: number): GridLayout {
  const { cols, rows } = gridDimensions(count);
  const hud = Math.round(Math.min(w, h) * 0.1);
  const pad = Math.round(Math.min(w, h) * 0.04);
  const gap = Math.max(4, Math.round(Math.min(w, h) * 0.018));
  const availW = w - pad * 2;
  const availH = h - pad * 2 - hud;
  const size = Math.max(
    8,
    Math.floor(Math.min((availW - gap * (cols - 1)) / cols, (availH - gap * (rows - 1)) / rows)),
  );
  const boardW = size * cols + gap * (cols - 1);
  const boardH = size * rows + gap * (rows - 1);
  const ox = Math.floor((w - boardW) / 2);
  const oy = Math.floor(hud + pad + (availH - boardH) / 2);
  return { cols, rows, size, gap, ox, oy };
}

/** Top-left pixel of a card given its deck index. */
export function cardRect(
  layout: GridLayout,
  index: number,
): { x: number; y: number; size: number } {
  const c = index % layout.cols;
  const r = Math.floor(index / layout.cols);
  return {
    x: layout.ox + c * (layout.size + layout.gap),
    y: layout.oy + r * (layout.size + layout.gap),
    size: layout.size,
  };
}

/** Hit-test a pointer (logical px) → deck index, or -1 if outside any card. */
export function hitTest(layout: GridLayout, count: number, px: number, py: number): number {
  for (let i = 0; i < count; i++) {
    const { x, y, size } = cardRect(layout, i);
    if (px >= x && px <= x + size && py >= y && py <= y + size) return i;
  }
  return -1;
}

export function draw(
  ctx: CanvasRenderingContext2D,
  state: MemoryState,
  w: number,
  h: number,
  info: RenderInfo,
): void {
  paintBackground(ctx, w, h);

  const count = state.cards.length;
  const layout = computeLayout(count, w, h);
  const { size } = layout;
  const radius = Math.max(6, size * 0.18);

  for (let i = 0; i < count; i++) {
    const card = state.cards[i];
    const { x, y } = cardRect(layout, i);
    const showFace = card.faceUp || card.matched;

    if (card.matched) {
      ctx.globalAlpha = 0.45;
    }

    if (showFace) {
      drawFace(ctx, x, y, size, radius, card.symbol);
    } else {
      drawBack(ctx, x, y, size, radius);
    }

    ctx.globalAlpha = 1;
  }

  // HUD
  const hud = Math.round(Math.min(w, h) * 0.1);
  const pad = Math.round(Math.min(w, h) * 0.04);
  drawText(ctx, `${info.movesLabel}: ${info.moves}`, pad, pad + hud * 0.5, {
    size: Math.round(hud * 0.42),
    color: PALETTE.ink,
    baseline: 'middle',
  });
  drawText(ctx, `${info.pairsLabel}: ${info.found}/${info.pairs}`, w - pad, pad + hud * 0.5, {
    size: Math.round(hud * 0.42),
    color: PALETTE.inkDim,
    align: 'right',
    baseline: 'middle',
  });

  if (info.won) {
    ctx.fillStyle = 'rgba(8,4,20,0.66)';
    ctx.fillRect(0, 0, w, h);
    drawText(ctx, info.winLabel, w / 2, h / 2 - Math.min(w, h) * 0.05, {
      size: Math.round(Math.min(w, h) * 0.11),
      color: ACCENT,
      align: 'center',
      baseline: 'middle',
    });
    drawText(ctx, `${info.scoreLabel}: ${info.score}`, w / 2, h / 2 + Math.min(w, h) * 0.06, {
      size: Math.round(Math.min(w, h) * 0.06),
      color: PALETTE.ink,
      align: 'center',
      baseline: 'middle',
    });
    drawText(ctx, `${info.movesLabel}: ${info.moves}`, w / 2, h / 2 + Math.min(w, h) * 0.13, {
      size: Math.round(Math.min(w, h) * 0.045),
      color: PALETTE.inkDim,
      align: 'center',
      baseline: 'middle',
    });
  }
}

/** Face-down card: a jelly-themed back with a soft pattern and accent border. */
function drawBack(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  radius: number,
): void {
  fillRoundRect(ctx, x, y, size, size, radius, PALETTE.primaryDark);

  // inner jelly panel
  const inset = Math.max(2, size * 0.1);
  fillRoundRect(
    ctx,
    x + inset,
    y + inset,
    size - inset * 2,
    size - inset * 2,
    Math.max(3, radius * 0.7),
    PALETTE.primary,
  );

  // jelly bead pattern (clipped to the inner panel)
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(
    x + inset,
    y + inset,
    size - inset * 2,
    size - inset * 2,
    Math.max(3, radius * 0.7),
  );
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  const step = size * 0.32;
  const r = size * 0.07;
  for (let gy = y + inset + step * 0.25; gy < y + size; gy += step) {
    for (let gx = x + inset + step * 0.25; gx < x + size; gx += step) {
      ctx.beginPath();
      ctx.arc(gx, gy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // diagonal sheen
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.moveTo(x, y + size * 0.2);
  ctx.lineTo(x + size * 0.5, y);
  ctx.lineTo(x + size, y + size * 0.3);
  ctx.lineTo(x, y + size * 0.9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Face-up card: a light panel with the big symbol centered. */
function drawFace(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  radius: number,
  symbol: string,
): void {
  fillRoundRect(ctx, x, y, size, size, radius, PALETTE.panel);
  const inset = Math.max(2, size * 0.08);
  fillRoundRect(
    ctx,
    x + inset,
    y + inset,
    size - inset * 2,
    size - inset * 2,
    Math.max(3, radius * 0.7),
    '#1b1033',
  );
  drawText(ctx, symbol, x + size / 2, y + size / 2, {
    size: Math.round(size * 0.5),
    align: 'center',
    baseline: 'middle',
    color: PALETTE.ink,
  });
}
