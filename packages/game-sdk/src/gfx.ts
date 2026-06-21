/** Shared "jelly" visual theme + tiny canvas drawing helpers so every game has a
 * consistent, candy-bright look with minimal code. */
export const PALETTE = {
  bg: '#16092e',
  bgAlt: '#1f0d3d',
  board: '#120a24',
  panel: '#2a1758',
  ink: '#f4ecff',
  inkDim: '#b9a7e0',
  primary: '#a855f7',
  primaryDark: '#7c3aed',
  accent: '#ff4d8d',
  accent2: '#22d3ee',
  good: '#34d399',
  warn: '#fbbf24',
  bad: '#fb7185',
  grid: 'rgba(255,255,255,0.05)',
} as const;

export interface TextOptions {
  size?: number;
  color?: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  weight?: number | string;
  font?: string;
}

const FONT_STACK =
  "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

export function strokeRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  color: string,
  lineWidth = 2,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.stroke();
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  o: TextOptions = {},
): void {
  ctx.fillStyle = o.color ?? PALETTE.ink;
  ctx.textAlign = o.align ?? 'left';
  ctx.textBaseline = o.baseline ?? 'alphabetic';
  ctx.font = o.font ?? `${o.weight ?? 700} ${o.size ?? 16}px ${FONT_STACK}`;
  ctx.fillText(text, x, y);
}

/** Vertical background gradient using the jelly palette. */
export function paintBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  top: string = PALETTE.bgAlt,
  bottom: string = PALETTE.bg,
): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** Semi-transparent overlay (e.g. for game-over screens). */
export function dimOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  alpha = 0.55,
): void {
  ctx.fillStyle = `rgba(8, 4, 20, ${alpha})`;
  ctx.fillRect(0, 0, w, h);
}
