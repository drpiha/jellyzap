import { PALETTE, drawText, fillRoundRect, paintBackground } from '@jellyzap/game-sdk';
import {
  MAX_GUESSES,
  WORD_LENGTH,
  type LetterStatus,
  type WordLocale,
  type WordState,
} from './logic';

export const ACCENT = '#34d399';

export interface RenderInfo {
  titleLabel: string;
  /** transient message text already localized (empty for none) */
  message: string;
  winLabel: string;
  loseLabel: string;
  /** the answer to reveal on the lose overlay */
  answerLabel: string;
}

/** A hit-testable rectangle for an on-screen key. */
export interface KeyRect {
  /** logical key: a single letter, or 'ENTER' / 'DEL' */
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Per-locale keyboard rows (letters are UPPERCASE). 'ENTER'/'DEL' are special. */
export const KEYBOARD_ROWS: Record<WordLocale, readonly (readonly string[])[]> = {
  en: [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'DEL'],
  ],
  tr: [
    ['E', 'R', 'T', 'Y', 'U', 'I', 'İ', 'O', 'P', 'Ğ', 'Ü'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ş'],
    ['ENTER', 'Z', 'C', 'V', 'B', 'N', 'M', 'Ö', 'Ç', 'DEL'],
  ],
  de: [
    ['Q', 'W', 'E', 'R', 'T', 'Z', 'U', 'I', 'O', 'P', 'Ü'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ö', 'Ä'],
    ['ENTER', 'Y', 'X', 'C', 'V', 'B', 'N', 'M', 'DEL'],
  ],
};

interface Layout {
  grid: { ox: number; oy: number; cell: number; gap: number };
  keys: KeyRect[];
  msgY: number;
  titleY: number;
}

/** Compute the deterministic layout for the current canvas size. */
export function computeLayout(w: number, h: number, locale: WordLocale): Layout {
  const pad = Math.round(Math.min(w, h) * 0.04);
  const titleH = Math.round(Math.min(w, h) * 0.08);

  // Reserve roughly the bottom third for the keyboard.
  const kbH = Math.round(h * 0.26);
  const msgH = Math.round(Math.min(w, h) * 0.06);

  const gridTop = pad + titleH;
  const gridBottom = h - kbH - msgH - pad;
  const availH = Math.max(10, gridBottom - gridTop);
  const availW = w - pad * 2;

  const gap = Math.max(3, Math.round(Math.min(w, h) * 0.012));
  const cellByW = (availW - gap * (WORD_LENGTH - 1)) / WORD_LENGTH;
  const cellByH = (availH - gap * (MAX_GUESSES - 1)) / MAX_GUESSES;
  const cell = Math.max(8, Math.floor(Math.min(cellByW, cellByH)));

  const boardW = cell * WORD_LENGTH + gap * (WORD_LENGTH - 1);
  const boardH = cell * MAX_GUESSES + gap * (MAX_GUESSES - 1);
  const ox = Math.floor((w - boardW) / 2);
  const oy = Math.floor(gridTop + (availH - boardH) / 2);

  const msgY = gridBottom + msgH * 0.6;

  // Keyboard layout.
  const rows = KEYBOARD_ROWS[locale] ?? KEYBOARD_ROWS.en;
  const kbTop = h - kbH;
  const rowGap = Math.max(3, Math.round(kbH * 0.04));
  const keyH = Math.floor((kbH - rowGap * (rows.length + 1)) / rows.length);
  const keyGap = Math.max(2, Math.round(w * 0.006));
  const keys: KeyRect[] = [];

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    // Special keys are ~1.6× wide.
    const units = row.reduce((sum, k) => sum + (k === 'ENTER' || k === 'DEL' ? 1.6 : 1), 0);
    const totalGap = keyGap * (row.length - 1);
    const unitW = (w - pad * 2 - totalGap) / units;
    let x = pad;
    const y = kbTop + rowGap + r * (keyH + rowGap);
    for (const k of row) {
      const kw = unitW * (k === 'ENTER' || k === 'DEL' ? 1.6 : 1);
      keys.push({ key: k, x, y, w: kw, h: keyH });
      x += kw + keyGap;
    }
  }

  return { grid: { ox, oy, cell, gap }, keys, msgY, titleY: pad + titleH * 0.5 };
}

const STATUS_FILL: Record<LetterStatus, string> = {
  correct: ACCENT,
  present: PALETTE.warn,
  absent: '#3a2c55',
};

export function draw(
  ctx: CanvasRenderingContext2D,
  state: WordState,
  w: number,
  h: number,
  info: RenderInfo,
): void {
  paintBackground(ctx, w, h);
  const { grid, keys, msgY, titleY } = computeLayout(w, h, state.locale);
  const { ox, oy, cell, gap } = grid;

  // Title.
  drawText(ctx, info.titleLabel, w / 2, titleY, {
    size: Math.round(Math.min(w, h) * 0.05),
    color: PALETTE.ink,
    align: 'center',
    baseline: 'middle',
  });

  // Grid of tiles.
  const radius = Math.max(4, cell * 0.16);
  for (let row = 0; row < MAX_GUESSES; row++) {
    const guess = row < state.guesses.length ? Array.from(state.guesses[row]) : null;
    const statuses = row < state.statuses.length ? state.statuses[row] : null;
    const isCurrentRow = row === state.guesses.length && state.status === 'playing';
    const typed = isCurrentRow ? Array.from(state.current) : null;

    for (let col = 0; col < WORD_LENGTH; col++) {
      const x = ox + col * (cell + gap);
      const y = oy + row * (cell + gap);

      let fill: string = PALETTE.board;
      let letter = '';
      let borderless = false;
      if (statuses && guess) {
        fill = STATUS_FILL[statuses[col]];
        letter = guess[col] ?? '';
        borderless = true;
      } else if (typed) {
        letter = typed[col] ?? '';
      }

      fillRoundRect(ctx, x, y, cell, cell, radius, fill);
      if (!borderless) {
        ctx.strokeStyle = letter ? PALETTE.inkDim : PALETTE.grid;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x + 1, y + 1, cell - 2, cell - 2, radius);
        ctx.stroke();
      }
      if (letter) {
        drawText(ctx, letter, x + cell / 2, y + cell / 2, {
          size: Math.round(cell * 0.5),
          color: PALETTE.ink,
          align: 'center',
          baseline: 'middle',
          weight: 800,
        });
      }
    }
  }

  // Message line.
  if (info.message) {
    drawText(ctx, info.message, w / 2, msgY, {
      size: Math.round(Math.min(w, h) * 0.035),
      color: PALETTE.warn,
      align: 'center',
      baseline: 'middle',
    });
  }

  // On-screen keyboard.
  for (const k of keys) {
    let fill: string = PALETTE.panel;
    if (k.key !== 'ENTER' && k.key !== 'DEL') {
      const st = state.keyStatus[k.key];
      if (st) fill = STATUS_FILL[st];
    } else {
      fill = PALETTE.primaryDark;
    }
    fillRoundRect(ctx, k.x, k.y, k.w, k.h, Math.max(3, k.h * 0.18), fill);
    const label = k.key === 'ENTER' ? '⏎' : k.key === 'DEL' ? '⌫' : k.key;
    drawText(ctx, label, k.x + k.w / 2, k.y + k.h / 2, {
      size: Math.round(k.h * (k.key.length > 1 ? 0.42 : 0.46)),
      color: PALETTE.ink,
      align: 'center',
      baseline: 'middle',
      weight: 700,
    });
  }

  // Win / lose overlay.
  if (state.status !== 'playing') {
    ctx.fillStyle = 'rgba(8,4,20,0.66)';
    ctx.fillRect(0, 0, w, h);
    const big = Math.round(Math.min(w, h) * 0.1);
    drawText(ctx, state.status === 'won' ? info.winLabel : info.loseLabel, w / 2, h / 2 - big * 0.4, {
      size: big,
      color: state.status === 'won' ? ACCENT : PALETTE.bad,
      align: 'center',
      baseline: 'middle',
      weight: 800,
    });
    drawText(ctx, info.answerLabel, w / 2, h / 2 + big * 0.6, {
      size: Math.round(big * 0.5),
      color: PALETTE.ink,
      align: 'center',
      baseline: 'middle',
    });
  }
}
