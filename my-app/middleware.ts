import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// Route-level protection for the staff/admin areas. The admin UI also has a
// client-side guard, but that only runs after the RSC payload is delivered —
// this middleware stops unauthenticated visitors at the edge.
//
// If JWT_SECRET is not configured (dev fallback generates an ephemeral secret in
// lib/auth.ts that middleware cannot share), enforcement is skipped so we never
// lock a running dev instance out; the client guard still redirects.
const PROTECTED = /^\/(admin(\/.*)?|kitchen)$/;

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!PROTECTED.test(pathname)) return NextResponse.next();

  const secretValue = process.env.JWT_SECRET?.trim();
  if (!secretValue) return NextResponse.next();

  const token = req.cookies.get('cafeos-token')?.value;
  let authenticated = false;
  if (token) {
    try {
      await jwtVerify(token, new TextEncoder().encode(secretValue));
      authenticated = true;
    } catch {
      authenticated = false;
    }
  }

  if (!authenticated) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/kitchen'],
};
