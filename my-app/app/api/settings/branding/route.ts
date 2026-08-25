import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';

// GET /api/settings/branding — returns { shopName, logoUrl }
export async function GET() {
  const settings = await prisma.setting.findMany({
    where: { key: { in: ['shopName', 'logoUrl'] } },
  });

  const map: Record<string, string> = {};
  for (const s of settings) map[s.key] = s.value;
  const rawLogoUrl = map.logoUrl;
  const logoUrl = rawLogoUrl && rawLogoUrl !== 'null' ? rawLogoUrl : null;

  return NextResponse.json({
    shopName: map.shopName ?? 'CaféOS',
    logoUrl,
  });
}

// POST /api/settings/branding — save { shopName?, logoUrl? }
export async function POST(req: NextRequest) {
  const me = await getAuthUser(req);
  if (!me || me.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();

  const updates: { key: string; value: string }[] = [];
  if (body.shopName !== undefined) updates.push({ key: 'shopName', value: String(body.shopName) });
  if (body.logoUrl !== undefined) {
    updates.push({ key: 'logoUrl', value: body.logoUrl === null ? '' : String(body.logoUrl) });
  }

  await Promise.all(
    updates.map((u) =>
      prisma.setting.upsert({
        where: { key: u.key },
        update: { value: u.value },
        create: { key: u.key, value: u.value },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
