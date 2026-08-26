import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { checkFeatureAccess, requirePermission } from '@/lib/auth';

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

const STAFF_SELECT = {
  id: true, name: true, email: true, role: true, permissions: true, active: true,
  createdAt: true, updatedAt: true,
  phone: true, address: true, dateOfBirth: true, hireDate: true,
  position: true, department: true, profilePhoto: true,
  emergencyContactName: true, emergencyContactPhone: true,
  hourlyRate: true, monthlySalary: true, paymentType: true,
} as const;

export async function GET(req: NextRequest) {
  const { user, hasAccess } = await checkFeatureAccess(req, 'staff');
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAccess) return NextResponse.json({ error: 'Feature not available in your subscription tier' }, { status: 403 });

  try {
    const staff = await prisma.user.findMany({ select: STAFF_SELECT, orderBy: { createdAt: 'desc' } });
    const staffWithParsed = staff.map(s => ({
      ...s,
      permissions: typeof s.permissions === 'string' ? JSON.parse(s.permissions) : s.permissions,
    }));
    return NextResponse.json(staffWithParsed);
  } catch (e) {
    console.error('[STAFF API] Error fetching staff:', e);
    return NextResponse.json({ error: 'Failed to fetch staff' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { user, hasAccess } = await checkFeatureAccess(req, 'staff');
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!hasAccess) return NextResponse.json({ error: 'Feature not available in your subscription tier' }, { status: 403 });

  try {
    const body = await req.json();
    const {
      name, email, password, role = 'STAFF', permissions,
      phone, address, dateOfBirth, hireDate, position, department,
      emergencyContactName, emergencyContactPhone,
      hourlyRate, monthlySalary, paymentType,
    } = body;

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newStaff = await prisma.user.create({
      data: {
        name, email, password: hashedPassword, role,
        permissions: JSON.stringify(permissions || DEFAULT_PERMISSIONS),
        active: true,
        phone: phone || null, address: address || null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        hireDate: hireDate ? new Date(hireDate) : null,
        position: position || null, department: department || null,
        emergencyContactName: emergencyContactName || null,
        emergencyContactPhone: emergencyContactPhone || null,
        hourlyRate: hourlyRate != null ? Number(hourlyRate) : null,
        monthlySalary: monthlySalary != null ? Number(monthlySalary) : null,
        paymentType: paymentType || null,
      },
      select: STAFF_SELECT,
    });

    return NextResponse.json({
      ...newStaff,
      permissions: typeof newStaff.permissions === 'string' ? JSON.parse(newStaff.permissions) : newStaff.permissions,
    }, { status: 201 });
  } catch (e) {
    console.error('[STAFF API] Error creating staff:', e);
    return NextResponse.json({ error: 'Failed to create staff member' }, { status: 500 });
  }
}
