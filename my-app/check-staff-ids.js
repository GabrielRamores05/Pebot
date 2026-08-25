const { PrismaClient } = require('./lib/prisma-client');

const prisma = new PrismaClient();

async function main() {
  const staff = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true }
  });
  console.log('Staff in database:');
  console.log(JSON.stringify(staff, null, 2));
}

main().catch(e => {
  console.error(e);
}).finally(async () => {
  await prisma.$disconnect();
});
