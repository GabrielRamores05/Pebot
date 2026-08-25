import { NextRequest, NextResponse } from 'next/server';
import { verifyTokenAsync } from './lib/auth';

// Allow all authenticated STAFF users to access admin pages
// Permission filtering is done on the client-side in the layout

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only protect /admin routes
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  const token = req.cookies.get('cafeos-token')?.value;
  if (!token) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const user = await verifyTokenAsync(token);
  if (!user) {
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  // Allow ADMIN and STAFF roles
  if (!['ADMIN', 'STAFF'].includes(user.role)) {
    return NextResponse.redirect(new URL('/unauthorized', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
