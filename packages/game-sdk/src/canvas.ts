export interface CanvasSetup {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** re-measure the mount, resize the backing store for the current DPR, and
   * pre-scale the context so the game draws in logical (CSS) pixels. */
  resize(): { width: number; height: number; dpr: number };
}

export function setupCanvas(mount: HTMLElement): CanvasSetup {
  const canvas = document.createElement('canvas');
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.touchAction = 'none';
  // focusable so the game can capture keyboard input without hijacking the whole
  // page; no focus ring since the canvas is the interaction surface itself.
  canvas.tabIndex = 0;
  canvas.style.outline = 'none';
  mount.appendChild(canvas);

  const maybeCtx = canvas.getContext('2d', { alpha: false });
  if (!maybeCtx) throw new Error('[jellyzap] 2D canvas context is unavailable');
  const ctx: CanvasRenderingContext2D = maybeCtx;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const rect = mount.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { width, height, dpr };
  }

  return { canvas, ctx, resize };
}
