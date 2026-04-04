import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import {
  getSeoState,
  getStaticSitemapEntries,
  renderSeoHtml,
} from '../src/utils/seo.js';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DIST_DIR = resolve(ROOT, 'dist');
const INDEX_PATH = resolve(DIST_DIR, 'index.html');
const LASTMOD = new Date().toISOString().slice(0, 10);

function buildSitemap(entries) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];

  for (const entry of entries) {
    lines.push('  <url>');
    lines.push(`    <loc>https://readyeshua.com${entry.path}</loc>`);
    if (entry.lastmod) {
      lines.push(`    <lastmod>${entry.lastmod}</lastmod>`);
    }
    if (entry.changefreq) {
      lines.push(`    <changefreq>${entry.changefreq}</changefreq>`);
    }
    if (entry.priority) {
      lines.push(`    <priority>${entry.priority}</priority>`);
    }
    lines.push('  </url>');
  }

  lines.push('</urlset>');
  return `${lines.join('\n')}\n`;
}

async function main() {
  const template = await readFile(INDEX_PATH, 'utf8');
  const staticEntries = getStaticSitemapEntries(LASTMOD);

  for (const entry of staticEntries) {
    if (!['/', '/read', '/translations', '/books', '/search', '/notes', '/settings'].includes(entry.path)) {
      continue;
    }

    const seo = getSeoState({ pathname: entry.path, search: '' });
    const html = renderSeoHtml(template, seo);

    if (entry.path === '/') {
      await writeFile(INDEX_PATH, html);
      continue;
    }

    const routeDir = resolve(DIST_DIR, `.${entry.path}`);
    await mkdir(routeDir, { recursive: true });
    await writeFile(resolve(routeDir, 'index.html'), html);
  }

  await writeFile(resolve(DIST_DIR, 'sitemap.xml'), buildSitemap(staticEntries));
}

await main();
