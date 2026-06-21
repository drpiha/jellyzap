import { getCollection, type CollectionEntry } from 'astro:content';
import type { Locale } from '../i18n';
import type { CategoryId } from './categories';

export type GameEntry = CollectionEntry<'games'>;

/** Pick the value for the active locale (falls back to English). */
export function L<T>(field: Record<Locale, T>, locale: Locale): T {
  return field[locale] ?? field.en;
}

export async function getGames(): Promise<GameEntry[]> {
  const all = await getCollection('games');
  return all.sort((a, b) => a.data.order - b.data.order);
}

export async function getPlayableGames(): Promise<GameEntry[]> {
  return (await getGames()).filter((g) => g.data.playable);
}

export async function getGame(slug: string): Promise<GameEntry | undefined> {
  return (await getGames()).find((g) => g.data.slug === slug);
}

export async function getGamesByCategory(category: CategoryId): Promise<GameEntry[]> {
  return (await getGames()).filter((g) => g.data.category === category);
}

/** Related games: same category first, then fill from others. */
export async function getRelated(slug: string, category: string, n = 6): Promise<GameEntry[]> {
  const games = await getGames();
  const same = games.filter((g) => g.data.category === category && g.data.slug !== slug);
  const others = games.filter((g) => g.data.category !== category && g.data.slug !== slug);
  return [...same, ...others].slice(0, n);
}
