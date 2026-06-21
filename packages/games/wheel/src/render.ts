import { PALETTE, drawText, fillRoundRect, paintBackground } from '@jellyzap/game-sdk';
import type { Segment, WheelState } from './logic';

const ACCENT = '#fb923c';

export interface RenderInfo {
  high: number;
  /** angle of the wheel in radians (animated by the host) */
  angle: number;
  /** true while the wheel is mid-spin (disables the alphabet) */
  spinning: boolean;
  scoreLabel: string;
  bestLabel: string;
  livesLabel: string;
  spinLabel: string;
  spinValueLabel: string;
  wordLabel: string;
  winLabel: string;
  loseLabel: string;
}

/** A rectangular hit region in logical canvas coordinates. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Geometry computed from the canvas size, reused for rendering AND hit-testing. */
export interface Layout {
  pad: number;
  hud: number;
  wheelCx: number;
  wheelCy: number;
  wheelR: number;
  spinButton: Rect;
  /** rows of the on-screen alphabet, with each key rect keyed by letter */
  keys: { letter: string; rect: Rect }[];
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/** Compute the layout for a given canvas size and alphabet. Pure geometry. */
export function computeLayout(w: number, h: number, alphabet: readonly string[] = ALPHABET): Layout {
  const pad = Math.round(Math.min(w, h) * 0.04);
  const hud = Math.round(Math.min(w, h) * 0.08);

  // Alphabet keyboard occupies the bottom portion.
  const perRow = alphabet.length <= 26 ? 7 : 8;
  const rows = Math.ceil(alphabet.length / perRow);
  const keyGap = Math.round(Math.min(w, h) * 0.012);
  const kbWidth = w - pad * 2;
  const keyW = (kbWidth - keyGap * (perRow - 1)) / perRow;
  const keyH = Math.min(keyW, Math.round(Math.min(w, h) * 0.085));
  const kbHeight = rows * keyH + (rows - 1) * keyGap;
  const kbTop = h - pad - kbHeight;

  const keys: { letter: string; rect: Rect }[] = [];
  for (let i = 0; i < alphabet.length; i++) {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const countInRow = Math.min(perRow, alphabet.length - row * perRow);
    const rowWidth = countInRow * keyW + (countInRow - 1) * keyGap;
    const rowX = (w - rowWidth) / 2;
    keys.push({
      letter: alphabet[i],
      rect: {
        x: rowX + col * (keyW + keyGap),
        y: kbTop + row * (keyH + keyGap),
        w: keyW,
        h: keyH,
      },
    });
  }

  // The wheel + spin button sit between the HUD and the keyboard.
  const midTop = hud + pad;
  const midBottom = kbTop - pad;
  const midH = Math.max(40, midBottom - midTop);
  const wheelR = Math.min(midH * 0.42, w * 0.34);
  const wheelCx = w / 2;
  const wheelCy = midTop + wheelR + Math.round(Math.min(w, h) * 0.04);

  const btnW = Math.min(w * 0.5, wheelR * 2.2);
  const btnH = Math.round(Math.min(w, h) * 0.075);
  const spinButton: Rect = {
    x: (w - btnW) / 2,
    y: Math.min(wheelCy + wheelR + Math.round(Math.min(w, h) * 0.03), midBottom - btnH),
    w: btnW,
    h: btnH,
  };

  return { pad, hud, wheelCx, wheelCy, wheelR, spinButton, keys };
}

export function pointInRect(px: number, py: number, r: Rect): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

function segmentColor(seg: Segment, i: number): string {
  if (seg === 'BANKRUPT') return '#0b0617';
  if (seg === 'LOSE_TURN') return PALETTE.bad;
  const wheelColors = [
    ACCENT,
    PALETTE.primary,
    PALETTE.accent2,
    PALETTE.good,
    PALETTE.warn,
    PALETTE.accent,
    '#60a5fa',
    '#f472b6',
  ];
  return wheelColors[i % wheelColors.length];
}

function segmentLabel(seg: Segment): string {
  if (seg === 'BANKRUPT') return 'X';
  if (seg === 'LOSE_TURN') return '∅';
  return String(seg);
}

export function draw(
  ctx: CanvasRenderingContext2D,
  state: WheelState,
  w: number,
  h: number,
  info: RenderInfo,
): void {
  paintBackground(ctx, w, h);
  const L = computeLayout(w, h, ALPHABET);

  // ---- HUD ----
  drawText(ctx, `${info.scoreLabel}: ${state.roundScore}`, L.pad, L.pad + L.hud * 0.5, {
    size: Math.round(L.hud * 0.42),
    color: PALETTE.ink,
    baseline: 'middle',
  });
  drawText(ctx, `${info.bestLabel}: ${info.high}`, w - L.pad, L.pad + L.hud * 0.5, {
    size: Math.round(L.hud * 0.42),
    color: PALETTE.inkDim,
    align: 'right',
    baseline: 'middle',
  });
  // lives as hearts
  const heartSize = Math.round(L.hud * 0.34);
  const livesText = `${info.livesLabel}: ${'♥'.repeat(state.lives)}${'·'.repeat(Math.max(0, 5 - state.lives))}`;
  drawText(ctx, livesText, w / 2, L.pad + L.hud * 0.5, {
    size: heartSize,
    color: PALETTE.bad,
    align: 'center',
    baseline: 'middle',
  });

  // ---- Wheel ----
  drawWheel(ctx, state, L, info);

  // ---- Pointer (fixed, points down into the top of the wheel) ----
  const px = L.wheelCx;
  const py = L.wheelCy - L.wheelR - 2;
  ctx.fillStyle = PALETTE.ink;
  ctx.beginPath();
  ctx.moveTo(px, py + L.wheelR * 0.16);
  ctx.lineTo(px - L.wheelR * 0.09, py - L.wheelR * 0.04);
  ctx.lineTo(px + L.wheelR * 0.09, py - L.wheelR * 0.04);
  ctx.closePath();
  ctx.fill();

  // ---- Masked word ----
  const wordY = L.hud + L.pad + (L.wheelCy - L.wheelR - (L.hud + L.pad)) / 2;
  const masked = state.word
    .split('')
    .map((ch, i) => (state.revealed[i] ? ch : '_'))
    .join(' ');
  drawText(ctx, masked, w / 2, Math.max(L.hud + L.pad + 12, wordY), {
    size: Math.min(Math.round(w * 0.085), Math.round(L.hud * 0.9)),
    color: ACCENT,
    align: 'center',
    baseline: 'middle',
  });

  // ---- Spin button ----
  const canSpin = !state.awaitingGuess && !info.spinning && !state.won && !state.lost;
  const btn = L.spinButton;
  fillRoundRect(ctx, btn.x, btn.y, btn.w, btn.h, btn.h * 0.3, canSpin ? ACCENT : PALETTE.panel);
  const spinTxt = info.spinning
    ? info.spinValueLabel
    : state.awaitingGuess
      ? `${info.spinValueLabel}: ${state.currentSpinValue}`
      : info.spinLabel;
  drawText(ctx, spinTxt, btn.x + btn.w / 2, btn.y + btn.h / 2, {
    size: Math.round(btn.h * 0.42),
    color: canSpin ? '#1a1003' : PALETTE.ink,
    align: 'center',
    baseline: 'middle',
  });

  // ---- Alphabet ----
  const keyFont = Math.round(L.keys.length ? L.keys[0].rect.h * 0.5 : 16);
  for (const { letter, rect } of L.keys) {
    const used = state.guessed.has(letter);
    const enabled = state.awaitingGuess && !used && !info.spinning && !state.won && !state.lost;
    const bg = used ? PALETTE.board : enabled ? PALETTE.primary : PALETTE.panel;
    fillRoundRect(ctx, rect.x, rect.y, rect.w, rect.h, rect.h * 0.22, bg);
    drawText(ctx, letter, rect.x + rect.w / 2, rect.y + rect.h / 2, {
      size: keyFont,
      color: used ? PALETTE.inkDim : PALETTE.ink,
      align: 'center',
      baseline: 'middle',
    });
  }

  // ---- Win / Lose overlay ----
  if (state.won || state.lost) {
    ctx.fillStyle = 'rgba(8,4,20,0.66)';
    ctx.fillRect(0, 0, w, h);
    drawText(ctx, state.won ? info.winLabel : info.loseLabel, w / 2, h / 2 - L.hud * 0.4, {
      size: Math.round(Math.min(w, h) * 0.1),
      color: state.won ? PALETTE.good : PALETTE.bad,
      align: 'center',
      baseline: 'middle',
    });
    drawText(ctx, `${info.wordLabel}: ${state.word}`, w / 2, h / 2 + L.hud * 0.5, {
      size: Math.round(Math.min(w, h) * 0.05),
      color: PALETTE.ink,
      align: 'center',
      baseline: 'middle',
    });
    drawText(ctx, `${info.scoreLabel}: ${state.roundScore}`, w / 2, h / 2 + L.hud * 1.3, {
      size: Math.round(Math.min(w, h) * 0.045),
      color: PALETTE.inkDim,
      align: 'center',
      baseline: 'middle',
    });
  }
}

function drawWheel(
  ctx: CanvasRenderingContext2D,
  state: WheelState,
  L: Layout,
  info: RenderInfo,
): void {
  const { wheelCx: cx, wheelCy: cy, wheelR: r } = L;
  const n = state.segments.length;
  const slice = (Math.PI * 2) / n;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(info.angle);

  for (let i = 0; i < n; i++) {
    const a0 = i * slice;
    const a1 = a0 + slice;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, a0, a1);
    ctx.closePath();
    ctx.fillStyle = segmentColor(state.segments[i], i);
    ctx.fill();
    ctx.strokeStyle = 'rgba(8,4,20,0.55)';
    ctx.lineWidth = Math.max(1, r * 0.012);
    ctx.stroke();

    // label
    const mid = a0 + slice / 2;
    ctx.save();
    ctx.rotate(mid);
    ctx.translate(r * 0.62, 0);
    ctx.rotate(Math.PI / 2);
    drawText(ctx, segmentLabel(state.segments[i]), 0, 0, {
      size: Math.max(9, Math.round(r * 0.14)),
      color: state.segments[i] === 'BANKRUPT' ? ACCENT : '#0b0617',
      align: 'center',
      baseline: 'middle',
    });
    ctx.restore();
  }
  ctx.restore();

  // hub
  ctx.fillStyle = PALETTE.ink;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ACCENT;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.05, 0, Math.PI * 2);
  ctx.fill();

  // rim
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = Math.max(2, r * 0.03);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
}

export { ALPHABET };
