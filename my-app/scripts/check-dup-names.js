const { PrismaClient } = require('../lib/prisma-client');
const normalizeMemberName = (v) => String(v || '').trim().replace(/\s+/g, ' ').toUpperCase();
const p = new PrismaClient();
p.loyaltyCard.findMany({ select: { id: true, customerName: true, categoryId: true } }).then(async (cards) => {
  const seen = {};
  let dupes = 0;
  for (const c of cards) {
    const k = normalizeMemberName(c.customerName);
    if (seen[k]) { console.log('DUPLICATE:', c.customerName, '(card', c.id, ') matches', seen[k].name); dupes++; }
    else seen[k] = { name: c.customerName };
  }
  if (!dupes) console.log('No duplicate member names found - all clean');
  await p.$disconnect();
}).catch((e) => { console.error(e.message); process.exit(1); });
