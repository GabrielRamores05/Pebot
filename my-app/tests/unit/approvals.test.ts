import { describe, expect, it } from 'vitest';
import { canApprove, isValidPin, pinProblem, refundDrawerMovement } from '@/lib/approvals';

describe('PINs (spec 020)', () => {
  it('accepts 4 to 6 digits', () => {
    expect(isValidPin('4821')).toBe(true);
    expect(isValidPin('905173')).toBe(true);
  });
  it('refuses wrong lengths, letters and easy guesses', () => {
    for (const pin of ['123', '1234567', '12a4', '', '0000', '1111', '1234', '123456', '4321']) {
      expect(isValidPin(pin)).toBe(false);
    }
  });
  it('explains what is wrong', () => {
    expect(pinProblem('12')).toMatch(/4 to 6 digits/);
    expect(pinProblem('1111')).toMatch(/too easy/);
    expect(pinProblem('4821')).toBeNull();
  });
});

describe('canApprove', () => {
  it('lets the owner and managers approve voids', () => {
    expect(canApprove({ role: 'ADMIN', position: null, active: true })).toBe(true);
    expect(canApprove({ role: 'STAFF', position: 'Manager', active: true })).toBe(true);
    expect(canApprove({ role: 'STAFF', position: 'Shift Supervisor', active: true })).toBe(true);
  });
  it('does not let cashiers or inactive staff approve', () => {
    expect(canApprove({ role: 'STAFF', position: 'Cashier', active: true })).toBe(false);
    expect(canApprove({ role: 'ADMIN', position: null, active: false })).toBe(false);
  });
});

describe('refundDrawerMovement', () => {
  const paidCash = { paidAt: new Date(), paymentMethod: 'CASH', cashSessionId: 3, totalAmount: 250, orderNumber: 'ORD-1-A001' };
  it('needs no movement when the sale was counted in the drawer that is open now', () => {
    expect(refundDrawerMovement(paidCash, 3, 'Wrong order')).toBeNull();
  });
  it('pays the refund out of the open drawer when the sale was counted elsewhere', () => {
    expect(refundDrawerMovement({ ...paidCash, cashSessionId: 1 }, 3, 'Wrong order')).toEqual({
      kind: 'OUT', amount: 250, reason: 'Refund ORD-1-A001: Wrong order',
    });
    expect(refundDrawerMovement({ ...paidCash, cashSessionId: null }, 3, 'Cold food')).toMatchObject({ kind: 'OUT', amount: 250 });
  });
  it('does nothing for unpaid orders, non-cash payments or when no drawer is open', () => {
    expect(refundDrawerMovement({ ...paidCash, paidAt: null }, 3, 'x')).toBeNull();
    expect(refundDrawerMovement({ ...paidCash, paymentMethod: 'GCASH', cashSessionId: 1 }, 3, 'x')).toBeNull();
    expect(refundDrawerMovement({ ...paidCash, cashSessionId: 1 }, null, 'x')).toBeNull();
  });
});
