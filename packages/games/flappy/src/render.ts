import { drawText, fillRoundRect } from '@jellyzap/game-sdk';
import {
  BIRD_RADIUS,
  BIRD_X,
  GROUND_HEIGHT,
  PIPE_HALF_WIDTH,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type FlappyState,
} from './logic';

export interface RenderInfo {
  score: number;
  high: number;
  gameOver: boolean;
  started: boolean;
  scoreLabel: string;
  bestLabel: string;
  overLabel: string;
  startLabel: string;
  againLabel: string;
}

const ACCENT = '#2dd4bf';
const ACCENT_DARK = '#0f766e';
const SKY_TOP = '#7dd3fc';
const SKY_BOTTOM = '#e0f2fe';
const BIRD_BODY = '#fbbf24';
const BIRD_BODY_DARK = '#f59e0b';
const GROUND_TOP = '#fde68a';
const GROUND_BODY = '#f59e0b';

/**
 * Draw the game. The logic lives in a normalized world (WORLD_WIDTH x
 * WORLD_HEIGHT); we letterbox that world into the canvas, preserving aspect, and
 * scale every world coordinate to pixels via {@link mapX}/{@link mapY}.
 */
export function draw(
  ctx: CanvasRenderingContext2D,
  state: FlappyState,
  w: number,
  h: number,
  info: RenderInfo,
): void {
  // Bright sky gradient (full canvas).
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, SKY_TOP);
  sky.addColorStop(1, SKY_BOTTOM);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Fit the world into the canvas (contain), centred.
  const scale = Math.min(w / WORLD_WIDTH, h / WORLD_HEIGHT);
  const viewW = WORLD_WIDTH * scale;
  const viewH = WORLD_HEIGHT * scale;
  const ox = (w - viewW) / 2;
  const oy = (h - viewH) / 2;

  const mapX = (x: number): number => ox + x * scale;
  const mapY = (y: number): number => oy + y * scale;
  const s = (v: number): number => v * scale;

  // Soft drifting clouds (purely decorative, derived from pipe scroll).
  drawClouds(ctx, state, mapX, mapY, s);

  const floorY = mapY(WORLD_HEIGHT - GROUND_HEIGHT);

  // Pipes (rounded "jelly" columns with a chunky lip at the gap).
  for (const p of state.pipes) {
    const cx = mapX(p.x);
    const pw = s(PIPE_HALF_WIDTH * 2);
    const left = cx - pw / 2;
    const gapTop = mapY(p.gapY - p.gapHalf);
    const gapBottom = mapY(p.gapY + p.gapHalf);
    const radius = Math.min(pw * 0.45, s(0.03));
    const lipH = Math.min(s(0.035), pw * 0.5);

    // Top pipe: from the top of the view down to the gap.
    drawPipe(ctx, left, oy, pw, gapTop - oy, radius, lipH, false);
    // Bottom pipe: from the gap down to the ground.
    drawPipe(ctx, left, gapBottom, pw, floorY - gapBottom, radius, lipH, true);
  }

  // Ground strip.
  const groundGrad = ctx.createLinearGradient(0, floorY, 0, h);
  groundGrad.addColorStop(0, GROUND_TOP);
  groundGrad.addColorStop(1, GROUND_BODY);
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, floorY, w, h - floorY);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(0, floorY, w, Math.max(2, s(0.006)));

  // Bird.
  drawBird(ctx, mapX(BIRD_X), mapY(state.y), s(BIRD_RADIUS), state);

  // Score (big, centred near the top).
  if (!info.gameOver) {
    drawText(ctx, String(info.score), w / 2, h * 0.14, {
      size: Math.round(Math.min(w, h) * 0.13),
      color: '#ffffff',
      align: 'center',
      baseline: 'middle',
      weight: 800,
    });
    // subtle outline via a second draw underneath
  }

  // "Tap to start" hint before the first flap.
  if (!info.started && !info.gameOver) {
    drawText(ctx, info.startLabel, w / 2, h * 0.62, {
      size: Math.round(Math.min(w, h) * 0.05),
      color: ACCENT_DARK,
      align: 'center',
      baseline: 'middle',
      weight: 700,
    });
  }

  if (info.gameOver) {
    ctx.fillStyle = 'rgba(8, 20, 30, 0.55)';
    ctx.fillRect(0, 0, w, h);

    drawText(ctx, info.overLabel, w / 2, h * 0.38, {
      size: Math.round(Math.min(w, h) * 0.1),
      color: '#ffffff',
      align: 'center',
      baseline: 'middle',
      weight: 800,
    });
    drawText(ctx, `${info.scoreLabel}: ${info.score}`, w / 2, h * 0.5, {
      size: Math.round(Math.min(w, h) * 0.055),
      color: ACCENT,
      align: 'center',
      baseline: 'middle',
      weight: 700,
    });
    drawText(ctx, `${info.bestLabel}: ${info.high}`, w / 2, h * 0.57, {
      size: Math.round(Math.min(w, h) * 0.045),
      color: '#e0f2fe',
      align: 'center',
      baseline: 'middle',
    });
    drawText(ctx, info.againLabel, w / 2, h * 0.68, {
      size: Math.round(Math.min(w, h) * 0.045),
      color: '#ffffff',
      align: 'center',
      baseline: 'middle',
      weight: 700,
    });
  }
}

function drawPipe(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  lipH: number,
  lipOnTop: boolean,
): void {
  if (h <= 0) return;
  // Body with a vertical sheen.
  const grad = ctx.createLinearGradient(x, 0, x + w, 0);
  grad.addColorStop(0, ACCENT_DARK);
  grad.addColorStop(0.4, ACCENT);
  grad.addColorStop(1, ACCENT_DARK);
  fillRoundRect(ctx, x, y, w, h, radius, ACCENT);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();

  // Chunky lip at the gap end.
  const lipPad = Math.max(1, w * 0.12);
  const lipW = w + lipPad * 2;
  const lipX = x - lipPad;
  const lipY = lipOnTop ? y : y + h - lipH;
  fillRoundRect(ctx, lipX, lipY, lipW, lipH, Math.min(radius, lipH / 2), ACCENT);
  // glossy highlight on the lip
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  fillRoundRect(
    ctx,
    lipX + lipPad * 0.4,
    lipY + lipH * 0.18,
    lipW * 0.3,
    Math.max(1, lipH * 0.3),
    lipH * 0.2,
    'rgba(255,255,255,0.35)',
  );
}

function drawBird(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  state: FlappyState,
): void {
  // Tilt the bird based on vertical velocity (clamped), nose down when falling.
  const tilt = Math.max(-0.5, Math.min(0.9, state.vy * 0.6));
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(tilt);

  // Body (rounded blob).
  const body = ctx.createLinearGradient(0, -r, 0, r);
  body.addColorStop(0, BIRD_BODY);
  body.addColorStop(1, BIRD_BODY_DARK);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.15, r, 0, 0, Math.PI * 2);
  ctx.fill();

  // Wing (animated flap based on velocity).
  const wingUp = state.vy < 0;
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.ellipse(-r * 0.15, wingUp ? -r * 0.25 : r * 0.2, r * 0.55, r * 0.32, wingUp ? -0.5 : 0.4, 0, Math.PI * 2);
  ctx.fill();

  // Beak.
  ctx.fillStyle = '#fb7185';
  ctx.beginPath();
  ctx.moveTo(r * 0.95, -r * 0.1);
  ctx.lineTo(r * 1.55, 0);
  ctx.lineTo(r * 0.95, r * 0.2);
  ctx.closePath();
  ctx.fill();

  // Eye (white + pupil).
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(r * 0.45, -r * 0.35, r * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0b1620';
  ctx.beginPath();
  ctx.arc(r * 0.55, -r * 0.35, r * 0.14, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawClouds(
  ctx: CanvasRenderingContext2D,
  state: FlappyState,
  mapX: (x: number) => number,
  mapY: (y: number) => number,
  s: (v: number) => number,
): void {
  // Parallax-ish clouds tied to total scroll so they drift deterministically.
  const drift = -state.nextPipeX * 0.25;
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  const spots: Array<[number, number, number]> = [
    [0.1, 0.18, 0.05],
    [0.42, 0.1, 0.06],
    [0.3, 0.3, 0.045],
    [0.55, 0.24, 0.05],
  ];
  for (const [bx, by, br] of spots) {
    let x = ((bx + drift) % (WORLD_WIDTH + 0.2));
    if (x < -0.1) x += WORLD_WIDTH + 0.2;
    const px = mapX(x);
    const py = mapY(by);
    const pr = s(br);
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.arc(px + pr * 0.9, py + pr * 0.1, pr * 0.8, 0, Math.PI * 2);
    ctx.arc(px - pr * 0.9, py + pr * 0.1, pr * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
}
