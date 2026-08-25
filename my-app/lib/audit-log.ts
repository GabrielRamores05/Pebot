import { prisma } from '@/lib/prisma';
import { getAuthUser, JWTPayload } from '@/lib/auth';
import { NextRequest } from 'next/server';

export interface LogActionParams {
  userId?: number | null;
  action: string;
  resource: string;
  resourceId?: number | null;
  details?: Record<string, unknown> | string | null;
  req?: NextRequest;
}

export async function logAction(params: LogActionParams): Promise<void> {
  try {
    let user: JWTPayload | null = null;
    if (params.req) {
      user = await getAuthUser(params.req);
    }

    const userId = params.userId ?? user?.userId ?? null;
    const ip = params.req?.ip ?? params.req?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;

    await prisma.auditLog.create({
      data: {
        userId,
        action: params.action,
        resource: params.resource,
        resourceId: params.resourceId ?? undefined,
        details: typeof params.details === 'string' ? params.details : params.details ? JSON.stringify(params.details) : undefined,
        ip: ip ?? undefined,
      },
    });
  } catch (e) {
    console.error('[AUDIT LOG] Failed to write audit log:', e);
  }
}
