import type { AudioManager, Storage } from './types';

/** In-memory {@link Storage} for unit tests (no localStorage needed). */
export function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get<T>(key: string, fallback: T): T {
      const raw = map.get(key);
      if (raw == null) return fallback;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return fallback;
      }
    },
    set<T>(key: string, value: T): void {
      map.set(key, JSON.stringify(value));
    },
    remove(key: string): void {
      map.delete(key);
    },
  };
}

/** No-op {@link AudioManager} for tests / SSR. */
export function silentAudio(): AudioManager {
  let muted = false;
  let volume = 0.7;
  return {
    registerSfx: () => {},
    play: () => {},
    loadMusic: async () => {},
    playMusic: () => {},
    stopMusic: () => {},
    setMuted: (m) => {
      muted = m;
    },
    isMuted: () => muted,
    setVolume: (v) => {
      volume = v;
    },
    getVolume: () => volume,
    resume: async () => {},
  };
}

/** A controllable clock + frame scheduler for testing the fixed loop. */
export function createManualClock() {
  let t = 0;
  let pending: (() => void) | null = null;
  return {
    now: () => t,
    raf: (cb: () => void) => {
      pending = cb;
      return 1;
    },
    caf: () => {
      pending = null;
    },
    /** advance time by `dt` seconds and run the next scheduled frame */
    tick(dt: number) {
      t += dt;
      const cb = pending;
      pending = null;
      cb?.();
    },
  };
}
