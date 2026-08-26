import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Caddy's on-demand TLS "ask" endpoint (see deploy/Caddyfile): before Let's
// Encrypt issues a certificate for any hostname, Caddy asks this route whether
// the app recognises it. Any 2xx answer allows issuance; anything else denies.
// This is what stops a stranger from pointing DNS at the box and burning the
// Let's Encrypt rate limit for every domain on it.

export async function GET(request: NextRequest) {
  const host = (request.headers.get('host') ?? '')
    .toLowerCase()
    .split(':')[0];
  const domain = (process.env.APP_DOMAIN ?? '').toLowerCase().trim();

  // Fail closed: with no domain configured nothing is ever recognised.
  if (!domain || !host) {
    return new NextResponse(null, { status: 404 });
  }

  const allowed =
    host === domain ||
    host === `www.${domain}` ||
    host.endsWith(`.${domain}`);

  if (!allowed) {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.json({ allowed: true, host });
}
