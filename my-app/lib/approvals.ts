/**
 * Manager approvals (spec 020): PIN rules, who may approve, and how a refund
 * affects the cash drawer.
 */

const EASY = new Set(['0123', '1234', '12345', '123456', '4321', '54321', '654321', '1212', '2580', '0852']);

/** Why a PIN is not acceptable, or null when it is. */
export function pinProblem(pin: string): string | null {
  if (!/^\d{4,6}$/.test(pin)) return 'Use 4 to 6 digits.';
  if (/^(\d)\1+$/.test(pin) || EASY.has(pin)) return 'That PIN is too easy to guess. Pick another.';
  return null;
}

export function isValidPin(pin: string): boolean {
  return pinProblem(pin) === null;
}

const APPROVER_POSITIONS = new Set(['Manager', 'Shift Supervisor']);

/** The owner/admin and managers may approve voids and refunds. */
export function canApprove(user: { role: string; position?: string | null; active: boolean }): boolean {
  if (!user.active) return false;
  return user.role === 'ADMIN' || APPROVER_POSITIONS.has(user.position ?? '');
}

/**
 * Cash to pay out of the open drawer for a voided order, or null.
 * A cash sale counted in the drawer that is open now simply stops counting
 * (cancelled orders are left out of expected cash), so no movement is needed.
 */
export function refundDrawerMovement(
  order: { paidAt: Date | string | null; paymentMethod: string; cashSessionId: number | null; totalAmount: number; orderNumber: string },
  openSessionId: number | null,
  reason: string,
): { kind: 'OUT'; amount: number; reason: string } | null {
  if (!order.paidAt || order.paymentMethod !== 'CASH' || openSessionId == null) return null;
  if (order.cashSessionId === openSessionId) return null;
  if (!(order.totalAmount > 0)) return null;
  return { kind: 'OUT', amount: Math.round(order.totalAmount * 100) / 100, reason: `Refund ${order.orderNumber}: ${reason}`.slice(0, 200) };
}
