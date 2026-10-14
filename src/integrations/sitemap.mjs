// Builds /sitemap.xml automatically from every page's <link rel="canonical">.
// Pages marked noindex are skipped. lastmod comes from the page's JSON-LD
// "dateModified" when it has one. New pages appear automatically — no manual edits.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

export default function sitemap() {
  return {
    name: 'plyndi-sitemap',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        const urls = [];
        for (const file of await walk(root)) {
          const html = await readFile(file, 'utf8');
          if (/<meta[^>]+name="robots"[^>]+noindex/i.test(html)) continue;
          const canon = html.match(/<link rel="canonical" href="([^"]+)"/);
          if (!canon) continue;
          const mod = html.match(/"dateModified"\s*:\s*"(\d{4}-\d{2}-\d{2})/);
          urls.push({ loc: canon[1], lastmod: mod?.[1] });
        }
        urls.sort((a, b) => (a.loc === 'https://plyndi.com/' ? -1 : b.loc === 'https://plyndi.com/' ? 1 : a.loc.localeCompare(b.loc)));
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
          urls.map((u) => `  <url>\n    <loc>${u.loc}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ''}\n  </url>`).join('\n') +
          `\n</urlset>\n`;
        await writeFile(join(root, 'sitemap.xml'), xml);
        logger.info(`sitemap.xml: ${urls.length} URLs`);
      },
    },
  };
}
