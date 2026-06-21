import type { Game } from '@jellyzap/game-sdk';

/**
 * Maps a game slug to a lazy loader for its module. Each entry is a dynamic
 * import so every game becomes its own JS chunk, loaded only when played.
 *
 * Add a line here when a game package gains a real `src/index.ts`.
 */
type Loader = () => Promise<Game>;

export const GAME_LOADERS: Record<string, Loader> = {
  snake: () => import('@jellyzap/game-snake').then((m) => m.default()),
  tetris: () => import('@jellyzap/game-tetris').then((m) => m.default()),
  '2048': () => import('@jellyzap/game-2048').then((m) => m.default()),
  match3: () => import('@jellyzap/game-match3').then((m) => m.default()),
  memory: () => import('@jellyzap/game-memory').then((m) => m.default()),
  word: () => import('@jellyzap/game-word').then((m) => m.default()),
  wheel: () => import('@jellyzap/game-wheel').then((m) => m.default()),
  flappy: () => import('@jellyzap/game-flappy').then((m) => m.default()),
  breakout: () => import('@jellyzap/game-breakout').then((m) => m.default()),
  karts: () => import('@jellyzap/game-karts').then((m) => m.default()),
};

export function hasGame(slug: string): boolean {
  return slug in GAME_LOADERS;
}

export async function loadGame(slug: string): Promise<Game | null> {
  const loader = GAME_LOADERS[slug];
  return loader ? loader() : null;
}
