import { NextRequest, NextResponse } from 'next/server';
import { setPin } from '@/modules/pins/service';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { badRequest, notFound, serverError, unauthorized } from '@/lib/api-response';

const STAFF_SELECT = {
  id: true, name: true, email: true, role: true, permissions: true, active: true,
  createdAt: true, updatedAt: true,
  phone: true, address: true, dateOfBirth: true, hireDate: true,
  position: true, department: true, profilePhoto: true,
  emergencyContactName: true, emergencyContactPhone: true,
  hourlyRate: true, monthlySalary: true, paymentType: true,
} as const;

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'staff');
  if (!auth) return unauthorized();

  try {
    const { id } = await params;
    const staffId = parseInt(id);
    if (isNaN(staffId)) return badRequest('Invalid staff ID');

    const body = await req.json();
    const {
      name, email, password, permissions, active, role,
      phone, address, dateOfBirth, hireDate, position, department,
      emergencyContactName, emergencyContactPhone,
      hourlyRate, monthlySalary, paymentType, pin,
    } = body;

    const currentStaff = await prisma.user.findUnique({ where: { id: staffId }, select: { email: true } });
    if (!currentStaff) return notFound('Staff member not found');

    if (email && email !== currentStaff.email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) return badRequest('Email already in use');
    }

    const updateData: Record<string, unknown> = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    if (password && password.trim()) updateData.password = await bcrypt.hash(password, 10);
    if (permissions) updateData.permissions = JSON.stringify(permissions);
    if (active !== undefined) updateData.active = active;
    if (phone !== undefined) updateData.phone = phone || null;
    if (address !== undefined) updateData.address = address || null;
    if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    if (hireDate !== undefined) updateData.hireDate = hireDate ? new Date(hireDate) : null;
    if (position !== undefined) updateData.position = position || null;
    if (department !== undefined) updateData.department = department || null;
    if (emergencyContactName !== undefined) updateData.emergencyContactName = emergencyContactName || null;
    if (emergencyContactPhone !== undefined) updateData.emergencyContactPhone = emergencyContactPhone || null;
    if (hourlyRate !== undefined) updateData.hourlyRate = hourlyRate != null ? Number(hourlyRate) : null;
    if (monthlySalary !== undefined) updateData.monthlySalary = monthlySalary != null ? Number(monthlySalary) : null;
    if (paymentType !== undefined) updateData.paymentType = paymentType || null;

    if (pin !== undefined && pin !== '') {
      try {
        await setPin(staffId, pin === null ? null : String(pin));
      } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: (e as { status?: number }).status ?? 400 });
      }
    }

    const updated = await prisma.user.update({ where: { id: staffId }, data: updateData, select: STAFF_SELECT });

    return NextResponse.json({
      ...updated,
      permissions: typeof updated.permissions === 'string' ? JSON.parse(updated.permissions) : updated.permissions,
    });
  } catch (e) {
    return serverError(e, 'Failed to update staff member');
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePermission(req, 'staff');
  if (!auth) return unauthorized();

  try {
    const { id } = await params;
    const staffId = parseInt(id);
    if (isNaN(staffId)) return badRequest('Invalid staff ID');

    await prisma.user.delete({ where: { id: staffId } });
    return NextResponse.json({ success: true });
  } catch (e) {
    return serverError(e, 'Failed to delete staff member');
  }
}
