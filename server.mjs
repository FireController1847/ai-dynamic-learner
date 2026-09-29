import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = await realpath(resolve(dirname(fileURLToPath(import.meta.url)), 'dist')).catch(() => {
  throw new Error('No dist/ directory found. Run npm run build before npm run preview.');
});
const index = await readFile(resolve(root, 'index.html'), 'utf8');
const notFound = await readFile(resolve(root, '404.html'));
const baseMatch = index.match(/<base\s+href=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
const encodedBase = baseMatch?.[1] ?? baseMatch?.[2] ?? baseMatch?.[3];
if (!encodedBase) throw new Error('The built index.html is missing its base path. Run npm run build.');
const basePath = encodedBase.replace(/&(amp|lt|gt|quot|#39);/g, (_, name) => ({
  amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'",
}[name]));
const host = process.env.HOST ?? '127.0.0.1';
const port = Number(process.env.PORT ?? 3000);

if (!Number.isInteger(port) || port < 0 || port > 65535) {
  throw new Error('PORT must be an integer between 0 and 65535.');
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.icns': 'image/icns',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
  '.wasm': 'application/wasm',
};

function isInsideRoot(path) {
  const location = relative(root, path);
  return location !== '..' && !location.startsWith(`..${sep}`) && !isAbsolute(location);
}

const server = createServer(async (request, response) => {
  function reply(status, message) {
    response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(request.method === 'HEAD' ? undefined : message);
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD');
    reply(405, 'Method not allowed');
    return;
  }

  let pathname;
  let requestUrl;
  try {
    requestUrl = new URL(request.url, 'http://localhost');
    pathname = decodeURIComponent(requestUrl.pathname);
    if (pathname.includes('\0')) throw new Error('Invalid path');
  } catch {
    reply(400, 'Bad request');
    return;
  }

  if (basePath !== '/' && pathname === basePath.slice(0, -1)) {
    response.writeHead(308, { Location: `${basePath}${requestUrl.search}` });
    response.end();
    return;
  }

  if (!pathname.startsWith(basePath)) {
    reply(404, 'Not found');
    return;
  }

  const path = resolve(root, pathname.slice(basePath.length));
  if (!isInsideRoot(path)) {
    reply(403, 'Forbidden');
    return;
  }

  try {
    let canonicalPath = await realpath(path);
    if (!isInsideRoot(canonicalPath)) {
      reply(403, 'Forbidden');
      return;
    }

    if ((await stat(canonicalPath)).isDirectory()) {
      canonicalPath = await realpath(resolve(canonicalPath, 'index.html'));
      if (!isInsideRoot(canonicalPath)) {
        reply(403, 'Forbidden');
        return;
      }
      if (!pathname.endsWith('/')) {
        response.writeHead(308, { Location: `${requestUrl.pathname}/${requestUrl.search}` });
        response.end();
        return;
      }
    }

    const content = await readFile(canonicalPath);
    response.writeHead(200, {
      'Content-Type': mimeTypes[extname(canonicalPath).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': content.length,
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch (error) {
    if (['ENOENT', 'ENOTDIR', 'EISDIR'].includes(error.code)) {
      response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(request.method === 'HEAD' ? undefined : notFound);
    } else if (['EACCES', 'EPERM'].includes(error.code)) {
      reply(403, 'Forbidden');
    } else {
      console.error(error);
      reply(500, 'Internal server error');
    }
  }
});

server.listen(port, host, () => {
  const address = server.address();
  const displayHost = host.includes(':') ? `[${host}]` : host;
  console.log(`Build preview: http://${displayHost}:${address.port}${basePath}`);
});
