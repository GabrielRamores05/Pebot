import { NextRequest, NextResponse } from 'next/server';
import { ValidationError } from 'zod-validation-error';
import { requirePermission } from '@/lib/auth';
import { badRequest, serverError, unauthorized } from '@/lib/api-response';
import { DEFAULT_PAYROLL_RATES } from '@/lib/payroll-rates';
import { getPayrollRates, savePayrollRates } from '@/modules/finance/service';

// GET/PUT /api/payroll/rates — government payroll rates (SSS, PhilHealth, Pag-IBIG, BIR).
export async function GET(req: NextRequest) {
  const user = await requirePermission(req, 'staff');
  if (!user) return unauthorized();
  try {
    return NextResponse.json({ rates: await getPayrollRates(), defaults: DEFAULT_PAYROLL_RATES });
  } catch (e) {
    return serverError(e, 'Could not read the payroll rates');
  }
}

export async function PUT(req: NextRequest) {
  const user = await requirePermission(req, 'staff');
  if (!user) return unauthorized();
  try {
    return NextResponse.json({ rates: await savePayrollRates(await req.json()) });
  } catch (e) {
    if (e instanceof ValidationError) return badRequest(e.message);
    return serverError(e, 'Could not save the payroll rates');
  }
}
