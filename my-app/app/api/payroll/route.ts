import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { computePhilippinePayroll } from '@/lib/philippine-payroll';

// GET /api/payroll?userId=X&status=DRAFT
export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'staff');
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  const status = searchParams.get('status');

  const where: Record<string, unknown> = {};
  if (userId) where.userId = Number(userId);
  if (status) where.status = status;

  const records = await prisma.payroll.findMany({
    where,
    include: { user: { select: { id: true, name: true, position: true, paymentType: true, hourlyRate: true, monthlySalary: true } } },
    orderBy: { periodEnd: 'desc' },
  });
  return NextResponse.json(records);
}

// POST /api/payroll — generate a payroll run for a period
// Body: { userId, periodStart, periodEnd, overtimeRate?, deductions? }
export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'staff');
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { userId, periodStart, periodEnd, deductions, overtimeRate } = body;
    if (!userId || !periodStart || !periodEnd) {
      return NextResponse.json({ error: 'userId, periodStart, periodEnd required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return NextResponse.json({ error: 'Staff not found' }, { status: 404 });

    // Fetch attendance for the period
    const attendance = await prisma.attendance.findMany({
      where: { userId, clockOut: { not: null }, clockIn: { gte: new Date(periodStart), lte: new Date(periodEnd + 'T23:59:59') } },
    });

    let regularHours = 0;
    let overtimeHours = 0;
    const stdWeekly = 40; // 40h standard week
    for (const a of attendance) {
      const h = a.totalHours ?? 0;
      regularHours += Math.min(h, 8); // cap daily regular at 8h, overflow = overtime
      overtimeHours += Math.max(0, h - 8);
    }

    let grossPay = 0;
    let base = 0; // monthly basis for statutory contributions
    if (user.paymentType === 'SALARIED' && user.monthlySalary) {
      grossPay = user.monthlySalary;
      base = user.monthlySalary;
    } else if (user.hourlyRate) {
      const rate = user.hourlyRate;
      // Philippine overtime: +25% on an ordinary day (1.25x). Rest-day/holiday
      // premiums (1.30x) require per-day scheduling and are noted as a future
      // refinement; this is the ordinary-day baseline.
      const otRate = overtimeRate ?? rate * 1.25;
      grossPay = regularHours * rate + overtimeHours * otRate;
      base = grossPay; // period gross assumed to cover ~one month
    }

    const otherDeductions = deductions ?? 0;
    const result = computePhilippinePayroll({ grossPay, base, otherDeductions, overtimeHours });

    const payroll = await prisma.payroll.create({
      data: {
        userId, periodStart: new Date(periodStart), periodEnd: new Date(periodEnd),
        regularHours, overtimeHours, grossPay: result.grossPay,
        deductions: result.statutoryEmployeeTotal + result.withholdingTax + otherDeductions,
        netPay: result.netPay,
        breakdown: JSON.stringify(result),
        status: 'DRAFT', processedById: auth.userId,
      },
      include: { user: { select: { id: true, name: true, position: true } } },
    });
    return NextResponse.json(payroll, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to generate payroll' }, { status: 500 });
  }
}

// PUT /api/payroll — update status (PROCESSED / PAID): { id, status }
export async function PUT(req: NextRequest) {
  const auth = await requirePermission(req, 'staff');
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { id, status } = body;
    if (!id || !status) return NextResponse.json({ error: 'id and status required' }, { status: 400 });
    const updated = await prisma.payroll.update({ where: { id }, data: { status } });
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: 'Failed to update payroll' }, { status: 500 });
  }
}
