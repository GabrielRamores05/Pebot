import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const staffId = parseInt(id);
    
    // Validate that staffId is a valid number
    if (isNaN(staffId)) {
      return NextResponse.json({ error: 'Invalid staff ID' }, { status: 400 });
    }
    
    const body = await req.json();
    const { name, email, password, permissions, active } = body;

    // Get current staff data first
    const currentStaff = await prisma.user.findUnique({
      where: { id: staffId },
      select: { email: true }
    });

    if (!currentStaff) {
      return NextResponse.json({ error: 'Staff member not found' }, { status: 404 });
    }

    // Check if new email is already in use by another user (only if email is being changed)
    if (email && email !== currentStaff.email) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 400 });
      }
    }

    // Build update object
    const updateData: any = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (password && password.trim()) {
      // Use bcrypt (matching login and create routes)
      updateData.password = await bcrypt.hash(password, 10);
    }
    if (permissions) {
      updateData.permissions = JSON.stringify(permissions);
    }
    if (active !== undefined) updateData.active = active;

    const updated = await prisma.user.update({
      where: { id: staffId },
      data: updateData,
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
      ...updated,
      permissions: JSON.parse(updated.permissions),
    });
  } catch (e) {
    console.error('[STAFF API] Error updating staff:', e instanceof Error ? e.message : String(e));
    return NextResponse.json({ 
      error: 'Failed to update staff member',
      details: e instanceof Error ? e.message : String(e)
    }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const staffId = parseInt(id);
    
    if (isNaN(staffId)) {
      return NextResponse.json({ error: 'Invalid staff ID' }, { status: 400 });
    }

    await prisma.user.delete({ where: { id: staffId } });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[STAFF API] Error deleting staff:', e);
    return NextResponse.json({ error: 'Failed to delete staff member' }, { status: 500 });
  }
}
