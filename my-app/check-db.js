const { PrismaClient } = require('./lib/prisma-client');

const prisma = new PrismaClient();

async function main() {
  try {
    const users = await prisma.user.findMany();
    console.log('Users in database:');
    users.forEach(u => {
      console.log(`- ${u.email}: role=${u.role}, active=${u.active}`);
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
