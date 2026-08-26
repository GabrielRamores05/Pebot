/**
 * Seed script: Generate 1000 test orders for analytics testing
 * Run: node seed-1000-orders.js
 */

const { PrismaClient } = require('./lib/prisma-client');
const prisma = new PrismaClient();

const FIRST_NAMES = [
  'Juan', 'Maria', 'Carlos', 'Ana', 'Miguel', 'Rosa', 'Luis', 'Patricia',
  'Jose', 'Carmen', 'Francisco', 'Isabel', 'Antonio', 'Francisca', 'Manuel',
  'Dolores', 'Ramon', 'Pilar', 'Diego', 'Mercedes', 'Fernando', 'Josefa',
  'Javier', 'Guadalupe', 'Enrique', 'Remedios', 'Mario', 'Antonia',
  'Roberto', 'Sofia', 'Ricardo', 'Lucia', 'David', 'Gloria', 'Marco', 'Elena'
];

const LAST_NAMES = [
  'Garcia', 'Martinez', 'Rodriguez', 'Hernandez', 'Lopez', 'Gonzalez',
  'Perez', 'Sanchez', 'Ramirez', 'Torres', 'Flores', 'Santiago', 'Morales',
  'Reyes', 'Vargas', 'Castillo', 'Dominguez', 'Ortiz', 'Gutierrez', 'Diaz'
];

const PAYMENT_METHODS = ['CASH', 'GCASH', 'BANK_TRANSFER'];
const STATUSES = ['COMPLETED', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'CANCELLED']; // 80% completed

function getRandomDate(daysBack = 180) {
  const now = new Date();
  const past = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  return new Date(past.getTime() + Math.random() * (now.getTime() - past.getTime()));
}

function getRandomName(allNames) {
  return allNames[Math.floor(Math.random() * allNames.length)];
}

function generateOrderNumber() {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 1000000);
  return `ORD-${dateStr}-${random}`;
}

function generateBarcode() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

async function seedOrders() {
  try {
    console.log('🌱 Starting seed for 1000 test orders...\n');

    // Fetch all products
    const products = await prisma.product.findMany();
    if (products.length === 0) {
      console.error('❌ No products found. Please seed products first.');
      await prisma.$disconnect();
      process.exit(1);
    }

    // Fetch all tables
    const tables = await prisma.restaurantTable.findMany();
    if (tables.length === 0) {
      console.error('❌ No tables found. Please create tables first.');
      await prisma.$disconnect();
      process.exit(1);
    }

    console.log(`📦 Found ${products.length} products and ${tables.length} tables`);
    console.log(`📋 Generating 1000 orders with dates spread over last 6 months...\n`);

    // Generate regular customer names (for repeat orders)
    const regularCustomers = [];
    for (let i = 0; i < 20; i++) {
      const firstName = getRandomName(FIRST_NAMES);
      const lastName = getRandomName(LAST_NAMES);
      regularCustomers.push(`${firstName} ${lastName}`);
    }

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < 1000; i++) {
      try {
        // 80% chance of regular customer, 20% new customer
        let customerName;
        if (Math.random() < 0.8) {
          customerName = regularCustomers[Math.floor(Math.random() * regularCustomers.length)];
        } else {
          const firstName = getRandomName(FIRST_NAMES);
          const lastName = getRandomName(LAST_NAMES);
          customerName = `${firstName} ${lastName}`;
        }

        // Random date within last 180 days
        const orderDate = getRandomDate(180);

        // Random table (or null for takeout/delivery)
        const tableId = Math.random() < 0.7 ? tables[Math.floor(Math.random() * tables.length)].id : null;

        // Random status (80% completed, 20% cancelled)
        const status = STATUSES[Math.floor(Math.random() * STATUSES.length)];

        // Generate 1-4 items per order
        const itemCount = Math.floor(Math.random() * 4) + 1;
        const items = [];
        let totalAmount = 0;

        for (let j = 0; j < itemCount; j++) {
          const product = products[Math.floor(Math.random() * products.length)];
          const quantity = Math.floor(Math.random() * 3) + 1;
          const subtotal = product.price * quantity;
          totalAmount += subtotal;

          items.push({
            productId: product.id,
            quantity,
            unitPrice: product.price,
            subtotal,
            notes: null
          });
        }

        // Create order
        const order = await prisma.order.create({
          data: {
            orderNumber: generateOrderNumber(),
            customerName,
            tableId,
            status,
            totalAmount: Math.round(totalAmount * 100) / 100,
            barcodeValue: generateBarcode(),
            paymentMethod: PAYMENT_METHODS[Math.floor(Math.random() * PAYMENT_METHODS.length)],
            items: {
              create: items
            },
            createdAt: orderDate,
            updatedAt: orderDate
          }
        });

        successCount++;

        // Log progress every 100 orders
        if ((i + 1) % 100 === 0) {
          console.log(`✓ Created ${i + 1} orders...`);
        }
      } catch (err) {
        errorCount++;
        console.error(`❌ Error creating order ${i + 1}:`, err.message);
      }
    }

    console.log(`\n✅ Seed completed!`);
    console.log(`   Success: ${successCount} orders`);
    console.log(`   Errors: ${errorCount} orders`);
    console.log(`\n📊 Your analytics should now have plenty of data to analyze!`);

    await prisma.$disconnect();
  } catch (e) {
    console.error('❌ Fatal error:', e);
    await prisma.$disconnect();
    process.exit(1);
  }
}

seedOrders();
