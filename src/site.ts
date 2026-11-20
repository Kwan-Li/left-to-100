/** Brand and links in one place so the name can change without touching pages. */
export const SITE = {
  name: 'Skip Budget',
  tagline: 'GTA 6 100% completion calculator',
  repo: 'https://github.com/Kwan-Li/skip-budget',
  disclaimer:
    'Unofficial fan project. Not affiliated with or endorsed by Rockstar Games or Take-Two Interactive. Grand Theft Auto is a trademark of Take-Two Interactive.',
};

/** Prefix a site-relative path with the configured base path. */
export function href(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
