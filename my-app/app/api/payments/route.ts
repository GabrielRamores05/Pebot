import { NextRequest, NextResponse } from 'next/server';
import { createPayment, listPayments } from '@/modules/finance/service';
import { notFound, serverError, unauthorized } from '@/lib/api-response';
import { getAuthUser } from '@/lib/auth';
import { ValidationError } from 'zod-validation-error';

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  try {
    const body = await req.json();
    const payment = await createPayment(body);
    return NextResponse.json(payment, { status: 201 });
  } catch (e) {
    if (e instanceof ValidationError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    const status = (e as { status?: number })?.status ?? 500;
    if (status === 404) return notFound(String(e));
    return serverError(e);
  }
}

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return unauthorized();

  try {
    const payments = await listPayments();
    return NextResponse.json(payments);
  } catch (e) {
    return serverError(e);
  }
}
