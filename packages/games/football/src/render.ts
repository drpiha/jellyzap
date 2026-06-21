import {
  FW,
  FH,
  KEEPER_Y,
  MOUTH_LEFT,
  MOUTH_RIGHT,
  PLAYER_R,
  type FootballState,
} from './logic';

export interface View {
  ox: number;
  oy: number;
  scale: number;
}

export interface DrawInfo {
  scoreLabel: string;
  timeLabel: string;
  banner: { text: string; color: string } | null;
}

export function computeView(width: number, height: number): View {
  const scale = Math.min(width / FW, height / FH) * 0.96;
  return {
    ox: (width - FW * scale) / 2,
    oy: (height - FH * scale) / 2,
    scale,
  };
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  circle(ctx, x, y, r, '#ffffff');
  ctx.fillStyle = '#1c2540';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.42, 0, Math.PI * 2);
  ctx.fill();
}

export function draw(
  ctx: CanvasRenderingContext2D,
  state: FootballState,
  width: number,
  height: number,
  info: DrawInfo,
): void {
  const v = computeView(width, height);
  const fx = (x: number) => v.ox + x * v.scale;
  const fy = (y: number) => v.oy + y * v.scale;

  // backdrop
  ctx.fillStyle = '#0b1f12';
  ctx.fillRect(0, 0, width, height);

  // pitch
  ctx.fillStyle = '#2fa84f';
  ctx.fillRect(fx(0), fy(0), FW * v.scale, FH * v.scale);
  // mow stripes
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  const stripes = 8;
  for (let i = 0; i < stripes; i += 2) {
    ctx.fillRect(fx(0), fy((FH / stripes) * i), FW * v.scale, (FH / stripes) * v.scale);
  }

  // markings
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = Math.max(1, v.scale * 0.6);
  ctx.strokeRect(fx(2), fy(2), (FW - 4) * v.scale, (FH - 4) * v.scale);
  // halfway line + centre circle
  ctx.beginPath();
  ctx.moveTo(fx(2), fy(FH / 2));
  ctx.lineTo(fx(FW - 2), fy(FH / 2));
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(fx(FW / 2), fy(FH / 2), 12 * v.scale, 0, Math.PI * 2);
  ctx.stroke();
  // penalty box (top)
  ctx.strokeRect(fx(MOUTH_LEFT - 6), fy(0), (MOUTH_RIGHT - MOUTH_LEFT + 12) * v.scale, 22 * v.scale);

  // goal mouth + net at the top
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(fx(MOUTH_LEFT), fy(-2), (MOUTH_RIGHT - MOUTH_LEFT) * v.scale, 5 * v.scale);
  ctx.fillStyle = '#ffffff';
  const post = Math.max(2, v.scale * 1.2);
  ctx.fillRect(fx(MOUTH_LEFT) - post, fy(0) - 6 * v.scale, post, 7 * v.scale);
  ctx.fillRect(fx(MOUTH_RIGHT), fy(0) - 6 * v.scale, post, 7 * v.scale);
  ctx.fillRect(fx(MOUTH_LEFT) - post, fy(0) - 6 * v.scale, (MOUTH_RIGHT - MOUTH_LEFT) * v.scale + post, post);

  // keeper
  circle(ctx, fx(state.keeper.x), fy(KEEPER_Y), PLAYER_R * v.scale * 1.05, '#ffd000');
  // defender
  circle(ctx, fx(state.defender.x), fy(state.defender.y), PLAYER_R * v.scale, '#ef4444');
  // player
  circle(ctx, fx(state.player.x), fy(state.player.y), PLAYER_R * v.scale, '#2b6cff');
  // ball
  drawBall(ctx, fx(state.ball.x), fy(state.ball.y), Math.max(3, v.scale * 2.4));

  // HUD
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${Math.round(height * 0.04)}px system-ui, sans-serif`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText(`${info.scoreLabel}: ${state.score}`, 12, 10);
  ctx.textAlign = 'right';
  ctx.fillText(`${info.timeLabel}: ${Math.ceil(state.timeLeft)}`, width - 12, 10);

  // banner flash (goal / miss / tackle)
  if (info.banner) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = info.banner.color;
    ctx.font = `800 ${Math.round(height * 0.085)}px system-ui, sans-serif`;
    ctx.fillText(info.banner.text, width / 2, height * 0.42);
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

/** Map a pointer position (canvas px) to a field target the player steers toward. */
export function pointerToField(
  width: number,
  height: number,
  px: number,
  py: number,
): { x: number; y: number } {
  const v = computeView(width, height);
  return {
    x: Math.max(0, Math.min(FW, (px - v.ox) / v.scale)),
    y: Math.max(0, Math.min(FH, (py - v.oy) / v.scale)),
  };
}
