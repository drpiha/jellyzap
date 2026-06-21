import { FW, FH, KEEPER_Y, PLAYER_R, mouthLeft, mouthRight, type FootballState, type Mover } from './logic';

const TAU = Math.PI * 2;

export interface View {
  ox: number;
  oy: number;
  scale: number;
}

export type PlayerPose = 'idle' | 'run' | 'kick' | 'celebrate';

export interface DrawInfo {
  scoreLabel: string;
  timeLabel: string;
  banner: { text: string; color: string } | null;
  /** seconds clock for limb animation */
  clock: number;
  playerPose: PlayerPose;
}

export function computeView(width: number, height: number): View {
  const scale = Math.min(width / FW, height / FH) * 0.96;
  return { ox: (width - FW * scale) / 2, oy: (height - FH * scale) / 2, scale };
}

function limb(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  w: number,
  color: string,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
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
  ctx.fill();
}

interface FigureColors {
  jersey: string;
  shorts: string;
  skin: string;
  hair: string;
}

/** Draw an animated top-down footballer facing `heading`, with a sine run cycle. */
function drawFootballer(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  u: number,
  heading: number,
  phase: number,
  pose: PlayerPose,
  c: FigureColors,
): void {
  // ground shadow (world space, doesn't rotate)
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(px, py + u * 0.95, u * 1.25, u * 0.5, 0, 0, TAU);
  ctx.fill();

  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(heading + Math.PI / 2); // figure is modelled facing local "up" (-y)

  const swing = u * 0.85;
  const lp = Math.sin(phase) * swing;
  const rp = Math.sin(phase + Math.PI) * swing;
  let legL = lp;
  let legR = rp;
  const celebrate = pose === 'celebrate';
  if (pose === 'kick') {
    legR = -swing * 1.7; // right boot drives forward
    legL = swing * 0.6;
  } else if (celebrate) {
    legL = swing * 0.5;
    legR = -swing * 0.5;
  }

  // legs (drawn first, behind torso)
  limb(ctx, -u * 0.45, u * 0.2, -u * 0.45, u * 1.5 + legL, u * 0.5, c.shorts);
  limb(ctx, u * 0.45, u * 0.2, u * 0.45, u * 1.5 + legR, u * 0.5, c.shorts);

  // arms (skin); raised on celebrate, else swing opposite the legs
  if (celebrate) {
    limb(ctx, -u * 0.8, -u * 0.2, -u * 1.3, -u * 1.4, u * 0.42, c.skin);
    limb(ctx, u * 0.8, -u * 0.2, u * 1.3, -u * 1.4, u * 0.42, c.skin);
  } else {
    limb(ctx, -u * 0.8, -u * 0.1, -u * 1.35, u * 0.5 - lp * 0.7, u * 0.42, c.skin);
    limb(ctx, u * 0.8, -u * 0.1, u * 1.35, u * 0.5 - rp * 0.7, u * 0.42, c.skin);
  }

  // torso / jersey (+ a subtle shoulder collar, not a face-like stripe)
  ctx.fillStyle = c.jersey;
  roundRect(ctx, -u * 0.9, -u * 0.6, u * 1.8, u * 1.6, u * 0.55);
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  roundRect(ctx, -u * 0.9, -u * 0.55, u * 1.8, u * 0.34, u * 0.25);

  // head + hair (toward the front)
  ctx.fillStyle = c.skin;
  ctx.beginPath();
  ctx.arc(0, -u * 0.75, u * 0.62, 0, TAU);
  ctx.fill();
  ctx.fillStyle = c.hair;
  ctx.beginPath();
  ctx.arc(0, -u * 0.92, u * 0.5, Math.PI, TAU);
  ctx.fill();

  ctx.restore();
}

function moverPhase(m: { vx: number; vy: number }, clock: number): { heading: number; phase: number } {
  const speed = Math.hypot(m.vx, m.vy);
  const moving = speed > 3;
  return {
    heading: moving ? Math.atan2(m.vy, m.vx) : -Math.PI / 2,
    phase: moving ? clock * (8 + speed * 0.04) : 0,
  };
}

function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, spin: number): void {
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.9, r * 1.1, r * 0.45, 0, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#1c2540';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.4, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(28,37,64,0.7)';
  ctx.lineWidth = Math.max(1, r * 0.16);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.72, 0.3, 2.0);
  ctx.stroke();
  ctx.restore();
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
  const u = PLAYER_R * v.scale;

  ctx.fillStyle = '#0b1f12';
  ctx.fillRect(0, 0, width, height);

  // pitch + mow stripes
  ctx.fillStyle = '#2fa84f';
  ctx.fillRect(fx(0), fy(0), FW * v.scale, FH * v.scale);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  const stripes = 8;
  for (let i = 0; i < stripes; i += 2) {
    ctx.fillRect(fx(0), fy((FH / stripes) * i), FW * v.scale, (FH / stripes) * v.scale);
  }

  // markings
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = Math.max(1, v.scale * 0.5);
  ctx.strokeRect(fx(3), fy(3), (FW - 6) * v.scale, (FH - 6) * v.scale);
  ctx.beginPath();
  ctx.moveTo(fx(3), fy(FH / 2));
  ctx.lineTo(fx(FW - 3), fy(FH / 2));
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(fx(FW / 2), fy(FH / 2), 12 * v.scale, 0, TAU);
  ctx.stroke();
  // penalty box + arc (top)
  const boxL = mouthLeft(state) - 8;
  const boxW = state.goalW + 16;
  ctx.strokeRect(fx(boxL), fy(0), boxW * v.scale, 24 * v.scale);
  ctx.beginPath();
  ctx.arc(fx(FW / 2), fy(24), 9 * v.scale, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();

  // goal net at the very top
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(fx(mouthLeft(state)), fy(-3), state.goalW * v.scale, 5 * v.scale);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  for (let gx = mouthLeft(state); gx <= mouthRight(state) + 0.1; gx += state.goalW / 8) {
    ctx.beginPath();
    ctx.moveTo(fx(gx), fy(-3));
    ctx.lineTo(fx(gx), fy(2));
    ctx.stroke();
  }
  ctx.fillStyle = '#ffffff';
  const post = Math.max(2, v.scale * 1.1);
  ctx.fillRect(fx(mouthLeft(state)) - post, fy(0) - 5 * v.scale, post, 6 * v.scale);
  ctx.fillRect(fx(mouthRight(state)), fy(0) - 5 * v.scale, post, 6 * v.scale);
  ctx.fillRect(fx(mouthLeft(state)) - post, fy(0) - 5 * v.scale, state.goalW * v.scale + post, post);

  // keeper (faces down the pitch, leans toward its motion)
  {
    const lean = Math.max(-0.6, Math.min(0.6, state.keeper.vx * 0.01));
    drawFootballer(ctx, fx(state.keeper.x), fy(KEEPER_Y), u, Math.PI / 2 + lean, info.clock * 6, 'celebrate', {
      jersey: '#ffd000',
      shorts: '#222',
      skin: '#f1c27d',
      hair: '#2a1a0a',
    });
  }

  // defenders
  for (const d of state.defenders) {
    const mp = moverPhase(d, info.clock);
    drawFootballer(ctx, fx(d.x), fy(d.y), u, mp.heading, mp.phase, mp.phase ? 'run' : 'idle', {
      jersey: '#ef4444',
      shorts: '#ffffff',
      skin: '#e0ac69',
      hair: '#1c1208',
    });
  }

  // player
  {
    const mp = moverPhase(state.player as Mover, info.clock);
    const pose: PlayerPose =
      info.playerPose === 'celebrate' || info.playerPose === 'kick'
        ? info.playerPose
        : mp.phase
          ? 'run'
          : 'idle';
    const heading = info.playerPose === 'kick' || info.playerPose === 'celebrate' ? -Math.PI / 2 : mp.heading;
    drawFootballer(ctx, fx(state.player.x), fy(state.player.y), u, heading, mp.phase, pose, {
      jersey: '#2b6cff',
      shorts: '#ffffff',
      skin: '#f1c27d',
      hair: '#3a2a1a',
    });
  }

  // ball
  drawBall(ctx, fx(state.ball.x), fy(state.ball.y), Math.max(3, v.scale * 2.3), state.ball.spin);

  // HUD
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 ${Math.round(height * 0.04)}px system-ui, sans-serif`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText(`${info.scoreLabel}: ${state.score}`, 12, 10);
  ctx.textAlign = 'right';
  ctx.fillText(`${info.timeLabel}: ${Math.ceil(state.timeLeft)}`, width - 12, 10);

  if (info.banner) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = info.banner.color;
    ctx.font = `800 ${Math.round(height * 0.085)}px system-ui, sans-serif`;
    ctx.fillText(info.banner.text, width / 2, height * 0.4);
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

/** Map a pointer position (canvas px) to a field coordinate. */
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
