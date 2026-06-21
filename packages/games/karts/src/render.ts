import { PALETTE, drawText, fillRoundRect, paintBackground, dimOverlay } from '@jellyzap/game-sdk';
import {
  KART_RADIUS,
  MAX_HEALTH,
  PROJECTILE_RADIUS,
  type Kart,
  type KartsState,
} from './logic';

export interface RenderInfo {
  score: number;
  high: number;
  lives: number;
  gameOver: boolean;
  scoreLabel: string;
  bestLabel: string;
  livesLabel: string;
  overLabel: string;
}

const ACCENT = '#ff4d8d';

/** Distinct body colors per kart: index 0 is the player (accent), bots follow. */
const KART_COLORS = [ACCENT, '#22d3ee', '#fbbf24', '#34d399'];

interface View {
  ox: number;
  oy: number;
  size: number; // pixel size of the (square) arena
  scale: number; // pixels per arena unit
  hud: number;
}

function computeView(state: KartsState, w: number, h: number): View {
  const hud = Math.round(Math.min(w, h) * 0.09);
  const pad = Math.round(Math.min(w, h) * 0.04);
  const availW = w - pad * 2;
  const availH = h - pad * 2 - hud;
  const size = Math.max(40, Math.min(availW, availH));
  const ox = Math.floor((w - size) / 2);
  const oy = Math.floor(hud + (h - hud - size) / 2);
  return { ox, oy, size, scale: size / state.arena, hud };
}

function px(view: View, x: number): number {
  return view.ox + x * view.scale;
}
function py(view: View, y: number): number {
  return view.oy + y * view.scale;
}

export function draw(
  ctx: CanvasRenderingContext2D,
  state: KartsState,
  w: number,
  h: number,
  info: RenderInfo,
): void {
  paintBackground(ctx, w, h);
  const view = computeView(state, w, h);

  // arena floor
  fillRoundRect(ctx, view.ox - 6, view.oy - 6, view.size + 12, view.size + 12, 16, PALETTE.board);

  // grid lines
  ctx.save();
  ctx.beginPath();
  ctx.rect(view.ox, view.oy, view.size, view.size);
  ctx.clip();
  ctx.strokeStyle = PALETTE.grid;
  ctx.lineWidth = 1;
  const step = state.arena / 10;
  for (let i = 0; i <= 10; i++) {
    const gx = px(view, i * step);
    const gy = py(view, i * step);
    ctx.beginPath();
    ctx.moveTo(gx, view.oy);
    ctx.lineTo(gx, view.oy + view.size);
    ctx.moveTo(view.ox, gy);
    ctx.lineTo(view.ox + view.size, gy);
    ctx.stroke();
  }
  ctx.restore();

  // projectiles (bright dots)
  const pr = Math.max(2, PROJECTILE_RADIUS * view.scale);
  for (const p of state.projectiles) {
    if (!p.alive) continue;
    const cx = px(view, p.x);
    const cy = py(view, p.y);
    ctx.fillStyle = PALETTE.warn;
    ctx.beginPath();
    ctx.arc(cx, cy, pr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(cx, cy, pr * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  // karts
  for (const k of state.karts) {
    drawKart(ctx, view, k);
  }

  // HUD: score (left), lives (center), best (right)
  drawText(ctx, `${info.scoreLabel}: ${info.score}`, view.ox, view.oy - view.hud * 0.35, {
    size: Math.round(view.hud * 0.42),
    color: PALETTE.ink,
    baseline: 'middle',
  });
  drawText(ctx, `${info.livesLabel}: ${info.lives}`, w / 2, view.oy - view.hud * 0.35, {
    size: Math.round(view.hud * 0.42),
    color: ACCENT,
    align: 'center',
    baseline: 'middle',
  });
  drawText(
    ctx,
    `${info.bestLabel}: ${info.high}`,
    view.ox + view.size,
    view.oy - view.hud * 0.35,
    {
      size: Math.round(view.hud * 0.42),
      color: PALETTE.inkDim,
      align: 'right',
      baseline: 'middle',
    },
  );

  if (info.gameOver) {
    dimOverlay(ctx, w, h, 0.62);
    drawText(ctx, info.overLabel, w / 2, h / 2, {
      size: Math.round(Math.min(w, h) * 0.11),
      color: PALETTE.ink,
      align: 'center',
      baseline: 'middle',
    });
  }
}

function drawKart(ctx: CanvasRenderingContext2D, view: View, k: Kart): void {
  if (!k.alive) return;
  const cx = px(view, k.x);
  const cy = py(view, k.y);
  const r = KART_RADIUS * view.scale;
  const color = KART_COLORS[k.team % KART_COLORS.length];

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(k.angle);

  // direction nose (triangle pointing along +x = facing)
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(r * 1.5, 0);
  ctx.lineTo(r * 0.4, -r * 0.7);
  ctx.lineTo(r * 0.4, r * 0.7);
  ctx.closePath();
  ctx.fill();

  // rounded body
  const bw = r * 2;
  const bh = r * 1.7;
  fillRoundRect(ctx, -bw / 2, -bh / 2, bw, bh, Math.max(2, r * 0.45), color);

  // darker cockpit accent so the player (and facing) reads clearly
  ctx.fillStyle = 'rgba(8,4,20,0.45)';
  fillRoundRect(ctx, -r * 0.1, -bh * 0.28, r * 0.8, bh * 0.56, Math.max(1, r * 0.25), 'rgba(8,4,20,0.45)');

  ctx.restore();

  // health bar above the kart (screen-aligned)
  const frac = Math.max(0, Math.min(1, k.health / MAX_HEALTH));
  const barW = r * 2.2;
  const barH = Math.max(2, r * 0.28);
  const barX = cx - barW / 2;
  const barY = cy - r * 1.9 - barH;
  fillRoundRect(ctx, barX, barY, barW, barH, barH / 2, 'rgba(8,4,20,0.6)');
  const hue = frac > 0.5 ? PALETTE.good : frac > 0.25 ? PALETTE.warn : PALETTE.bad;
  if (frac > 0) {
    fillRoundRect(ctx, barX, barY, barW * frac, barH, barH / 2, hue);
  }
}
