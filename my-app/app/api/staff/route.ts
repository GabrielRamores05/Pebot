import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { checkFeatureAccess } from '@/lib/auth';

const DEFAULT_PERMISSIONS = {
  liveOrders: false,
  terminal: false,
  tables: false,
  analytics: false,
  products: false,
  inventory: false,
  kitchen: false,
  loyalty: false,
  staff: false,
  settings: false,
};

export async function GET(req: NextRequest) {
  // Check if user has access to staff feature
  const { user, hasAccess } = await checkFeatureAccess(req, 'staff');
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  if (!hasAccess) {
    return NextResponse.json({ error: 'Feature not available in your subscription tier' }, { status: 403 });
  }

  try {
    const staff = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        permissions: true,
        active: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Parse permissions JSON
    const staffWithParsed = staff.map(s => ({
      ...s,
      permissions: typeof s.permissions === 'string' ? JSON.parse(s.permissions) : s.permissions,
    }));

    return NextResponse.json(staffWithParsed);
  } catch (e) {
    console.error('[STAFF API] Error fetching staff:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Failed to fetch staff', details: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Check if user has access to staff feature
  const { user, hasAccess } = await checkFeatureAccess(req, 'staff');
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  if (!hasAccess) {
    return NextResponse.json({ error: 'Feature not available in your subscription tier' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { name, email, password, role = 'STAFF', permissions } = body;

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
    }

    // Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 400 });
    }

    // Hash password with bcrypt  (matching login route)
    const hashedPassword = await bcrypt.hash(password, 10);

    const newStaff = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role as 'ADMIN' | 'STAFF' | 'KITCHEN',
        permissions: JSON.stringify(permissions || DEFAULT_PERMISSIONS),
        active: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        permissions: true,
        active: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      ...newStaff,
      permissions: JSON.parse(newStaff.permissions),
    }, { status: 201 });
  } catch (e) {
    console.error('[STAFF API] Error creating staff:', e);
    return NextResponse.json({ error: 'Failed to create staff member' }, { status: 500 });
  }
}
