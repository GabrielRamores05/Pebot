import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { guardAdmin } from '@/lib/api-guards';

const VOICE_KEY = 'voiceSettings';

// GET /api/settings/voice — public (customers need this)
export async function GET() {
  const row = await prisma.setting.findUnique({ where: { key: VOICE_KEY } });
  if (!row) return NextResponse.json({});
  try {
    return NextResponse.json(JSON.parse(row.value));
  } catch {
    return NextResponse.json({});
  }
}

// POST /api/settings/voice — admin only
export async function POST(req: NextRequest) {
  const { error } = await guardAdmin(req);
  if (error) return error;

  const body = await req.json();

  // Only allow known keys
  const allowed: Record<string, string> = {};
  for (const key of [
    'voiceName', 'rate', 'pitch', 'volume',
    'msgNewOrder', 'msgPreparing', 'msgCompleted', 'enabled',
  ]) {
    if (body[key] !== undefined) allowed[key] = body[key];
  }

  await prisma.setting.upsert({
    where: { key: VOICE_KEY },
    update: { value: JSON.stringify(allowed) },
    create: { key: VOICE_KEY, value: JSON.stringify(allowed) },
  });

  return NextResponse.json({ ok: true });
}
