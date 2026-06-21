import type { Storage } from './types';

/** localStorage wrapper namespaced per game (`jz:<namespace>:<key>`), JSON-safe
 * and resilient to private-mode / disabled-storage errors. */
export function createStorage(namespace: string): Storage {
  const prefix = `jz:${namespace}:`;
  return {
    get<T>(key: string, fallback: T): T {
      try {
        const raw = localStorage.getItem(prefix + key);
        if (raw == null) return fallback;
        return JSON.parse(raw) as T;
      } catch {
        return fallback;
      }
    },
    set<T>(key: string, value: T): void {
      try {
        localStorage.setItem(prefix + key, JSON.stringify(value));
      } catch {
        /* storage unavailable */
      }
    },
    remove(key: string): void {
      try {
        localStorage.removeItem(prefix + key);
      } catch {
        /* storage unavailable */
      }
    },
  };
}
