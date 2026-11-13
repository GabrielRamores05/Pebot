// @ts-check
'use strict';
// The one place that decides what an unlicensed Pebot may serve (spec 015,
// contracts/license-api.md). server.js applies it to every HTTP request before
// Next.js sees it, and to every Socket.IO handshake.

const STATIC_PREFIXES = ['/_next/', '/__nextjs', '/fonts/', '/icons/'];
const STATIC_FILES = new Set(['/favicon.ico', '/manifest.json', '/manifest.webmanifest', '/robots.txt']);
const PUBLIC_LICENSE_API = new Set(['/api/license/status']);
const LOCAL_PAGES = new Set(['/activate']);

/** @param {string | undefined | null} address */
function isLocalAddress(address) {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

/**
 * @typedef {{ action: 'allow' }
 *   | { action: 'redirect', location: string }
 *   | { action: 'json', status: number, error: string }
 *   | { action: 'setup-page' }} GateDecision
 * @param {{ method?: string, pathname: string, local: boolean, licensed: boolean }} req
 * @returns {GateDecision}
 */
function classifyRequest({ method = 'GET', pathname, local, licensed }) {
  let p;
  try {
    p = decodeURIComponent(pathname || '/');
  } catch {
    return { action: 'json', status: 400, error: 'BAD_PATH' };
  }
  // Traversal tricks like /_next/../admin could slip past the prefix allow-list.
  if (p.includes('..') || p.includes('\\') || p.includes('\0')) return { action: 'json', status: 400, error: 'BAD_PATH' };
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  const upper = method.toUpperCase();

  // Licence management API: reads are open, changes only from the main PC.
  if (p === '/api/license' || p.startsWith('/api/license/')) {
    if (PUBLIC_LICENSE_API.has(p)) return { action: 'allow' };
    if (p === '/api/license/agreement' && (upper === 'GET' || upper === 'HEAD')) return { action: 'allow' };
    return local ? { action: 'allow' } : { action: 'json', status: 403, error: 'LOCAL_ONLY' };
  }

  if (STATIC_FILES.has(p) || STATIC_PREFIXES.some((prefix) => p.startsWith(prefix))) return { action: 'allow' };

  if (licensed) {
    if (LOCAL_PAGES.has(p)) return { action: 'redirect', location: '/' };
    return { action: 'allow' };
  }

  if (p === '/legal/agreement' || LOCAL_PAGES.has(p)) return local ? { action: 'allow' } : { action: 'setup-page' };
  if (p === '/api' || p.startsWith('/api/')) return { action: 'json', status: 403, error: 'LICENSE_REQUIRED' };
  return local ? { action: 'redirect', location: '/activate' } : { action: 'setup-page' };
}

/** Plain page for customer phones and LAN devices while the main PC isn't activated. */
const SETUP_PAGE_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pebot</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f3ee;color:#1f1b16;
       font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;padding:24px;box-sizing:border-box}
  main{max-width:420px;text-align:center}
  h1{font-size:22px;margin:0 0 8px}
  p{margin:0;color:#5c544a}
</style></head>
<body><main>
  <h1>This restaurant's system is being set up</h1>
  <p>Please order with a staff member for now. / Paki-order muna sa aming staff.</p>
</main></body></html>`;

module.exports = { isLocalAddress, classifyRequest, SETUP_PAGE_HTML };
