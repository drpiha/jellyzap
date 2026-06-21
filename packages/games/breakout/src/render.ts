import { PALETTE, drawText, fillRoundRect, paintBackground } from '@jellyzap/game-sdk';
import { HEIGHT, PADDLE_H, WIDTH, type BreakoutState } from './logic';

const ACCENT = '#fb7185';

export interface RenderInfo {
  score: number;
  high: number;
  lives: number;
  status: 'playing' | 'won' | 'lost';
  launched: boolean;
  scoreLabel: string;
  bestLabel: string;
  livesLabel: string;
  wonLabel: string;
  lostLabel: string;
  launchLabel: string;
}

export function draw(
  ctx: CanvasRenderingContext2D,
  state: BreakoutState,
  w: number,
  h: number,
  info: RenderInfo,
): void {
  paintBackground(ctx, w, h);

  // Fit the abstract WIDTH x HEIGHT field into the canvas, centred, reserving a
  // band at the top for the HUD.
  const hud = Math.round(Math.min(w, h) * 0.08);
  const pad = Math.round(Math.min(w, h) * 0.03);
  const availW = w - pad * 2;
  const availH = h - pad * 2 - hud;
  const scale = Math.min(availW / WIDTH, availH / HEIGHT);
  const fieldW = WIDTH * scale;
  const fieldH = HEIGHT * scale;
  const ox = (w - fieldW) / 2;
  const oy = hud + (h - hud - fieldH) / 2;

  const px = (x: number) => ox + x * scale;
  const py = (y: number) => oy + y * scale;
  const ps = (v: number) => v * scale;

  // play-field backdrop
  fillRoundRect(ctx, px(0) - 4, py(0) - 4, fieldW + 8, fieldH + 8, 14, PALETTE.board);

  // bricks
  for (const brick of state.bricks) {
    if (!brick.alive) continue;
    const bx = px(brick.x);
    const by = py(brick.y);
    const bw = ps(brick.w);
    const bh = ps(brick.h);
    const r = Math.min(bw, bh) * 0.28;
    fillRoundRect(ctx, bx, by, bw, bh, r, brick.color);
    // glossy top highlight
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath();
    ctx.roundRect(bx + bw * 0.08, by + bh * 0.12, bw * 0.84, bh * 0.34, r * 0.6);
    ctx.fill();
  }

  // paddle (glossy rounded bar with a bright top sheen)
  const padX = px(state.paddle.x - state.paddle.w / 2);
  const padY = py(120); // PADDLE_Y
  const padW = ps(state.paddle.w);
  const padH = ps(PADDLE_H);
  const padR = padH * 0.5;
  const grad = ctx.createLinearGradient(0, padY, 0, padY + padH);
  grad.addColorStop(0, '#fda4af');
  grad.addColorStop(1, ACCENT);
  fillRoundRect(ctx, padX, padY, padW, padH, padR, '#000');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(padX, padY, padW, padH, padR);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.roundRect(padX + padW * 0.06, padY + padH * 0.18, padW * 0.88, padH * 0.3, padR * 0.6);
  ctx.fill();

  // ball (jelly bead with a shine)
  const ballX = px(state.ball.x);
  const ballY = py(state.ball.y);
  const ballR = Math.max(2, ps(state.ball.r));
  ctx.fillStyle = PALETTE.ink;
  ctx.beginPath();
  ctx.arc(ballX, ballY, ballR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(ballX - ballR * 0.3, ballY - ballR * 0.3, ballR * 0.35, 0, Math.PI * 2);
  ctx.fill();

  // HUD: score (left), lives (centre), best (right)
  const hudY = pad + hud * 0.5;
  const fontSize = Math.round(hud * 0.42);
  drawText(ctx, `${info.scoreLabel}: ${info.score}`, pad, hudY, {
    size: fontSize,
    color: PALETTE.ink,
    baseline: 'middle',
  });
  drawText(ctx, `${info.bestLabel}: ${info.high}`, w - pad, hudY, {
    size: fontSize,
    color: PALETTE.inkDim,
    align: 'right',
    baseline: 'middle',
  });
  drawLives(ctx, info.lives, w / 2, hudY, fontSize, info.livesLabel);

  // prompt to launch the ball
  if (info.status === 'playing' && !info.launched) {
    drawText(ctx, info.launchLabel, w / 2, py(110), {
      size: Math.round(Math.min(w, h) * 0.045),
      color: PALETTE.ink,
      align: 'center',
      baseline: 'middle',
    });
  }

  // win / lose overlay
  if (info.status !== 'playing') {
    ctx.fillStyle = 'rgba(8,4,20,0.66)';
    ctx.fillRect(0, 0, w, h);
    const label = info.status === 'won' ? info.wonLabel : info.lostLabel;
    drawText(ctx, label, w / 2, h / 2 - Math.min(w, h) * 0.04, {
      size: Math.round(Math.min(w, h) * 0.11),
      color: info.status === 'won' ? PALETTE.good : ACCENT,
      align: 'center',
      baseline: 'middle',
    });
    drawText(ctx, `${info.scoreLabel}: ${info.score}`, w / 2, h / 2 + Math.min(w, h) * 0.06, {
      size: Math.round(Math.min(w, h) * 0.05),
      color: PALETTE.ink,
      align: 'center',
      baseline: 'middle',
    });
  }
}

function drawLives(
  ctx: CanvasRenderingContext2D,
  lives: number,
  cx: number,
  cy: number,
  size: number,
  label: string,
): void {
  const r = size * 0.32;
  const gap = r * 2.6;
  const total = lives * gap;
  // centre the row of life beads under the centre point, with a label above
  drawText(ctx, label, cx, cy - size * 0.7, {
    size: Math.round(size * 0.7),
    color: PALETTE.inkDim,
    align: 'center',
    baseline: 'middle',
  });
  const startX = cx - total / 2 + gap / 2;
  for (let i = 0; i < lives; i++) {
    ctx.fillStyle = ACCENT;
    ctx.beginPath();
    ctx.arc(startX + i * gap, cy + size * 0.25, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.arc(startX + i * gap - r * 0.3, cy + size * 0.25 - r * 0.3, r * 0.32, 0, Math.PI * 2);
    ctx.fill();
  }
}
