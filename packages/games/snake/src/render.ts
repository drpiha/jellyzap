import { PALETTE, drawText, fillRoundRect, paintBackground } from '@jellyzap/game-sdk';
import type { SnakeState } from './logic';

export interface RenderInfo {
  score: number;
  high: number;
  gameOver: boolean;
  scoreLabel: string;
  bestLabel: string;
  overLabel: string;
}

export function render(
  ctx: CanvasRenderingContext2D,
  state: SnakeState,
  w: number,
  h: number,
  info: RenderInfo,
): void {
  paintBackground(ctx, w, h);

  const pad = Math.round(Math.min(w, h) * 0.04);
  const hud = Math.round(Math.min(w, h) * 0.09);
  const availW = w - pad * 2;
  const availH = h - pad * 2 - hud;
  const cell = Math.max(4, Math.floor(Math.min(availW / state.cols, availH / state.rows)));
  const boardW = cell * state.cols;
  const boardH = cell * state.rows;
  const ox = Math.floor((w - boardW) / 2);
  const oy = Math.floor(hud + (h - hud - boardH) / 2);

  // board
  fillRoundRect(ctx, ox - 6, oy - 6, boardW + 12, boardH + 12, 16, PALETTE.board);

  // grid dots
  ctx.fillStyle = PALETTE.grid;
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      ctx.fillRect(ox + c * cell + cell / 2 - 1, oy + r * cell + cell / 2 - 1, 2, 2);
    }
  }

  // food (jelly bead with shine)
  const fx = ox + state.food.x * cell + cell / 2;
  const fy = oy + state.food.y * cell + cell / 2;
  ctx.fillStyle = PALETTE.accent;
  ctx.beginPath();
  ctx.arc(fx, fy, cell * 0.36, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.arc(fx - cell * 0.12, fy - cell * 0.12, cell * 0.1, 0, Math.PI * 2);
  ctx.fill();

  // snake (rounded segments, head brighter)
  const n = state.snake.length;
  for (let i = n - 1; i >= 0; i--) {
    const s = state.snake[i];
    const t = n <= 1 ? 0 : i / (n - 1);
    const col = i === 0 ? PALETTE.accent2 : lerpColor(PALETTE.primary, PALETTE.primaryDark, t);
    const m = Math.max(1, Math.round(cell * 0.08));
    fillRoundRect(
      ctx,
      ox + s.x * cell + m,
      oy + s.y * cell + m,
      cell - m * 2,
      cell - m * 2,
      Math.max(2, cell * 0.3),
      col,
    );
  }
  // eyes on the head
  const head = state.snake[0];
  if (head) {
    ctx.fillStyle = '#0b0617';
    const ex = ox + head.x * cell + cell / 2;
    const ey = oy + head.y * cell + cell / 2;
    const r = Math.max(1, cell * 0.07);
    ctx.beginPath();
    ctx.arc(ex - cell * 0.16, ey - cell * 0.12, r, 0, Math.PI * 2);
    ctx.arc(ex + cell * 0.16, ey - cell * 0.12, r, 0, Math.PI * 2);
    ctx.fill();
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

function lerpColor(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const r = Math.round(ca[0] + (cb[0] - ca[0]) * t);
  const g = Math.round(ca[1] + (cb[1] - ca[1]) * t);
  const bl = Math.round(ca[2] + (cb[2] - ca[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

function hexToRgb(hex: string): [number, number, number] {
  const v = hex.replace('#', '');
  return [
    parseInt(v.substring(0, 2), 16),
    parseInt(v.substring(2, 4), 16),
    parseInt(v.substring(4, 6), 16),
  ];
}
