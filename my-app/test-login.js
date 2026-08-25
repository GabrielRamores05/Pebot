const bcrypt = require('bcryptjs');
const { PrismaClient } = require('./lib/prisma-client');
const { SignJWT } = require('jose');

const prisma = new PrismaClient();

async function testLogin() {
  try {
    const email = 'admin@cafeos.local';
    const password = 'admin123';

    console.log(`Testing login for ${email}...`);

    // Step 1: Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.active) {
      console.error('ERROR: User not found or inactive');
      return;
    }
    console.log('✓ User found and active');

    // Step 2: Verify password
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      console.error('ERROR: Password mismatch');
      return;
    }
    console.log('✓ Password verified');

    // Step 3: Create token (simulate)
    const JWT_SECRET = process.env.JWT_SECRET || 'cafeos-super-secret-jwt-key-change-in-production-2024';
    const secret = new TextEncoder().encode(JWT_SECRET);
    
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };

    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('12h')
      .sign(secret);

    console.log('✓ JWT token created');
    console.log(`\nToken (first 50 chars): ${token.substring(0, 50)}...`);
    console.log(`\nLogin successful! Response would be:`);
    console.log(JSON.stringify({ user: payload, token: token.substring(0, 50) + '...' }, null, 2));

  } catch (error) {
    console.error('ERROR:', error.message || error);
  } finally {
    await prisma.$disconnect();
  }
}

testLogin();
