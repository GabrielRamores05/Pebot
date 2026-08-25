const { PrismaClient } = require('./lib/prisma-client');

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findUnique({
    where: { email: 'admin@cafeos.local' },
  });

  console.log('Admin user in database:');
  console.log(JSON.stringify(admin, null, 2));

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
