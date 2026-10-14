import { createServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAssistantHandler } from './assistant.mjs';

const root = await realpath(fileURLToPath(new URL('../dist/', import.meta.url))).catch(() => {
  console.error('Build the app first with npm run build.');
  process.exit(1);
});
const portIndex = process.argv.indexOf('--port');
const port = Number(portIndex === -1 ? process.env.PORT || 4173 : process.argv[portIndex + 1]);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('Use a port between 1 and 65535.');
  process.exit(1);
}
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
};
const assistant = createAssistantHandler();
const server = createServer(async (req, res) => {
  if (await assistant(req, res, port)) return;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end();
    return;
  }
  try {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
    if (path.includes('\\') || path.includes('\0')) {
      res.writeHead(400);
      res.end();
      return;
    }
    const candidate = resolve(root, `.${path === '/' ? '/index.html' : path}`);
    if (!candidate.startsWith(root + sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const actual = await realpath(candidate);
    if (!actual.startsWith(root + sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const body = await readFile(actual);
    res.writeHead(200, {
      'Content-Type': mime[extname(actual)] || 'application/octet-stream',
      'Content-Length': body.length,
      'Cache-Control': extname(actual) === '.html' ? 'no-cache' : 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
      'Referrer-Policy': 'no-referrer',
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch (error) {
    res.writeHead(error instanceof URIError ? 400 : 404);
    res.end('Not found');
  }
});
server.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () =>
  console.log(`Lab Bench is ready at http://127.0.0.1:${port}`),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => server.close(() => process.exit(0)));
