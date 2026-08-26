import { PrismaClient } from '../lib/prisma-client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

const DEFAULT_PERMISSIONS = {
  liveOrders: true,
  terminal: true,
  tables: false,
  analytics: false,
  products: false,
  inventory: false,
  kitchen: false,
  loyalty: true,
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

async function main() {
  console.log('Seeding database...');

  // Create subscription tiers
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

  console.log('  Subscription tiers created');

  // Create admin user
  const adminPassword = await hashPassword('admin123');
  const admin = await prisma.user.upsert({
    where: { email: 'admin@cafeos.local' },
    update: {
      role: 'ADMIN',
      permissions: JSON.stringify(ADMIN_PERMISSIONS),
      subscriptionId: premiumSubscription.id,
    },
    create: {
      name: 'Admin User',
      email: 'admin@cafeos.local',
      password: adminPassword,
      role: 'ADMIN',
      permissions: JSON.stringify(ADMIN_PERMISSIONS),
      subscriptionId: premiumSubscription.id,
      active: true,
    },
  });

  console.log('  Admin user:', admin.email);

  // Create staff user
  const staffPassword = await hashPassword('staff123');
  const staff = await prisma.user.upsert({
    where: { email: 'staff@cafeos.local' },
    update: { permissions: JSON.stringify(DEFAULT_PERMISSIONS) },
    create: {
      name: 'Staff Member',
      email: 'staff@cafeos.local',
      password: staffPassword,
      role: 'STAFF',
      permissions: JSON.stringify(DEFAULT_PERMISSIONS),
      subscriptionId: regularSubscription.id,
      active: true,
    },
  });

  console.log('  Staff user:', staff.email);

  // POS license
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

  console.log('  POS License created');

  // ── HR: default shift templates ─────────────────────────────────────────────
  const shifts = [
    { name: 'Morning', startTime: '06:00', endTime: '14:00', breakMinutes: 30, sortOrder: 1 },
    { name: 'Afternoon', startTime: '14:00', endTime: '22:00', breakMinutes: 30, sortOrder: 2 },
    { name: 'Full Day', startTime: '08:00', endTime: '17:00', breakMinutes: 60, sortOrder: 3 },
    { name: 'Night', startTime: '22:00', endTime: '06:00', breakMinutes: 30, sortOrder: 4 },
  ];
  for (const s of shifts) {
    await prisma.shift.upsert({
      where: { name: s.name },
      update: {},
      create: s,
    });
  }
  console.log('  Shift templates seeded');

  // ── HR: default leave types ────────────────────────────────────────────────
  const leaveTypes = [
    { name: 'Sick Leave', daysPerYear: 15 },
    { name: 'Vacation Leave', daysPerYear: 15 },
    { name: 'Personal Leave', daysPerYear: 5 },
    { name: 'Maternity Leave', daysPerYear: 60 },
    { name: 'Paternity Leave', daysPerYear: 7 },
  ];
  for (const lt of leaveTypes) {
    await prisma.leaveType.upsert({
      where: { name: lt.name },
      update: {},
      create: lt,
    });
  }
  console.log('  Leave types seeded');

  // ── Ingredients ────────────────────────────────────────────────────────────
  const coffeeCat = await prisma.category.upsert({
    where: { name: 'Coffee' },
    update: { icon: '☕' },
    create: { name: 'Coffee', icon: '☕', sortOrder: 0 },
  });

  async function upsertIngredient(data: {
    name: string; category: string; baseUnit: string; purchaseUnit: string;
    currentStock: number; minStock: number; costPerUnit: number;
  }) {
    const existing = await prisma.ingredient.findFirst({ where: { name: data.name } });
    if (existing) {
      return prisma.ingredient.update({ where: { id: existing.id }, data });
    }
    return prisma.ingredient.create({ data });
  }

  const beans = await upsertIngredient({
    name: 'Coffee Beans', category: 'Coffee', baseUnit: 'g', purchaseUnit: 'kg',
    currentStock: 1000, minStock: 200, costPerUnit: 0.60,
  });
  const milk = await upsertIngredient({
    name: 'Fresh Milk', category: 'Dairy', baseUnit: 'ml', purchaseUnit: 'L',
    currentStock: 2000, minStock: 500, costPerUnit: 0.08,
  });
  const sugar = await upsertIngredient({
    name: 'Sugar', category: 'Syrup', baseUnit: 'g', purchaseUnit: 'kg',
    currentStock: 500, minStock: 100, costPerUnit: 0.04,
  });
  console.log('  Ingredients: Coffee Beans, Fresh Milk, Sugar');

  // ── Products ───────────────────────────────────────────────────────────────
  async function upsertProduct(data: {
    name: string; price: number; categoryId: number;
  }) {
    const existing = await prisma.product.findFirst({ where: { name: data.name } });
    if (existing) {
      return prisma.product.update({ where: { id: existing.id }, data });
    }
    return prisma.product.create({ data });
  }

  const americano = await upsertProduct({ name: 'Americano', price: 120, categoryId: coffeeCat.id });
  const latte = await upsertProduct({ name: 'Latte', price: 150, categoryId: coffeeCat.id });
  console.log('  Products: Americano, Latte');

  // Per-product Inventory rows
  for (const p of [americano, latte]) {
    await prisma.inventory.upsert({
      where: { productId: p.id },
      update: { lowStockThreshold: 10, unit: 'pcs' },
      create: { productId: p.id, quantity: 0, lowStockThreshold: 10, unit: 'pcs' },
    });
  }

  // Recipes (BOM) — every recipe ingredient is required (no optional concept).
  await prisma.productIngredient.deleteMany({ where: { productId: { in: [americano.id, latte.id] } } });
  await prisma.productIngredient.createMany({
    data: [
      { productId: americano.id, ingredientId: beans.id, quantity: 18, required: true },
      { productId: americano.id, ingredientId: sugar.id, quantity: 10, required: true },
      { productId: latte.id, ingredientId: beans.id, quantity: 18, required: true },
      { productId: latte.id, ingredientId: milk.id, quantity: 150, required: true },
      { productId: latte.id, ingredientId: sugar.id, quantity: 10, required: true },
    ],
  });
  console.log('  Recipes assigned');

  // Derived capital cost = Σ (ingredient.costPerUnit × quantity) over the recipe.
  // Recomputed here so a fresh seed has correct costs without manual entry.
  for (const p of [americano, latte]) {
    const recipe = await prisma.productIngredient.findMany({
      where: { productId: p.id },
      include: { ingredient: true },
    });
    const capital = recipe.reduce(
      (sum, pi) => sum + (pi.quantity || 0) * (pi.ingredient.costPerUnit || 0),
      0,
    );
    await prisma.product.update({ where: { id: p.id }, data: { capitalCost: capital } });
  }

  // ── Per-product option groups & options ─────────────────────────────────────
  // Clean slate for option data
  await prisma.productOptionIngredient.deleteMany();
  await prisma.productOption.deleteMany();
  await prisma.productOptionGroup.deleteMany();
  await prisma.optionGroup.deleteMany();

  // Create groups
  const sizeGroup = await prisma.optionGroup.create({
    data: { name: 'Size', selectionType: 'single', sortOrder: 1 },
  });
  const tempGroup = await prisma.optionGroup.create({
    data: { name: 'Temperature', selectionType: 'single', sortOrder: 2 },
  });
  const addonGroup = await prisma.optionGroup.create({
    data: { name: 'Add-ons', selectionType: 'multi', sortOrder: 3 },
  });
  console.log('  Groups: Size, Temperature, Add-ons');

  // Attach all three groups to both products
  for (const prod of [americano, latte]) {
    for (const gid of [sizeGroup.id, tempGroup.id, addonGroup.id]) {
      await prisma.productOptionGroup.create({
        data: { productId: prod.id, groupId: gid },
      });
    }
  }

  // Helper: create a product option with optional ingredient deltas
  async function createOption(
    productId: number,
    groupId: number,
    name: string,
    priceDelta: number,
    sortOrder: number,
    deltas: { ingredientId: number; deltaQty: number }[] = [],
  ) {
    const option = await prisma.productOption.create({
      data: { productId, groupId, name, priceDelta, sortOrder },
    });
    for (const d of deltas) {
      await prisma.productOptionIngredient.create({
        data: { productOptionId: option.id, ingredientId: d.ingredientId, deltaQty: d.deltaQty },
      });
    }
    return option;
  }

  // ── Americano per-product options ───────────────────────────────────────────
  // Base recipe: 18g beans, 10g sugar (optional)
  // Small = base (no delta), Medium = +8g beans, Large = +18g beans (doubles)
  await createOption(americano.id, sizeGroup.id, 'Small', 0, 1, [
    { ingredientId: beans.id, deltaQty: 0 },
  ]);
  await createOption(americano.id, sizeGroup.id, 'Medium', 15, 2, [
    { ingredientId: beans.id, deltaQty: 8 },
  ]);
  await createOption(americano.id, sizeGroup.id, 'Large', 30, 3, [
    { ingredientId: beans.id, deltaQty: 18 },
  ]);

  await createOption(americano.id, tempGroup.id, 'Hot', 0, 1);
  await createOption(americano.id, tempGroup.id, 'Cold', 0, 2);

  await createOption(americano.id, addonGroup.id, 'Extra Shot', 25, 1, [
    { ingredientId: beans.id, deltaQty: 18 },
  ]);
  await createOption(americano.id, addonGroup.id, 'Whipped Cream', 10, 2);
  await createOption(americano.id, addonGroup.id, 'Oat Milk', 20, 3);

  // ── Latte per-product options ───────────────────────────────────────────────
  // Base recipe: 18g beans, 150ml milk, 10g sugar (optional)
  // Small = base, Medium = +8g beans +75ml milk, Large = +18g beans +150ml milk
  await createOption(latte.id, sizeGroup.id, 'Small', 0, 1, [
    { ingredientId: beans.id, deltaQty: 0 },
    { ingredientId: milk.id, deltaQty: 0 },
  ]);
  await createOption(latte.id, sizeGroup.id, 'Medium', 15, 2, [
    { ingredientId: beans.id, deltaQty: 8 },
    { ingredientId: milk.id, deltaQty: 75 },
  ]);
  await createOption(latte.id, sizeGroup.id, 'Large', 30, 3, [
    { ingredientId: beans.id, deltaQty: 18 },
    { ingredientId: milk.id, deltaQty: 150 },
  ]);

  await createOption(latte.id, tempGroup.id, 'Hot', 0, 1);
  await createOption(latte.id, tempGroup.id, 'Cold', 0, 2);

  await createOption(latte.id, addonGroup.id, 'Extra Shot', 25, 1, [
    { ingredientId: beans.id, deltaQty: 18 },
  ]);
  await createOption(latte.id, addonGroup.id, 'Whipped Cream', 10, 2);
  await createOption(latte.id, addonGroup.id, 'Oat Milk', 20, 3);

  console.log('  Per-product options seeded with ingredient deltas');

  console.log('Seeding completed!');
  console.log('Login: admin@cafeos.local / admin123');
  console.log('Login: staff@cafeos.local / staff123');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
