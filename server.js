import { createReadStream, existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSeoState, renderSeoHtml } from './src/utils/seo.js';

const distDir = resolve(fileURLToPath(new URL('./dist', import.meta.url)));
const indexFile = resolve(distDir, 'index.html');
const host = '0.0.0.0';
const port = Number(process.env.PORT || 8080);
const htmlTemplateCache = new Map();

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.woff2': 'font/woff2',
};

const securityHeaders = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https:",
    "font-src 'self' https://fonts.gstatic.com data:",
    "connect-src 'self' https://raw.githubusercontent.com",
    "manifest-src 'self'",
    "worker-src 'self'",
    'upgrade-insecure-requests',
  ].join('; '),
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

function resolveRequestPath(url) {
  const pathname = new URL(url, `http://${host}:${port}`).pathname;
  const candidate = resolve(distDir, `.${pathname}`);

  if (!candidate.startsWith(distDir)) {
    return null;
  }

  if (existsSync(candidate) && statSync(candidate).isFile()) {
    return candidate;
  }

  if (existsSync(candidate) && statSync(candidate).isDirectory()) {
    const directoryIndex = resolve(candidate, 'index.html');

    if (directoryIndex.startsWith(distDir) && existsSync(directoryIndex)) {
      return directoryIndex;
    }
  }

  if (extname(pathname)) {
    return null;
  }

  return indexFile;
}

async function getHtmlTemplate(filePath) {
  if (!htmlTemplateCache.has(filePath)) {
    htmlTemplateCache.set(filePath, await readFile(filePath, 'utf8'));
  }

  return htmlTemplateCache.get(filePath);
}

function getRequestOrigin(request) {
  const forwardedProto = request.headers['x-forwarded-proto'];
  const forwardedHost = request.headers['x-forwarded-host'];
  const protocol =
    typeof forwardedProto === 'string' && forwardedProto.trim()
      ? forwardedProto.split(',')[0].trim()
      : request.socket.encrypted
        ? 'https'
        : 'http';
  const requestHost =
    typeof forwardedHost === 'string' && forwardedHost.trim()
      ? forwardedHost.split(',')[0].trim()
      : request.headers.host || `${host}:${port}`;

  return `${protocol}://${requestHost}`;
}

createServer(async (request, response) => {
  const filePath = resolveRequestPath(request.url || '/');

  if (!filePath) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  const extension = extname(filePath);
  const contentType = contentTypes[extension] || 'application/octet-stream';
  const isHashed = /\.[a-f0-9]{8,}\.(js|css)$/.test(filePath);
  const cacheControl =
    isHashed || extension === '.woff2'
      ? 'public, max-age=31536000, immutable'
      : extension === '.html' || filePath === indexFile
        ? 'no-cache'
        : 'public, max-age=3600';

  response.writeHead(200, {
    ...securityHeaders,
    'Content-Type': contentType,
    'Cache-Control': cacheControl,
  });

  if (request.method === 'HEAD') {
    response.end();
    return;
  }

  if (extension === '.html') {
    const requestUrl = new URL(request.url || '/', getRequestOrigin(request));
    const seo = getSeoState({
      pathname: requestUrl.pathname,
      search: requestUrl.search,
    });
    const template = await getHtmlTemplate(filePath);
    response.end(renderSeoHtml(template, seo));
    return;
  }

  createReadStream(filePath).pipe(response);
}).listen(port, host, () => {
  console.log(`Yeshua listening on http://${host}:${port}`);
});
