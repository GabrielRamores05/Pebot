/**
 * electron/seed.js
 * Runs after prisma db push on first install.
 * Only seeds if no users exist (safe to call every startup).
 * Synced with prisma/seed.ts for consistent dev/prod data.
 */
const { PrismaClient } = require('../lib/prisma-client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const DEFAULT_PERMISSIONS = {
  liveOrders: true,
  terminal: false,
  tables: false,
  analytics: false,
  products: false,
  inventory: false,
  kitchen: false,
  loyalty: false,
  staff: false,
  settings: false,
};

const ADMIN_PERMISSIONS = {
  liveOrders: true,
  terminal: true,
  tables: true,
  analytics: true,
  products: true,
  inventory: true,
  kitchen: true,
  loyalty: true,
  staff: true,
  settings: true,
};

const STAFF_PERMISSIONS = {
  liveOrders: true,
  terminal: true,
  tables: true,
  analytics: false,
  products: false,
  inventory: false,
  kitchen: false,
  loyalty: false,
  staff: false,
  settings: false,
};

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

async function main() {
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    console.log('[seed] Users already exist, skipping seed.');
    return;
  }

  console.log('[seed] Seeding default data...');

  // ── Subscription Tiers ───────────────────────────────────────────────────────
  const regularSubscription = await prisma.subscription.upsert({
    where: { id: 1 },
    update: {},
    create: {
      tier: 'REGULAR',
      features: JSON.stringify({
        analytics: false,
        inventory: false,
        staff: false,
        settings: false,
        kitchen: false,
        loyalty: false,
      }),
      price: 0,
      billingCycle: 'MONTHLY',
      isActive: true,
    },
  });

  const mediumSubscription = await prisma.subscription.upsert({
    where: { id: 2 },
    update: {},
    create: {
      tier: 'MEDIUM',
      features: JSON.stringify({
        analytics: true,
        inventory: true,
        staff: false,
        settings: false,
        kitchen: true,
        loyalty: true,
      }),
      price: 299,
      billingCycle: 'MONTHLY',
      isActive: true,
    },
  });

  const premiumSubscription = await prisma.subscription.upsert({
    where: { id: 3 },
    update: {},
    create: {
      tier: 'PREMIUM',
      features: JSON.stringify({
        analytics: true,
        inventory: true,
        staff: true,
        settings: true,
        kitchen: true,
        loyalty: true,
      }),
      price: 599,
      billingCycle: 'MONTHLY',
      isActive: true,
    },
  });

  console.log('[seed] Subscription tiers created');

  // ── Users ──────────────────────────────────────────────────────────────────
  const [adminHash, staffHash, kitchenHash] = await Promise.all([
    hashPassword('admin123'),
    hashPassword('staff123'),
    hashPassword('kitchen123'),
  ]);

  const admin = await prisma.user.create({
    data: {
      name: 'Admin User',
      email: 'admin@cafeos.local',
      password: adminHash,
      role: 'ADMIN',
      permissions: JSON.stringify(ADMIN_PERMISSIONS),
      subscriptionId: premiumSubscription.id,
      active: true,
    },
  });

  const staff = await prisma.user.create({
    data: {
      name: 'Staff Member',
      email: 'staff@cafeos.local',
      password: staffHash,
      role: 'STAFF',
      permissions: JSON.stringify(STAFF_PERMISSIONS),
      subscriptionId: regularSubscription.id,
      active: true,
    },
  });

  await prisma.user.create({
    data: {
      name: 'Kitchen',
      email: 'kitchen@cafeos.local',
      password: kitchenHash,
      role: 'KITCHEN',
      permissions: JSON.stringify(DEFAULT_PERMISSIONS),
      subscriptionId: mediumSubscription.id,
      active: true,
    },
  });

  console.log('[seed] Users created');
  console.log('  Admin:', admin.email, '(PREMIUM tier - all features)');
  console.log('  Staff:', staff.email, '(REGULAR tier - limited features)');

  // ── POS License ─────────────────────────────────────────────────────────────
  await prisma.pOSLicense.upsert({
    where: { id: 1 },
    update: {},
    create: {
      licenseKey: 'C POS-OS-2026-0001',
      isActivated: true,
      activatedAt: new Date(),
      activatedBy: admin.id,
    },
  });
  console.log('[seed] POS License created/activated');

  // ──   // Sample data skipped for clean start
console.log('[seed] Done! Login: admin@cafeos.local / admin123');
  console.log('         Staff: staff@cafeos.local / staff123');
  console.log('         Kitchen: kitchen@cafeos.local / kitchen123');
}

main()
  .catch((e) => { console.error('[seed] Error:', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());