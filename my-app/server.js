// server.js – Custom Next.js server with Socket.IO for LAN WebSocket support
// Run:
//   Development: NODE_ENV=development node server.js
//   Production : NODE_ENV=production  node server.js
// Binds to 0.0.0.0 so all LAN devices can connect.

// Ensure NODE_ENV is set properly (trim whitespace from Windows cmd)
if (!process.env.NODE_ENV || process.env.NODE_ENV.trim() === '') {
  process.env.NODE_ENV = 'development';
} else {
  process.env.NODE_ENV = process.env.NODE_ENV.trim();
}

const { createServer } = require('http');
const { parse } = require('url');
const path = require('path');
const next = require('next');
const { Server } = require('socket.io');
const mdns = require('mdns-js');
const os = require('os');
const { getLicenseStore } = require('./lib/license/state.js');
const { classifyRequest, isLocalAddress, SETUP_PAGE_HTML } = require('./lib/license/gate.js');
const { startScheduler: startBackupScheduler } = require('./lib/auto-backup.js');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);
const redirectPort = 80;
// Ensure dir is always a valid path - resolve to absolute path
const dir = process.env.APP_DIR && process.env.APP_DIR.trim() ? path.resolve(process.env.APP_DIR) : path.resolve(__dirname);

console.log(`[Server] Starting in ${process.env.NODE_ENV} mode, dir: ${dir}`);

function isAllowedSocketOrigin(origin) {
  if (!origin) return true;

  try {
    const { hostname: originHostname } = new URL(origin);
    if (
      originHostname === 'localhost' ||
      originHostname === '127.0.0.1' ||
      originHostname.endsWith('.local')
    ) {
      return true;
    }

    return Object.values(os.networkInterfaces())
      .flat()
      .some((networkInterface) =>
        networkInterface &&
        networkInterface.family === 'IPv4' &&
        !networkInterface.internal &&
        networkInterface.address === originHostname
      );
  } catch {
    return false;
  }
}

const app = next({ dev, hostname, port, dir, turbopack: false });
const handle = app.getRequestHandler();

function startRedirectServer() {
  const redirectServer = createServer((req, res) => {
    const requestUrl = req.url || '/';
    const target = `http://127.0.0.1:${port}${requestUrl}`;
    res.statusCode = 302;
    res.setHeader('Location', target);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end(`Redirecting to ${target}`);
  });

  redirectServer.on('error', (err) => {
    if (err && err.code === 'EACCES') {
      console.warn(`[Server] Port ${redirectPort} is protected on this machine. Use http://<ip>:${port} or http://smartcafeos.local:${port}`);
      return;
    }
    console.warn('[Server] Redirect server warning:', err.message);
  });

  redirectServer.listen(redirectPort, hostname, () => {
    console.log(`[Server] Bare IP redirect enabled on http://0.0.0.0:${redirectPort} -> http://0.0.0.0:${port}`);
  });
}

app.prepare().then(() => {
  // ── License (spec 015, constitution VIII): fail closed until activated ────
  const license = getLicenseStore();
  const initial = license.refresh();
  console.log(
    initial.state === 'active'
      ? `[License] Active — license #${initial.licenseNo}`
      : `[License] NOT ACTIVATED (${initial.reason || initial.state}) — open http://localhost:${port}/activate on this PC`
  );

  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);

      // Only server.js may assert that a request came from this PC.
      const local = isLocalAddress(req.socket.remoteAddress);
      delete req.headers['x-pebot-local'];
      if (local) req.headers['x-pebot-local'] = '1';

      // Nothing sits in front of this server, so the socket address is the client.
      // Never trust a forwarded header a client sent: rate limits key on it.
      const remote = String(req.socket.remoteAddress || 'unknown').replace(/^::ffff:/, '');
      req.headers['x-forwarded-for'] = remote;
      req.headers['x-real-ip'] = remote;

      const decision = classifyRequest({
        method: req.method,
        pathname: parsedUrl.pathname || '/',
        local,
        licensed: license.isActive(),
      });
      if (decision.action === 'redirect') {
        res.statusCode = 302;
        res.setHeader('Location', decision.location);
        res.end();
        return;
      }
      if (decision.action === 'json') {
        res.statusCode = decision.status;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: decision.error }));
        return;
      }
      if (decision.action === 'setup-page') {
        res.statusCode = 503;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.end(SETUP_PAGE_HTML);
        return;
      }

      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  // ── Socket.IO ──────────────────────────────────────────────────────────────
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (isAllowedSocketOrigin(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Origin not allowed'));
        }
      },
      methods: ['GET', 'POST'],
    },
    path: '/api/socket',
    // Unlicensed: refuse the transport handshake itself (constitution II, VIII).
    allowRequest: (req, callback) => callback(null, license.isActive()),
  });

  // Realtime gets the same license check as HTTP (constitution II, VIII).
  io.use((socket, nextFn) => {
    if (license.isActive()) return nextFn();
    return nextFn(new Error('LICENSE_REQUIRED'));
  });

  // Attach io to global so API routes can access it
  global.io = io;

  io.on('connection', (socket) => {
    console.log(`[WS] Client connected: ${socket.id}`);

    // Rooms: join by role/page
    socket.on('join-room', (room) => {
      socket.join(room);
      console.log(`[WS] ${socket.id} joined room: ${room}`);
    });

    // Client can manually emit (fallback)
    socket.on('order-status-update', (data) => {
      io.emit('order-status-update', data);
    });

    socket.on('disconnect', () => {
      console.log(`[WS] Client disconnected: ${socket.id}`);
    });
  });

  httpServer
    .once('error', (err) => { console.error(err); process.exit(1); })
    .listen(port, hostname, () => {
      // Spec 022: daily automatic backup of the database.
      startBackupScheduler();
      const interfaces = os.networkInterfaces();
      const lanIp = Object.values(interfaces)
        .flat()
        .find((i) => i && i.family === 'IPv4' && !i.internal)?.address ?? 'unknown';

      // ── Register mDNS (Bonjour) Service ────────────────────────────────────
      const mdnsService = mdns.createAdvertisement(mdns.tcp('http'), port, {
        name: 'SMART CafeOS',
        host: os.hostname(),
        txtRecord: {
          path: '/',
          admin: '/admin',
          kitchen: '/kitchen',
          service: 'cafeos-pos',
        }
      });

      mdnsService.start();
      console.log(`[mDNS] Service registered as "SMART CafeOS" on ${os.hostname()}.local`);

      console.log('\n==================================================');
      console.log('            Pebot - LAN POS System               ');
      console.log('==================================================');
      console.log(`  Local:       http://localhost:${port}`);
      console.log(`  LAN IP:      http://${lanIp}:${port}`);
      console.log(`  📱 Hostname: http://smartcafeos.local:${port}  (Easiest!)`);
      console.log(`  Admin:       http://smartcafeos.local:${port}/admin`);
      console.log(`  Kitchen:     http://smartcafeos.local:${port}/kitchen`);
      console.log('  Use hostname for QR codes & other devices');
      console.log(`  Bare IP:     http://${lanIp}  -> redirects to http://${lanIp}:${port}`);
      console.log('');

      if (port !== redirectPort) {
        startRedirectServer();
      }

      // Graceful shutdown
      process.on('SIGINT', () => {
        console.log('\n[Server] Shutting down...');
        mdnsService.stop();
        httpServer.close();
        process.exit(0);
      });
    });
}).catch((err) => {
  console.error('Fatal error during Next.js preparation:', err);
  console.error('Full stack:', err.stack);
  process.exit(1);
});

// Prevent process from exiting unexpectedly
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});
