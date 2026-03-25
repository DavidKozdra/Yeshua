import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const distDir = resolve(fileURLToPath(new URL('./dist', import.meta.url)));
const indexFile = resolve(distDir, 'index.html');
const host = '0.0.0.0';
const port = Number(process.env.PORT || 8080);

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

createServer((request, response) => {
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

  createReadStream(filePath).pipe(response);
}).listen(port, host, () => {
  console.log(`Yeshua listening on http://${host}:${port}`);
});
