import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';

const VOICE_KEY = 'voiceSettings';

// GET /api/settings/voice — public (customers need this)
export async function GET() {
  const row = await prisma.setting.findUnique({ where: { key: VOICE_KEY } });
  if (!row) return NextResponse.json({});
  try {
    return NextResponse.json(JSON.parse(row.value));
  } catch (e) {
    // Stored value is corrupt — fall back to defaults, but leave a trace so it
    // can be repaired instead of silently never applying.
    console.error(`[SETTINGS] Corrupt "${VOICE_KEY}" value, falling back to defaults:`, e);
    return NextResponse.json({});
  }
}

// POST /api/settings/voice — admin only
export async function POST(req: NextRequest) {
  const me = await getAuthUser(req);
  if (!me || me.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

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
