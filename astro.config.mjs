// @ts-check
import preact from '@astrojs/preact';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

// Set SITE_URL (e.g. https://example.com) and BASE_PATH (e.g. /skip-budget) at build time.
const site = process.env.SITE_URL ?? 'https://kwan-li.github.io';
const base = process.env.BASE_PATH ?? '/skip-budget';

export default defineConfig({
  site,
  base,
  trailingSlash: 'always',
  integrations: [preact(), sitemap()],
  build: { format: 'directory' },
});
