import { PrismaClient } from '../lib/prisma-client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

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

async function main() {
  console.log('🌱 Seeding database...');

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

  console.log('✓ Subscription tiers created');

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

  console.log('✓ Admin user created/updated:', admin.email);
  console.log('  ✓ All features enabled (PREMIUM tier)');

  // Create staff user
  const staffPassword = await hashPassword('staff123');
  const staff = await prisma.user.upsert({
    where: { email: 'staff@cafeos.local' },
    update: {},
    create: {
      name: 'Staff Member',
      email: 'staff@cafeos.local',
      password: staffPassword,
      role: 'STAFF',
      permissions: JSON.stringify({
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
      }),
      subscriptionId: regularSubscription.id,
      active: true,
    },
  });

  console.log('✓ Staff user created:', staff.email);
  console.log('  ✓ Limited features enabled (Orders, Terminal, Tables) - REGULAR tier');

  // Create a POS license
  const posLicense = await prisma.pOSLicense.upsert({
    where: { id: 1 },
    update: {},
    create: {
      licenseKey: 'C POS-OS-2026-0001',
      isActivated: true,
      activatedAt: new Date(),
      activatedBy: admin.id,
    },
  });

   console.log('✓ POS License created/activated');

   // ── Demo ingredient inventory + recipes (Recipe/BOM model) ──────────────
   // These exercise the shared-ingredient-pool availability engine. A café
   // replaces them with its own menu; they're idempotent (matched by name).
   const coffeeCat = await prisma.category.upsert({
     where: { name: 'Coffee' },
     update: { icon: '☕' },
     create: { name: 'Coffee', icon: '☕', sortOrder: 0 },
   });
   console.log('✓ Category:', coffeeCat.name);

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
   console.log('✓ Ingredients: Coffee Beans, Fresh Milk, Sugar');

   async function upsertProduct(data: {
     name: string; price: number; capitalCost: number; categoryId: number;
   }) {
     const existing = await prisma.product.findFirst({ where: { name: data.name } });
     if (existing) {
       return prisma.product.update({ where: { id: existing.id }, data });
     }
     return prisma.product.create({ data });
   }

   const americano = await upsertProduct({ name: 'Americano', price: 120, capitalCost: 30, categoryId: coffeeCat.id });
   const latte = await upsertProduct({ name: 'Latte', price: 150, capitalCost: 45, categoryId: coffeeCat.id });
   console.log('✓ Products: Americano, Latte');

   // Per-product Inventory rows (quantity is a *derived cache* — the backfill
   // script recomputes it from ingredient stock).
   for (const p of [americano, latte]) {
     await prisma.inventory.upsert({
       where: { productId: p.id },
       update: { lowStockThreshold: 10, unit: 'pcs' },
       create: { productId: p.id, quantity: 0, lowStockThreshold: 10, unit: 'pcs' },
     });
   }

   // Recipes (BOM): how much of each ingredient one product consumes.
    await prisma.productIngredient.deleteMany({ where: { productId: { in: [americano.id, latte.id] } } });
   await prisma.productIngredient.createMany({
     data: [
       { productId: americano.id, ingredientId: beans.id, quantity: 18, required: true },
       { productId: americano.id, ingredientId: sugar.id, quantity: 10, required: false },
       { productId: latte.id, ingredientId: beans.id, quantity: 18, required: true },
       { productId: latte.id, ingredientId: milk.id, quantity: 150, required: true },
       { productId: latte.id, ingredientId: sugar.id, quantity: 10, required: false },
     ],
   });
   console.log('✓ Recipes assigned (Coffee Beans / Milk required, Sugar optional)');

   // Option groups and presets (product customization)
   const sizeGroup = await prisma.optionGroup.upsert({
     where: { name: 'Size' },
     update: {},
     create: { name: 'Size', selectionType: 'single', scalesRecipe: true, sortOrder: 1 },
   });
   const tempGroup = await prisma.optionGroup.upsert({
     where: { name: 'Temperature' },
     update: {},
     create: { name: 'Temperature', selectionType: 'single', scalesRecipe: false, sortOrder: 2 },
   });
   const addonGroup = await prisma.optionGroup.upsert({
     where: { name: 'Add-ons' },
     update: {},
     create: { name: 'Add-ons', selectionType: 'multi', scalesRecipe: false, sortOrder: 3 },
   });

   const optionPresets: [number, string, number, number, number][] = [
     [sizeGroup.id, 'Small', 0, 1, 1],
     [sizeGroup.id, 'Medium', 15, 1.5, 2],
     [sizeGroup.id, 'Large', 30, 2, 3],
     [tempGroup.id, 'Hot', 0, 1, 1],
     [tempGroup.id, 'Cold', 0, 1, 2],
     [addonGroup.id, 'Extra Shot', 25, 1, 1],
     [addonGroup.id, 'Whipped Cream', 10, 1, 2],
     [addonGroup.id, 'Oat Milk', 20, 1, 3],
   ];
   for (const [groupId, name, priceDelta, sizeMultiplier, sortOrder] of optionPresets) {
     await prisma.option.upsert({
       where: { groupId_name: { groupId, name } },
       update: { priceDelta, sizeMultiplier, sortOrder },
       create: { groupId, name, priceDelta, sizeMultiplier, sortOrder },
     });
   }
   console.log('OK Option groups seeded (Size / Temperature / Add-ons)');

   // Attach Size + Temperature to Coffee-category drinks
   const coffeeCategory = await prisma.category.findFirst({ where: { name: 'Coffee' } });
   if (coffeeCategory) {
     const coffeeProducts = await prisma.product.findMany({ where: { categoryId: coffeeCategory.id } });
     for (const prod of coffeeProducts) {
       for (const gid of [sizeGroup.id, tempGroup.id]) {
         await prisma.productOptionGroup.upsert({
           where: { productId_groupId: { productId: prod.id, groupId: gid } },
           update: {},
           create: { productId: prod.id, groupId: gid },
         });
       }
     }
     console.log(`OK Size + Temperature attached to ${coffeeProducts.length} Coffee product(s)`);
   }

   console.log('✅ Seeding completed!');
  console.log('📝 You can now login with:');
  console.log('   Email: admin@cafeos.local, Password: admin123');
  console.log('   Email: staff@cafeos.local, Password: staff123');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
