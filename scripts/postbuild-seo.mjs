import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import {
  DEFAULT_IMAGE,
  buildBreadcrumbList,
  buildOrganizationSchema,
  buildWebsiteSchema,
  getSeoState,
  getStaticSitemapEntries,
} from '../src/utils/seo.js';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DIST_DIR = resolve(ROOT, 'dist');
const INDEX_PATH = resolve(DIST_DIR, 'index.html');
const LASTMOD = new Date().toISOString().slice(0, 10);

function replaceTag(html, pattern, replacement) {
  return pattern.test(html) ? html.replace(pattern, replacement) : html;
}

function upsertMeta(html, selectorPattern, replacement) {
  return replaceTag(html, selectorPattern, replacement);
}

function renderJsonLdScript(id, payload) {
  return `<script id="${id}" type="application/ld+json">${JSON.stringify(payload)}</script>`;
}

function buildRouteHtml(template, seo) {
  let html = template;

  html = replaceTag(html, /<title>.*?<\/title>/s, `<title>${seo.title}</title>`);
  html = upsertMeta(
    html,
    /<meta\s+name="description"[\s\S]*?\/>/,
    `<meta name="description" content="${seo.description}" />`
  );
  html = upsertMeta(
    html,
    /<link rel="canonical" href="[^"]*"\s*\/>/,
    `<link rel="canonical" href="${seo.canonicalUrl}" />`
  );
  html = upsertMeta(
    html,
    /<meta\s+property="og:title"[\s\S]*?\/>/,
    `<meta property="og:title" content="${seo.title}" />`
  );
  html = upsertMeta(
    html,
    /<meta\s+property="og:description"[\s\S]*?\/>/,
    `<meta property="og:description" content="${seo.description}" />`
  );
  html = upsertMeta(
    html,
    /<meta\s+property="og:url"[\s\S]*?\/>/,
    `<meta property="og:url" content="${seo.canonicalUrl}" />`
  );
  html = upsertMeta(
    html,
    /<meta\s+property="og:image"[\s\S]*?\/>/,
    `<meta property="og:image" content="${DEFAULT_IMAGE}" />`
  );
  html = upsertMeta(
    html,
    /<meta\s+name="twitter:title"[\s\S]*?\/>/,
    `<meta name="twitter:title" content="${seo.title}" />`
  );
  html = upsertMeta(
    html,
    /<meta\s+name="twitter:description"[\s\S]*?\/>/,
    `<meta name="twitter:description" content="${seo.description}" />`
  );
  html = upsertMeta(
    html,
    /<meta\s+name="twitter:image"[\s\S]*?\/>/,
    `<meta name="twitter:image" content="${DEFAULT_IMAGE}" />`
  );

  html = replaceTag(
    html,
    /<script id="seo-website-jsonld" type="application\/ld\+json">.*?<\/script>/s,
    renderJsonLdScript('seo-website-jsonld', buildWebsiteSchema())
  );
  html = replaceTag(
    html,
    /<script id="seo-organization-jsonld" type="application\/ld\+json">.*?<\/script>/s,
    renderJsonLdScript('seo-organization-jsonld', buildOrganizationSchema())
  );
  html = replaceTag(
    html,
    /<script id="seo-breadcrumb-jsonld" type="application\/ld\+json">.*?<\/script>/s,
    renderJsonLdScript('seo-breadcrumb-jsonld', buildBreadcrumbList(seo.breadcrumbs))
  );

  return html;
}

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
    const html = buildRouteHtml(template, seo);

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
