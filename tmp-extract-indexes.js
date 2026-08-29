const { PrismaClient } = require('./my-app/lib/prisma-client');

async function main() {
  const prisma = new PrismaClient();
  
  // Get all indexes and unique constraints
  const indexes = await prisma.$queryRawUnsafe(`
    SELECT name, tbl_name, sql FROM sqlite_master 
    WHERE type='index' AND name NOT LIKE 'sqlite_%' 
    ORDER BY tbl_name, name
  `);
  
  console.log('=== INDEXES ===');
  for (const idx of indexes) {
    console.log(`${idx.tbl_name}: ${idx.name} - ${idx.sql}`);
  }
  
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
