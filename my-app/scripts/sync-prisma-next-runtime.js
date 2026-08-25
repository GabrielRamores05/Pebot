const fs = require('fs');
const path = require('path');

const appDir = process.cwd();
const nextPrismaDir = path.join(appDir, '.next', 'node_modules', '@prisma');
const appPrismaDir = path.join(appDir, 'node_modules', '@prisma');

function log(message) {
  process.stdout.write(`[sync-prisma] ${message}\n`);
}

if (!fs.existsSync(nextPrismaDir)) {
  log(`No generated Prisma runtime found at ${nextPrismaDir}`);
  process.exit(0);
}

const generatedPackages = fs
  .readdirSync(nextPrismaDir, { withFileTypes: true })
  .filter((entry) => (entry.isDirectory() || entry.isSymbolicLink()) && entry.name.startsWith('client-'));

if (generatedPackages.length === 0) {
  log('No generated Prisma runtime packages to sync');
  process.exit(0);
}

fs.mkdirSync(appPrismaDir, { recursive: true });

for (const pkg of generatedPackages) {
  const source = path.join(nextPrismaDir, pkg.name);
  const resolvedSource = fs.realpathSync(source);
  const target = path.join(appPrismaDir, pkg.name);
  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(resolvedSource, target, { recursive: true });
  log(`Copied ${pkg.name}`);
}
