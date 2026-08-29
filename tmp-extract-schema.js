// Extract schema info from dev.db using Prisma's native engine
// This produces the model-to-table mapping needed for the adapter

const { PrismaClient } = require('./my-app/lib/prisma-client');

// Access the internal Prisma client's _runtimeDataModel to get schema mappings
const runtime = require('./my-app/lib/prisma-client/runtime/library.js');

async function main() {
  const prisma = new PrismaClient();
  
  // Use raw query to get table info
  const tables = await prisma.$queryRawUnsafe(`
    SELECT name, sql FROM sqlite_master 
    WHERE type='table' AND name NOT LIKE 'sqlite_%' 
    ORDER BY name
  `);
  
  for (const table of tables) {
    console.log(`\n=== TABLE: ${table.name} ===`);
    console.log(table.sql);
    console.log('');
    
    // Get columns
    const cols = await prisma.$queryRawUnsafe(`PRAGMA table_info("${table.name}")`);
    for (const col of cols) {
      console.log(`  ${col.name} ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
    }
  }
  
  // Get the data model from Prisma
  console.log('\n\n=== PRISMA DATA MODEL ===');
  
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
