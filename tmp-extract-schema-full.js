const { PrismaClient } = require('./my-app/lib/prisma-client');
const p = new PrismaClient();

async function main() {
  // Get all table DDL
  const tables = await p.$queryRawUnsafe(`
    SELECT name, sql FROM sqlite_master 
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `);

  console.log('=== ALL TABLE DDL ===');
  for (const t of tables) {
    console.log('\n--- TABLE: ' + t.name + ' ---');
    console.log(t.sql);
    
    // Also get columns
    const cols = await p.$queryRawUnsafe(`PRAGMA table_info("${t.name}")`);
    console.log('  Columns:');
    for (const c of cols) {
      console.log(`    ${c.name}|${c.type}|${c.notnull}|${c.dfltValue}|${c.pk}`);
    }
    
    // Get FKs
    const fks = await p.$queryRawUnsafe(`PRAGMA foreign_key_list("${t.name}")`);
    if (fks.length > 0) {
      console.log('  Foreign keys:');
      for (const f of fks) {
        console.log(`    ${f.from} -> ${f.table}.${f.to}`);
      }
    }
  }

  // Get unique constraints
  const uniques = await p.$queryRawUnsafe(`
    SELECT name, tbl_name, sql FROM sqlite_master 
    WHERE type='index' AND sql IS NOT NULL AND sql LIKE '%UNIQUE%'
    ORDER BY tbl_name, name
  `);
  console.log('\n=== UNIQUE INDEXES ===');
  for (const u of uniques) {
    console.log(`${u.tbl_name}: ${u.sql}`);
  }

  // List all relations from the schema
  console.log('\n=== RELATIONS ===');
  const relationTables = await p.$queryRawUnsafe(`
    SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name
  `);
  console.log(relationTables.map(t => t.name).join(', '));

  await p.$disconnect();
}

main().catch(e => { console.error(e); p.$disconnect(); });
