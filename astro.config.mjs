// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from './src/integrations/sitemap.mjs';

export default defineConfig({
  site: 'https://plyndi.com',
  // Keep the exact URLs the site already has: about.astro -> /about.html,
  // services/index.astro -> /services/index.html (served at /services/).
  build: { format: 'preserve', inlineStylesheets: 'never' },
  trailingSlash: 'ignore',
  integrations: [sitemap()],
});
