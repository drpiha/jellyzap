export const CATEGORIES = ['arcade', 'puzzle', 'word', 'action'] as const;
export type CategoryId = (typeof CATEGORIES)[number];

export const CATEGORY_ACCENT: Record<CategoryId, string> = {
  arcade: '#22d3ee',
  puzzle: '#a855f7',
  word: '#34d399',
  action: '#ff4d8d',
};

export const CATEGORY_ICON: Record<CategoryId, string> = {
  arcade: '🕹️',
  puzzle: '🧩',
  word: '🔤',
  action: '💥',
};

export function isCategory(value: string): value is CategoryId {
  return (CATEGORIES as readonly string[]).includes(value);
}
