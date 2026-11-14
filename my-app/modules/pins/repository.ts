import { prisma } from '@/lib/prisma';

// Staff PINs (spec 020). Hashes only; never the PIN itself.

export async function findActiveUsersWithPin() {
  return prisma.user.findMany({
    where: { active: true, pinHash: { not: null } },
    select: { id: true, name: true, email: true, role: true, position: true, active: true, permissions: true, pinHash: true },
  });
}

export async function setPinHash(userId: number, pinHash: string | null) {
  return prisma.user.update({ where: { id: userId }, data: { pinHash }, select: { id: true } });
}
