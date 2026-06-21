import type { Direction, InputEvents, InputState, PointerInfo } from './types';

export interface InputManager {
  readonly state: InputState;
  attach(target: HTMLElement): void;
  detach(): void;
  setHandler(handler: InputEvents | undefined): void;
  /** clear the edge-triggered "just pressed" set; call once per rendered frame */
  endFrame(): void;
  /** feed a virtual on-screen control into the game */
  triggerAction(action: string): void;
}

const SCROLL_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
]);

const TAP_MAX_DIST = 16;
const TAP_MAX_MS = 300;
const SWIPE_MIN_DIST = 24;

export function createInput(): InputManager {
  const keys = new Set<string>();
  const pressed = new Set<string>();
  const pointers = new Map<number, PointerInfo>();
  let handler: InputEvents | undefined;
  let target: HTMLElement | null = null;
  let swipe: { x: number; y: number; t: number; id: number } | null = null;

  const state: InputState = {
    keys,
    pointers,
    justPressed: (code) => pressed.has(code),
  };

  function toLocal(e: PointerEvent): PointerInfo {
    const rect = target?.getBoundingClientRect();
    return {
      x: e.clientX - (rect?.left ?? 0),
      y: e.clientY - (rect?.top ?? 0),
      id: e.pointerId,
    };
  }

  /** Is the game canvas the focused element? Used to scope page-scroll hijacking. */
  function canvasFocused(): boolean {
    return target != null && typeof document !== 'undefined' && document.activeElement === target;
  }

  const onKeyDown = (e: KeyboardEvent) => {
    // Only swallow the page's default scroll/space behaviour while the canvas is
    // focused, so a mounted game never hijacks scrolling or Space-activation of
    // other page controls when the player isn't actually interacting with it.
    if (canvasFocused() && SCROLL_KEYS.has(e.code)) e.preventDefault();
    if (!keys.has(e.code)) pressed.add(e.code);
    keys.add(e.code);
    handler?.onKeyDown?.(e.code, e.key);
  };
  const onKeyUp = (e: KeyboardEvent) => {
    keys.delete(e.code);
    handler?.onKeyUp?.(e.code);
  };
  const onPointerDown = (e: PointerEvent) => {
    // pressing the canvas focuses it so keyboard input is captured (and scoped)
    target?.focus?.({ preventScroll: true });
    const p = toLocal(e);
    pointers.set(p.id, p);
    swipe = { x: p.x, y: p.y, t: performance.now(), id: p.id };
    handler?.onPointerDown?.(p);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return;
    const p = toLocal(e);
    pointers.set(p.id, p);
    handler?.onPointerMove?.(p);
  };
  const onPointerUp = (e: PointerEvent) => {
    // ignore pointers that never started on the canvas (they were never tracked
    // and are not the active swipe) so off-canvas releases don't reach the game
    if (!pointers.has(e.pointerId) && swipe?.id !== e.pointerId) return;
    const p = toLocal(e);
    pointers.delete(e.pointerId);
    handler?.onPointerUp?.(p);
    if (swipe && swipe.id === e.pointerId) {
      const dx = p.x - swipe.x;
      const dy = p.y - swipe.y;
      const dist = Math.hypot(dx, dy);
      const dt = performance.now() - swipe.t;
      if (dist < TAP_MAX_DIST && dt < TAP_MAX_MS) {
        handler?.onTap?.(p);
      } else if (dist >= SWIPE_MIN_DIST) {
        const dir: Direction =
          Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
        handler?.onSwipe?.(dir);
      }
      swipe = null;
    }
  };

  return {
    state,
    attach(t) {
      target = t;
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      t.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    },
    detach() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      target?.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      target = null;
      keys.clear();
      pressed.clear();
      pointers.clear();
    },
    setHandler(h) {
      handler = h;
    },
    endFrame() {
      pressed.clear();
    },
    triggerAction(action) {
      handler?.onAction?.(action);
    },
  };
}
