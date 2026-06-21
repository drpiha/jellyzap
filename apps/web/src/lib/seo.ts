import { locales, localizePath, type Locale } from '../i18n';

export interface Alternate {
  hreflang: string;
  href: string;
}

/** Absolute hreflang alternates (one per locale + x-default) for a locale-less path. */
export function alternates(site: string, path: string): Alternate[] {
  const list: Alternate[] = locales.map((l) => ({
    hreflang: l,
    href: new URL(localizePath(l, path), site).href,
  }));
  list.push({ hreflang: 'x-default', href: new URL(localizePath('en', path), site).href });
  return list;
}

export function canonical(site: string, locale: Locale, path: string): string {
  return new URL(localizePath(locale, path), site).href;
}

export function abs(site: string, path: string): string {
  return new URL(path, site).href;
}
