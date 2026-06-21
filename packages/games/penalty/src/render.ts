import type { PenaltyState } from './logic';

export interface PenaltyLayout {
  goalX: number;
  goalY: number;
  goalW: number;
  goalH: number;
  zoneW: number;
  zoneH: number;
  spotX: number;
  spotY: number;
  ballR: number;
  lineY: number;
}

export interface DrawInfo {
  scoreLabel: string;
  livesLabel: string;
  goalText: string;
  saveText: string;
  aimHint: string;
  /** 0..1 progress of the ball travelling on a shot (result phase) */
  ballProgress: number;
  /** 0..1 pulsing value for the aim reticle */
  pulse: number;
}

export function computeLayout(width: number, height: number, state: PenaltyState): PenaltyLayout {
  const goalW = width * 0.84;
  const goalH = height * 0.34;
  const goalX = (width - goalW) / 2;
  const goalY = height * 0.12;
  return {
    goalX,
    goalY,
    goalW,
    goalH,
    zoneW: goalW / state.cols,
    zoneH: goalH / state.rows,
    spotX: width / 2,
    spotY: height * 0.82,
    ballR: Math.max(8, width * 0.035),
    lineY: goalY + goalH,
  };
}

function zoneCenter(L: PenaltyLayout, state: PenaltyState, zone: number): { x: number; y: number } {
  const col = zone % state.cols;
  const row = Math.floor(zone / state.cols);
  return {
    x: L.goalX + (col + 0.5) * L.zoneW,
    y: L.goalY + (row + 0.5) * L.zoneH,
  };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1c2540';
  const p = r * 0.42;
  ctx.beginPath();
  ctx.arc(x, y, p, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, p * 0.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawKeeper(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  // gloves block
  ctx.fillStyle = 'rgba(255, 204, 0, 0.92)';
  roundRect(ctx, x + w * 0.12, y + h * 0.12, w * 0.76, h * 0.76, Math.min(w, h) * 0.18);
  ctx.fill();
  // body
  ctx.fillStyle = '#2b6cff';
  const bw = w * 0.32;
  roundRect(ctx, x + (w - bw) / 2, y + h * 0.28, bw, h * 0.6, bw * 0.4);
  ctx.fill();
}

export function draw(
  ctx: CanvasRenderingContext2D,
  state: PenaltyState,
  width: number,
  height: number,
  info: DrawInfo,
): void {
  const L = computeLayout(width, height, state);

  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, L.lineY + height * 0.12);
  sky.addColorStop(0, '#8fd3ff');
  sky.addColorStop(1, '#cdeeff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
  // grass
  ctx.fillStyle = '#37b24d';
  ctx.fillRect(0, L.lineY, width, height - L.lineY);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let i = 0; i < 6; i++) {
    if (i % 2 === 0) ctx.fillRect(0, L.lineY + ((height - L.lineY) / 6) * i, width, (height - L.lineY) / 6);
  }

  // goal net background
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(L.goalX, L.goalY, L.goalW, L.goalH);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  const mesh = Math.max(10, L.goalW / 18);
  for (let gx = L.goalX; gx <= L.goalX + L.goalW + 0.5; gx += mesh) {
    ctx.beginPath();
    ctx.moveTo(gx, L.goalY);
    ctx.lineTo(gx, L.goalY + L.goalH);
    ctx.stroke();
  }
  for (let gy = L.goalY; gy <= L.goalY + L.goalH + 0.5; gy += mesh) {
    ctx.beginPath();
    ctx.moveTo(L.goalX, gy);
    ctx.lineTo(L.goalX + L.goalW, gy);
    ctx.stroke();
  }

  // posts + crossbar
  ctx.fillStyle = '#ffffff';
  const post = Math.max(5, width * 0.018);
  ctx.fillRect(L.goalX - post, L.goalY, post, L.goalH + post);
  ctx.fillRect(L.goalX + L.goalW, L.goalY, post, L.goalH + post);
  ctx.fillRect(L.goalX - post, L.goalY - post, L.goalW + post * 2, post);

  // aim reticle (only while aiming)
  if (state.phase === 'aim') {
    const c = zoneCenter(L, state, state.aim);
    const rad = Math.min(L.zoneW, L.zoneH) * (0.26 + 0.05 * info.pulse);
    ctx.strokeStyle = '#ff4d8d';
    ctx.lineWidth = Math.max(3, width * 0.01);
    ctx.beginPath();
    ctx.arc(c.x, c.y, rad, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(c.x - rad, c.y);
    ctx.lineTo(c.x + rad, c.y);
    ctx.moveTo(c.x, c.y - rad);
    ctx.lineTo(c.x, c.y + rad);
    ctx.stroke();
  }

  // keeper: idle on the line while aiming, covering zones on a result
  if (state.phase === 'aim') {
    drawKeeper(ctx, width / 2 - L.zoneW * 0.5, L.goalY + L.goalH - L.zoneH, L.zoneW, L.zoneH);
  } else {
    for (const z of state.keeperZones) {
      const col = z % state.cols;
      const row = Math.floor(z / state.cols);
      drawKeeper(ctx, L.goalX + col * L.zoneW, L.goalY + row * L.zoneH, L.zoneW, L.zoneH);
    }
  }

  // ball: at the spot while aiming, travelling to the shot zone on a result
  if (state.phase === 'aim' || state.shotZone < 0) {
    drawBall(ctx, L.spotX, L.spotY, L.ballR);
  } else {
    const target = zoneCenter(L, state, state.shotZone);
    const p = Math.min(1, info.ballProgress);
    const bx = L.spotX + (target.x - L.spotX) * p;
    const by = L.spotY + (target.y - L.spotY) * p;
    const r = L.ballR * (1 - 0.35 * p); // shrinks slightly as it flies "away"
    drawBall(ctx, bx, by, r);
  }

  // HUD
  ctx.fillStyle = '#0d2a12';
  ctx.font = `700 ${Math.round(height * 0.04)}px system-ui, sans-serif`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText(`${info.scoreLabel}: ${state.score}`, 12, 10);
  ctx.textAlign = 'right';
  ctx.fillText(`${info.livesLabel}: ${'●'.repeat(Math.max(0, state.lives))}`, width - 12, 10);

  // result / hint banner
  ctx.textAlign = 'center';
  if (state.phase !== 'aim' && state.lastResult && info.ballProgress > 0.6) {
    const goal = state.lastResult === 'goal';
    ctx.fillStyle = goal ? '#1aa64b' : '#e23b3b';
    ctx.font = `800 ${Math.round(height * 0.09)}px system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillText(goal ? info.goalText : info.saveText, width / 2, height * 0.5);
  } else if (state.phase === 'aim') {
    ctx.fillStyle = 'rgba(13,42,18,0.8)';
    ctx.font = `600 ${Math.round(height * 0.032)}px system-ui, sans-serif`;
    ctx.textBaseline = 'bottom';
    ctx.fillText(info.aimHint, width / 2, height - 8);
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

/** Map a pointer position to a goal zone, or -1 if outside the goal mouth. */
export function zoneAt(
  width: number,
  height: number,
  state: PenaltyState,
  px: number,
  py: number,
): number {
  const L = computeLayout(width, height, state);
  if (px < L.goalX || px > L.goalX + L.goalW || py < L.goalY || py > L.goalY + L.goalH) return -1;
  const col = Math.min(state.cols - 1, Math.floor((px - L.goalX) / L.zoneW));
  const row = Math.min(state.rows - 1, Math.floor((py - L.goalY) / L.zoneH));
  return row * state.cols + col;
}
