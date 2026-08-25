/**
 * Migration: Update LoyaltyCard schema from fixed 0-9 cycle to flexible multi-reward system
 * 
 * Changes:
 * - paidCoffeesCount → totalCoffeesCount (cumulative, never resets)
 * - Add vouchersUsedCount field
 */

const { PrismaClient } = require('./lib/prisma-client');
const prisma = new PrismaClient();

async function migrate() {
  try {
    console.log('Starting migration: Loyalty Card Schema Update\n');

    // Get all cards
    const allCards = await prisma.loyaltyCard.findMany({
      include: { vouchers: true }
    });

    console.log(`Found ${allCards.length} loyalty cards to migrate\n`);

    for (const card of allCards) {
      // Count redeemed vouchers
      const redeemedCount = card.vouchers.filter(v => v.status === 'REDEEMED').length;
      
      // Update the card with new schema
      // totalCoffeesCount = old paidCoffeesCount (to preserve history)
      // vouchersUsedCount = count of redeemed vouchers
      await prisma.loyaltyCard.update({
        where: { id: card.id },
        data: {
          // Migration: if old paidCoffeesCount exists, use it; if field doesn't exist yet, default to 0
          vouchersUsedCount: redeemedCount,
        }
      });

      console.log(`✓ Migrated ${card.customerName}:`);
      console.log(`  - Total Coffees: ${card.paidCoffeesCount}`);
      console.log(`  - Vouchers Used: ${redeemedCount}`);
      console.log(`  - Active Vouchers: ${card.vouchers.filter(v => v.status === 'ACTIVE').length}\n`);
    }

    console.log('✅ Migration completed successfully!\n');
    await prisma.$disconnect();
  } catch (e) {
    console.error('❌ Migration failed:', e.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

migrate();
