const bcrypt = require('bcryptjs');
const { PrismaClient } = require('./lib/prisma-client');

const prisma = new PrismaClient();

async function main() {
  try {
    const user = await prisma.user.findUnique({ where: { email: 'admin@cafeos.local' } });
    
    if (!user) {
      console.error('Admin user not found');
      return;
    }

    console.log('Admin user found:');
    console.log(`  Email: ${user.email}`);
    console.log(`  Role: ${user.role}`);
    console.log(`  Active: ${user.active}`);
    console.log(`  Password hash: ${user.password}`);
    
    // Test password verification
    const testPassword = 'admin123';
    const isValid = await bcrypt.compare(testPassword, user.password);
    
    console.log(`\nPassword verification test:`);
    console.log(`  Testing password "${testPassword}": ${isValid ? 'VALID' : 'INVALID'}`);
    
    if (!isValid) {
      // Try to understand what password might be correct
      console.log(`\n  Password issue detected!`);
      console.log(`  The hash stored: ${user.password}`);
      console.log(`  Expected password from seed: admin123`);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
