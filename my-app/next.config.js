const path = require('path');
const projectRoot = path.resolve(__dirname);

const getAllowedOrigins = () => {
  const os = require('os');
  const origins = ['localhost', '127.0.0.1'];
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    if (!iface) continue;
    for (const alias of iface) {
      if (alias.family === 'IPv4' && !alias.internal) {
        origins.push(alias.address);
      }
    }
  }
  return origins;
};

const nextConfig = {
  reactStrictMode: false,
  // Avoid running ESLint during production builds on developer machines
  // which can trigger glob scans of user folders (e.g. Windows junctions).
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverActions: {
      allowedOrigins: getAllowedOrigins(),
    },
  },

  // Headers for PWA and CORS
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PATCH,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type,Authorization' },
        ],
      },
      {
        source: '/manifest.json',
        headers: [{ key: 'Content-Type', value: 'application/manifest+json' }],
      },
    ];
  },

  // Webpack configuration to exclude system directories
  webpack: (config, { isServer }) => {
    config.resolve.alias['@/'] = projectRoot;

    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        '**/node_modules',
        '**/.next',
        '**/Cookies',
        '**/Cookies/**',
        '**/__pycache__',
        '**/AppData',
        '**/AppData/**',
        '**/Application Data',
        '**/Application Data/**',
        '**/.git',
      ],
    };

    return config;
  },
};

module.exports = nextConfig;
