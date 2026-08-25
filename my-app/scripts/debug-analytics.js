const { PrismaClient } = require('../lib/prisma-client');
const prisma = new PrismaClient();

async function main() {
  try {
    const totalOrders = await prisma.order.count();
    console.log('Total Orders in DB:', totalOrders);

    const statuses = await prisma.order.groupBy({
      by: ['status'],
      _count: true
    });
    console.log('Order Statuses:', JSON.stringify(statuses, null, 2));

    const range = await prisma.order.aggregate({
      _min: { createdAt: true },
      _max: { createdAt: true }
    });
    console.log('Date Range in DB:', JSON.stringify(range, null, 2));

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const todayCompleted = await prisma.order.count({
      where: {
        status: 'COMPLETED',
        createdAt: { gte: startOfToday }
      }
    });
    console.log('Today Completed Orders:', todayCompleted);

    console.log('Server Current Time:', now.toISOString());
    console.log('Server Local Time:', now.toString());

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
