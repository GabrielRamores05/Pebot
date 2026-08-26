import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Used by the Docker HEALTHCHECK (see Dockerfile). Intentionally dependency-
// free: it must answer even while Postgres or Prisma are still warming up,
// otherwise the container gets marked unhealthy and restarted mid-boot.
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}
