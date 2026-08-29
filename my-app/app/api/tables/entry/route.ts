import { NextRequest, NextResponse } from 'next/server';
import { enterTable } from '@/modules/tables/service';
import { badRequest, notFound, serverError } from '@/lib/api-response';
import { ValidationError } from 'zod-validation-error';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await enterTable(body);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof ValidationError) {
      return badRequest(e.message);
    }
    const status = (e as { status?: number })?.status ?? 500;
    if (status === 404) {
      return notFound(String(e));
    }
    if (status === 400) {
      return NextResponse.json({ error: String(e) }, { status: 400 });
    }
    return serverError(e);
  }
}
