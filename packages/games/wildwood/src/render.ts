/**
 * Wildwood Nights renderer — original, asset-free canvas art drawn in logical
 * (CSS-pixel) coordinates. Everything is procedural and deterministic (no
 * Math.random): flame flicker, grass and lighting all derive from a passed
 * `clock` and from stable per-entity hashes, so the visuals replay identically.
 *
 * A top-down forest clearing: ground, trees/bushes, the campfire's warm glow,
 * the player and shadow-wolves are y-sorted for overlap, then a night darkness
 * overlay is "cut" by the fire and the player's light. The HUD sits on top.
 */

import {
  FIRE_CORE,
  FIRE_X,
  FIRE_Y,
  PLAYER_R,
  SWING_TIME,
  WOLF_R,
  WORLD_H,
  WORLD_W,
  fireLightRadius,
  type Bush,
  type Tree,
  type WildwoodState,
  type Wolf,
} from './logic';

const TAU = Math.PI * 2;

export interface View {
  ox: number;
  oy: number;
  s: number;
}

export interface DrawLabels {
  night: string;
  best: string;
}

export interface Banner {
  text: string;
  sub?: string;
  color: string;
}

export interface DrawInfo {
  /** seconds clock for animation */
  clock: number;
  /** device pixel ratio — the night overlay is rendered at device resolution */
  dpr: number;
  best: number;
  labels: DrawLabels;
  banner: Banner | null;
}

/** HUD font with emoji fallbacks so glyph icons render across platforms. */
const HUD_FONT = "system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";

/**
 * Fixed grass-tuft positions (normalized 0..1), hashed once at module load so the
 * hot draw path doesn't recompute 180 Math.sin calls per frame.
 */
const GRASS_TUFTS: { fx: number; fy: number }[] = Array.from({ length: 90 }, (_, i) => ({
  fx: Math.abs((Math.sin(i * 12.9898) * 43758.5453) % 1),
  fy: Math.abs((Math.sin(i * 78.233) * 12543.789) % 1),
}));

export function computeView(width: number, height: number): View {
  const s = Math.min(width / WORLD_W, height / WORLD_H);
  return { ox: (width - WORLD_W * s) / 2, oy: (height - WORLD_H * s) / 2, s };
}

/** Map a pointer position (canvas px) to a world coordinate. */
export function pointerToWorld(
  width: number,
  height: number,
  px: number,
  py: number,
): { x: number; y: number } {
  const v = computeView(width, height);
  return { x: (px - v.ox) / v.s, y: (py - v.oy) / v.s };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mix(a: [number, number, number], b: [number, number, number], t: number): string {
  const r = Math.round(lerp(a[0], b[0], t));
  const g = Math.round(lerp(a[1], b[1], t));
  const bl = Math.round(lerp(a[2], b[2], t));
  return `rgb(${r},${g},${bl})`;
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

/**
 * Darkness for the current moment in the day/night cycle (0 = bright day,
 * ~0.85 = deep night). Eases in at dusk and out at dawn so transitions are soft.
 */
function darknessOf(state: WildwoodState): number {
  const o = state.opts;
  if (state.isNight) {
    const inEdge = Math.min(1, state.cycleTime / 2.5);
    const outEdge = Math.min(1, (o.nightLength - state.cycleTime) / 2.5);
    return 0.84 * Math.max(0, Math.min(inEdge, outEdge));
  }
  // a touch of dusk in the last few seconds of the day
  const dusk = Math.max(0, (state.cycleTime - (o.dayLength - 3.5)) / 3.5);
  return 0.32 * Math.min(1, dusk);
}

// Cached offscreen layer for the night overlay (so light "holes" don't erase the
// scene). Sized to DEVICE pixels (width*dpr) so the darkness and the soft light
// edges stay crisp on HiDPI screens; re-created when the size or dpr changes.
let darkLayer: HTMLCanvasElement | null = null;
function getDarkLayer(width: number, height: number, dpr: number): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  const dw = Math.round(width * dpr);
  const dh = Math.round(height * dpr);
  if (!darkLayer || darkLayer.width !== dw || darkLayer.height !== dh) {
    darkLayer = document.createElement('canvas');
    darkLayer.width = dw;
    darkLayer.height = dh;
  }
  return darkLayer.getContext('2d');
}

/** Release the cached offscreen night layer (called on game teardown). */
export function disposeRenderCache(): void {
  darkLayer = null;
}

function drawGround(
  ctx: CanvasRenderingContext2D,
  v: View,
  width: number,
  height: number,
  dark: number,
): void {
  // letterbox / deep forest beyond the clearing
  ctx.fillStyle = mix([18, 33, 22], [6, 10, 16], dark);
  ctx.fillRect(0, 0, width, height);

  // the clearing floor
  const day: [number, number, number] = [60, 92, 52];
  const night: [number, number, number] = [22, 38, 40];
  ctx.fillStyle = mix(day, night, dark);
  ctx.fillRect(v.ox, v.oy, WORLD_W * v.s, WORLD_H * v.s);

  // subtle scattered grass tufts at fixed, precomputed positions
  ctx.fillStyle = mix([52, 82, 46], [20, 34, 36], dark);
  const gw = Math.max(1, v.s * 0.7);
  const gh = Math.max(1, v.s * 1.6);
  for (const t of GRASS_TUFTS) {
    ctx.fillRect(v.ox + t.fx * WORLD_W * v.s, v.oy + t.fy * WORLD_H * v.s, gw, gh);
  }

  // bare dirt ring around the campfire
  const grad = ctx.createRadialGradient(
    v.ox + FIRE_X * v.s,
    v.oy + FIRE_Y * v.s,
    2,
    v.ox + FIRE_X * v.s,
    v.oy + FIRE_Y * v.s,
    FIRE_CORE * 1.7 * v.s,
  );
  grad.addColorStop(0, mix([86, 70, 48], [40, 34, 30], dark));
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(v.ox, v.oy, WORLD_W * v.s, WORLD_H * v.s);
}

function drawTree(ctx: CanvasRenderingContext2D, t: Tree, v: View, dark: number): void {
  const x = v.ox + t.x * v.s;
  const y = v.oy + t.y * v.s;
  const sway = t.shake > 0 ? Math.sin(t.shake * 60) * 1.2 * v.s : 0;

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(x, y + 5 * v.s, 6 * v.s, 2.4 * v.s, 0, 0, TAU);
  ctx.fill();

  if (t.wood <= 0) {
    // stump: short trunk with a couple of rings
    ctx.fillStyle = mix([102, 74, 44], [54, 42, 34], dark);
    roundRect(ctx, x - 2.4 * v.s, y - 2 * v.s, 4.8 * v.s, 4 * v.s, 1.4 * v.s);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,40,24,0.7)';
    ctx.lineWidth = Math.max(1, v.s * 0.5);
    ctx.beginPath();
    ctx.ellipse(x, y - 2 * v.s, 2.2 * v.s, 1 * v.s, 0, 0, TAU);
    ctx.stroke();
    return;
  }

  // trunk
  ctx.fillStyle = mix([96, 66, 40], [48, 38, 32], dark);
  ctx.fillRect(x - 1.5 * v.s + sway * 0.2, y - 2 * v.s, 3 * v.s, 7 * v.s);

  // layered pine canopy (three tiers), darkening toward night
  const cap: [number, number, number] = [46, 116, 58];
  const capN: [number, number, number] = [18, 52, 44];
  ctx.fillStyle = mix(cap, capN, dark);
  for (let k = 0; k < 3; k++) {
    const ty = y - 1 * v.s - k * 4.5 * v.s;
    const tw = (8 - k * 1.8) * v.s;
    ctx.beginPath();
    ctx.moveTo(x + sway, ty - 6.5 * v.s);
    ctx.lineTo(x - tw + sway * 0.6, ty);
    ctx.lineTo(x + tw + sway * 0.6, ty);
    ctx.closePath();
    ctx.fill();
  }
  // tiny highlight to give the canopy form
  ctx.fillStyle = `rgba(255,255,255,${0.1 * (1 - dark)})`;
  ctx.beginPath();
  ctx.moveTo(x + sway, y - 16 * v.s);
  ctx.lineTo(x - 2 * v.s + sway, y - 11 * v.s);
  ctx.lineTo(x + sway, y - 11 * v.s);
  ctx.closePath();
  ctx.fill();
}

function drawBush(ctx: CanvasRenderingContext2D, b: Bush, v: View, dark: number): void {
  const x = v.ox + b.x * v.s;
  const y = v.oy + b.y * v.s;
  const sway = b.shake > 0 ? Math.sin(b.shake * 60) * 1 * v.s : 0;

  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(x, y + 3 * v.s, 5 * v.s, 2 * v.s, 0, 0, TAU);
  ctx.fill();

  ctx.fillStyle = mix([54, 120, 56], [22, 52, 42], dark);
  for (const [dx, dy, r] of [
    [-2.6, 0, 3.4],
    [2.6, 0, 3.4],
    [0, -2, 3.8],
  ] as const) {
    ctx.beginPath();
    ctx.arc(x + dx * v.s + sway, y + dy * v.s, r * v.s, 0, TAU);
    ctx.fill();
  }
  // berries
  ctx.fillStyle = mix([226, 70, 86], [150, 44, 60], dark);
  const spots = [
    [-2, -1],
    [2, -2],
    [0, 1],
  ];
  for (let i = 0; i < b.berries && i < spots.length; i++) {
    ctx.beginPath();
    ctx.arc(x + spots[i][0] * v.s + sway, y + spots[i][1] * v.s, 1.1 * v.s, 0, TAU);
    ctx.fill();
  }
}

function drawFire(
  ctx: CanvasRenderingContext2D,
  state: WildwoodState,
  v: View,
  clock: number,
): void {
  const x = v.ox + FIRE_X * v.s;
  const y = v.oy + FIRE_Y * v.s;
  const fuelFrac = state.fire.fuel / state.fire.maxFuel;

  // stone ring
  ctx.fillStyle = '#6b6f78';
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * 6 * v.s, y + Math.sin(a) * 4.6 * v.s, 1.7 * v.s, 1.3 * v.s, a, 0, TAU);
    ctx.fill();
  }
  // logs (crossed)
  ctx.strokeStyle = '#6b4a2b';
  ctx.lineWidth = 1.8 * v.s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 4 * v.s, y + 1 * v.s);
  ctx.lineTo(x + 4 * v.s, y - 1 * v.s);
  ctx.moveTo(x - 4 * v.s, y - 1 * v.s);
  ctx.lineTo(x + 4 * v.s, y + 1 * v.s);
  ctx.stroke();

  if (state.fire.fuel <= 0) {
    // embers only — the fire is out
    ctx.fillStyle = `rgba(180,60,30,${0.4 + 0.2 * Math.sin(clock * 4)})`;
    ctx.beginPath();
    ctx.arc(x, y - 0.5 * v.s, 1.6 * v.s, 0, TAU);
    ctx.fill();
    // wisp of smoke
    ctx.fillStyle = 'rgba(160,160,160,0.25)';
    ctx.beginPath();
    ctx.ellipse(x + Math.sin(clock * 1.5) * v.s, y - 6 * v.s, 1.6 * v.s, 3 * v.s, 0, 0, TAU);
    ctx.fill();
    return;
  }

  // flames — layered teardrops flickering by index + clock
  const h = (3 + fuelFrac * 7) * v.s;
  const flames: [number, [number, number, number], number][] = [
    [1.0, [255, 170, 40], 1.0],
    [0.7, [255, 90, 30], 1.5],
    [0.4, [255, 235, 120], 2.4],
  ];
  for (const [scale, col, speed] of flames) {
    const flick = 1 + Math.sin(clock * 6 * speed) * 0.16 + Math.sin(clock * 11 * speed + 1) * 0.08;
    const fh = h * scale * flick;
    const fw = (2.2 + 1.6 * scale) * v.s;
    ctx.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
    ctx.beginPath();
    ctx.moveTo(x, y - 1 * v.s - fh);
    ctx.quadraticCurveTo(x - fw, y - fh * 0.4, x, y + 0.5 * v.s);
    ctx.quadraticCurveTo(x + fw, y - fh * 0.4, x, y - 1 * v.s - fh);
    ctx.closePath();
    ctx.fill();
  }
}

function drawWolf(ctx: CanvasRenderingContext2D, w: Wolf, v: View, clock: number): void {
  const x = v.ox + w.x * v.s;
  const y = v.oy + w.y * v.s;

  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(x, y + 2.6 * v.s, WOLF_R * 1.2 * v.s, WOLF_R * 0.5 * v.s, 0, 0, TAU);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(w.facing);

  const u = WOLF_R * v.s;
  const gait = Math.sin(clock * 14 + w.x) * 0.6 * u;
  // legs
  ctx.strokeStyle = '#15161d';
  ctx.lineWidth = 0.9 * u;
  ctx.lineCap = 'round';
  for (const [lx, ph] of [
    [-0.5, 0],
    [-0.5, Math.PI],
    [0.7, Math.PI],
    [0.7, 0],
  ] as const) {
    const off = Math.sin(clock * 14 + w.x + ph) * 0.5 * u;
    ctx.beginPath();
    ctx.moveTo(lx * u, -0.5 * u);
    ctx.lineTo(lx * u + off, 1.3 * u);
    ctx.stroke();
  }
  // tail
  ctx.beginPath();
  ctx.moveTo(-1.1 * u, 0);
  ctx.lineTo(-2.2 * u, gait * 0.4 - 0.4 * u);
  ctx.stroke();

  // body
  const hurt = w.hurt > 0;
  ctx.fillStyle = hurt ? '#a33' : '#23252e';
  roundRect(ctx, -1.5 * u, -1.1 * u, 2.9 * u, 2.2 * u, 1 * u);
  ctx.fill();
  // head toward facing (+x local)
  ctx.fillStyle = hurt ? '#b44' : '#2b2d38';
  ctx.beginPath();
  ctx.arc(1.5 * u, 0, 0.95 * u, 0, TAU);
  ctx.fill();
  // ears
  ctx.fillStyle = '#1a1b22';
  for (const ey of [-0.7, 0.7]) {
    ctx.beginPath();
    ctx.moveTo(1.4 * u, ey * u);
    ctx.lineTo(1.0 * u, ey * 1.7 * u);
    ctx.lineTo(1.8 * u, ey * 1.3 * u);
    ctx.closePath();
    ctx.fill();
  }
  // glowing eyes
  ctx.fillStyle = '#ffd23a';
  ctx.beginPath();
  ctx.arc(2.0 * u, -0.35 * u, 0.28 * u, 0, TAU);
  ctx.arc(2.0 * u, 0.35 * u, 0.28 * u, 0, TAU);
  ctx.fill();

  ctx.restore();
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  state: WildwoodState,
  v: View,
  clock: number,
): void {
  const p = state.player;
  const x = v.ox + p.x * v.s;
  const y = v.oy + p.y * v.s;
  const u = PLAYER_R * v.s;
  const moving = Math.hypot(p.vx, p.vy) > 1;
  const bob = moving ? Math.sin(clock * 12) * 0.4 * u : 0;

  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(x, y + 1.1 * u, u * 1.1, u * 0.5, 0, 0, TAU);
  ctx.fill();

  // swing arc (axe sweep) in the facing direction
  if (p.swing > 0) {
    const prog = 1 - p.swing / SWING_TIME;
    const a0 = p.facing - 1.1;
    const a1 = p.facing + 1.1;
    const a = lerp(a0, a1, prog);
    ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - prog)})`;
    ctx.lineWidth = 1.4 * v.s;
    ctx.beginPath();
    ctx.arc(x, y, u * 3, a - 0.5, a + 0.5);
    ctx.stroke();
    // axe head
    const hx = x + Math.cos(a) * u * 3.2;
    const hy = y + Math.sin(a) * u * 3.2;
    ctx.fillStyle = '#cdd3da';
    ctx.beginPath();
    ctx.arc(hx, hy, 1.3 * v.s, 0, TAU);
    ctx.fill();
  }

  const hurt = p.hurt > 0 && Math.sin(clock * 30) > 0;
  // body (tunic)
  ctx.fillStyle = hurt ? '#e26d6d' : '#2f9e7e';
  roundRect(ctx, x - u * 0.9, y - u * 0.4 + bob, u * 1.8, u * 1.7, u * 0.6);
  ctx.fill();
  // belt
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x - u * 0.9, y + u * 0.8 + bob, u * 1.8, u * 0.3);
  // head
  ctx.fillStyle = hurt ? '#f0b8a8' : '#f1c79c';
  ctx.beginPath();
  ctx.arc(x, y - u * 0.7 + bob, u * 0.7, 0, TAU);
  ctx.fill();
  // hood/hair cap
  ctx.fillStyle = '#7a4a28';
  ctx.beginPath();
  ctx.arc(x, y - u * 0.85 + bob, u * 0.6, Math.PI, TAU);
  ctx.fill();

  // a facing pip so you can read orientation
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.arc(x + Math.cos(p.facing) * u * 0.5, y - u * 0.7 + Math.sin(p.facing) * u * 0.4 + bob, u * 0.18, 0, TAU);
  ctx.fill();
}

function drawWarmGlow(
  ctx: CanvasRenderingContext2D,
  state: WildwoodState,
  v: View,
  clock: number,
): void {
  if (state.fire.fuel <= 0) return;
  const x = v.ox + FIRE_X * v.s;
  const y = v.oy + FIRE_Y * v.s;
  const r = fireLightRadius(state) * v.s * (1 + Math.sin(clock * 5) * 0.03);
  const g = ctx.createRadialGradient(x, y, 2, x, y, r);
  g.addColorStop(0, 'rgba(255,170,70,0.35)');
  g.addColorStop(0.5, 'rgba(255,140,50,0.14)');
  g.addColorStop(1, 'rgba(255,140,50,0)');
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawNight(
  ctx: CanvasRenderingContext2D,
  state: WildwoodState,
  v: View,
  width: number,
  height: number,
  dark: number,
  dpr: number,
): void {
  if (dark <= 0.001) return;
  const layer = getDarkLayer(width, height, dpr);
  if (!layer) {
    // fallback: flat dim (no light holes) if no offscreen canvas
    ctx.fillStyle = `rgba(6,10,26,${dark})`;
    ctx.fillRect(0, 0, width, height);
    return;
  }
  // draw the overlay in logical coords but at device resolution
  layer.setTransform(dpr, 0, 0, dpr, 0, 0);
  layer.clearRect(0, 0, width, height);
  layer.fillStyle = `rgba(6,10,26,${dark})`;
  layer.fillRect(0, 0, width, height);

  // cut soft holes where there is light: the fire, and the player's lantern
  layer.globalCompositeOperation = 'destination-out';
  const fx = v.ox + FIRE_X * v.s;
  const fy = v.oy + FIRE_Y * v.s;
  const fr = fireLightRadius(state) * v.s;
  if (fr > 0) {
    const fg = layer.createRadialGradient(fx, fy, fr * 0.2, fx, fy, fr);
    fg.addColorStop(0, 'rgba(0,0,0,1)');
    fg.addColorStop(0.7, 'rgba(0,0,0,0.85)');
    fg.addColorStop(1, 'rgba(0,0,0,0)');
    layer.fillStyle = fg;
    layer.beginPath();
    layer.arc(fx, fy, fr, 0, TAU);
    layer.fill();
  }
  // player lantern (visibility only — does not count as warmth in the logic)
  const px = v.ox + state.player.x * v.s;
  const py = v.oy + state.player.y * v.s;
  const pr = 20 * v.s;
  const pg = layer.createRadialGradient(px, py, pr * 0.2, px, py, pr);
  pg.addColorStop(0, 'rgba(0,0,0,0.85)');
  pg.addColorStop(1, 'rgba(0,0,0,0)');
  layer.fillStyle = pg;
  layer.beginPath();
  layer.arc(px, py, pr, 0, TAU);
  layer.fill();
  layer.globalCompositeOperation = 'source-over';

  // blit the device-resolution layer 1:1 onto the backing store — reset the main
  // context's DPR transform so it isn't upscaled/blurred, then restore it for the HUD.
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(layer.canvas, 0, 0);
  ctx.restore();
}

function bar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  frac: number,
  color: string,
  icon: string,
): void {
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  const f = Math.max(0, Math.min(1, frac));
  if (f > 0) {
    ctx.fillStyle = color;
    roundRect(ctx, x, y, Math.max(h, w * f), h, h / 2);
    ctx.fill();
  }
  ctx.fillStyle = '#fff';
  ctx.font = `${Math.round(h * 0.92)}px ${HUD_FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(icon, x - h * 1.15, y + h / 2);
}

function drawHud(
  ctx: CanvasRenderingContext2D,
  state: WildwoodState,
  width: number,
  height: number,
  info: DrawInfo,
): void {
  const p = state.player;
  const pad = Math.round(Math.min(width, height) * 0.05);
  const bw = Math.min(width * 0.42, 170);
  const bh = Math.max(8, Math.round(height * 0.022));
  const gap = bh * 1.7;
  const x0 = pad + bh * 1.2;
  let y = pad;

  bar(ctx, x0, y, bw, bh, p.health / p.maxHealth, '#e0455e', '♥');
  y += gap;
  // green (not amber) so the hunger bar reads distinctly from the orange fire bar
  bar(ctx, x0, y, bw, bh, p.hunger / p.maxHunger, '#6cc24a', '🍃');
  y += gap;
  bar(ctx, x0, y, bw, bh, state.fire.fuel / state.fire.maxFuel, '#ff8a3d', '🔥');

  // top-right: night counter + sun/moon, carried wood & food
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#fff';
  const big = Math.round(height * 0.035);
  ctx.font = `800 ${big}px ${HUD_FONT}`;
  const moon = state.isNight ? '🌙' : '☀️';
  ctx.fillText(`${moon} ${info.labels.night} ${state.night}`, width - pad, pad);

  const small = Math.round(height * 0.028);
  ctx.font = `700 ${small}px ${HUD_FONT}`;
  ctx.fillText(`🪵 ${p.wood}    🍒 ${p.food}`, width - pad, pad + big * 1.4);
  if (info.best > 0) {
    ctx.fillStyle = '#cbb8e8';
    ctx.fillText(`${info.labels.best}: ${info.best}`, width - pad, pad + big * 1.4 + small * 1.5);
  }

  // day/night progress sliver along the very top
  const o = state.opts;
  const frac = state.isNight ? state.cycleTime / o.nightLength : state.cycleTime / o.dayLength;
  ctx.fillStyle = state.isNight ? 'rgba(120,140,255,0.5)' : 'rgba(255,220,120,0.6)';
  ctx.fillRect(0, 0, width * Math.min(1, frac), Math.max(2, height * 0.006));

  // banner
  if (info.banner) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, height * 0.32, width, height * 0.2);
    ctx.fillStyle = info.banner.color;
    ctx.font = `900 ${Math.round(height * 0.07)}px system-ui, sans-serif`;
    ctx.fillText(info.banner.text, width / 2, height * 0.4);
    if (info.banner.sub) {
      ctx.fillStyle = '#fff';
      ctx.font = `700 ${Math.round(height * 0.032)}px system-ui, sans-serif`;
      ctx.fillText(info.banner.sub, width / 2, height * 0.47);
    }
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

export function draw(
  ctx: CanvasRenderingContext2D,
  state: WildwoodState,
  width: number,
  height: number,
  info: DrawInfo,
): void {
  const v = computeView(width, height);
  const dark = darknessOf(state);

  drawGround(ctx, v, width, height, dark);
  drawWarmGlow(ctx, state, v, info.clock);

  // y-sorted drawables for correct top-down overlap
  type Item = { y: number; draw: () => void };
  const items: Item[] = [];
  for (const t of state.trees) items.push({ y: t.y, draw: () => drawTree(ctx, t, v, dark) });
  for (const b of state.bushes) items.push({ y: b.y, draw: () => drawBush(ctx, b, v, dark) });
  for (const w of state.wolves) items.push({ y: w.y, draw: () => drawWolf(ctx, w, v, info.clock) });
  items.push({ y: FIRE_Y, draw: () => drawFire(ctx, state, v, info.clock) });
  items.push({ y: state.player.y, draw: () => drawPlayer(ctx, state, v, info.clock) });
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.draw();

  drawNight(ctx, state, v, width, height, dark, info.dpr);
  drawHud(ctx, state, width, height, info);
}
