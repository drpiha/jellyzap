import en from './en.json';
import tr from './tr.json';
import de from './de.json';

export const locales = ['en', 'tr', 'de'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export const localeNames: Record<Locale, string> = {
  en: 'English',
  tr: 'Türkçe',
  de: 'Deutsch',
};

export const localeFlags: Record<Locale, string> = {
  en: '🇬🇧',
  tr: '🇹🇷',
  de: '🇩🇪',
};

const dicts: Record<Locale, unknown> = { en, tr, de };

export function isLocale(value: string | undefined): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

function lookup(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

export function useTranslations(locale: Locale) {
  return function t(key: string, vars?: Record<string, string | number>): string {
    let raw = lookup(dicts[locale], key);
    if (raw === undefined && locale !== defaultLocale) raw = lookup(dicts[defaultLocale], key);
    if (typeof raw !== 'string') return key;
    let out: string = raw;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
    }
    return out;
  };
}

/**
 * Read every STRING entry of an object group (e.g. all `game.*` labels), merged
 * over the default locale. Used to hand a complete label map to the in-game HUD
 * so games never show raw keys like "game.lives".
 */
export function getStringGroup(locale: Locale, key: string): Record<string, string> {
  const collect = (o: unknown): Record<string, string> => {
    const out: Record<string, string> = {};
    if (o && typeof o === 'object') {
      for (const [k, val] of Object.entries(o as Record<string, unknown>)) {
        if (typeof val === 'string') out[k] = val;
      }
    }
    return out;
  };
  return { ...collect(lookup(dicts[defaultLocale], key)), ...collect(lookup(dicts[locale], key)) };
}

/** Read a localized array (e.g. legal copy split into paragraphs). */
export function getList(locale: Locale, key: string): string[] {
  const value = lookup(dicts[locale], key) ?? lookup(dicts[defaultLocale], key);
  return Array.isArray(value) ? value.map(String) : [];
}

export function localizePath(locale: Locale, path = '/'): string {
  const clean = path === '/' || path === '' ? '' : path.startsWith('/') ? path : `/${path}`;
  return `/${locale}${clean}`;
}

/** Drop the leading /<locale> from a path (for the language switcher). */
export function stripLocale(pathname: string): string {
  const match = pathname.match(/^\/(en|tr|de)(\/.*)?$/);
  return match ? (match[2] ?? '/') : pathname;
}

export function localeStaticPaths() {
  return locales.map((locale) => ({ params: { locale } }));
}
