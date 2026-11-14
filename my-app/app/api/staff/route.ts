import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { pinProblem } from '@/lib/approvals';
import { setPin } from '@/modules/pins/service';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { badRequest, serverError } from '@/lib/api-response';
import { guardFeature } from '@/lib/api-guards';

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
  const { user, error } = await guardFeature(req, 'staff');
  if (error) return error;

  try {
    const staff = await prisma.user.findMany({ select: STAFF_SELECT, orderBy: { createdAt: 'desc' } });
    const staffWithParsed = staff.map(s => ({
      ...s,
      permissions: typeof s.permissions === 'string' ? JSON.parse(s.permissions) : s.permissions,
    }));
    return NextResponse.json(staffWithParsed);
  } catch (e) {
    return serverError(e, 'Failed to fetch staff');
  }
}

export async function POST(req: NextRequest) {
  const { user, error } = await guardFeature(req, 'staff');
  if (error) return error;

  try {
    const body = await req.json();
    const {
      name, email, password, role = 'STAFF', permissions,
      phone, address, dateOfBirth, hireDate, position, department,
      emergencyContactName, emergencyContactPhone,
      hourlyRate, monthlySalary, paymentType, pin,
    } = body;

    if (pin != null && pin !== '') {
      const problem = pinProblem(String(pin));
      if (problem) return badRequest(problem);
    }

    if (!name || !email || !password) {
      return badRequest('Name, email, and password are required');
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return badRequest('Email already in use');
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

    if (pin != null && pin !== '') {
      try { await setPin(newStaff.id, String(pin)); } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: (e as { status?: number }).status ?? 400 }); }
    }

    return NextResponse.json({
      ...newStaff,
      permissions: typeof newStaff.permissions === 'string' ? JSON.parse(newStaff.permissions) : newStaff.permissions,
    }, { status: 201 });
  } catch (e) {
    return serverError(e, 'Failed to create staff member');
  }
}
