import { describe, expect, it } from 'vitest';
import { summarizeProfit } from '@/lib/profit';
import { csvFileName, toCsv } from '@/lib/csv';
import { countAdjustments, isWasteNote, wasteAdjustments, wasteNote } from '@/lib/stock-count';

describe('summarizeProfit (spec 022)', () => {
  it('works out sales, cost of goods, labor, expenses and margins', () => {
    const p = summarizeProfit({
      orders: [
        { paid: true, status: 'COMPLETED', totalAmount: 1100, serviceCharge: 100 },
        { paid: true, status: 'COMPLETED', totalAmount: 500, refundAmount: 100 },
        { paid: false, status: 'PENDING', totalAmount: 999 },
        { paid: true, status: 'CANCELLED', totalAmount: 300 },
      ],
      usage: [{ quantity: -1000, unitCost: 0.3 }, { quantity: 100, unitCost: 0.3 }],
      waste: [{ quantity: -50, unitCost: 1 }],
      expenses: [{ amount: 200, category: 'Rent' }, { amount: 50, category: 'Utilities' }, { amount: 100, category: 'Rent' }],
      payroll: [{ grossPay: 500, serviceChargeShare: 100, employerCost: 40 }],
    });
    expect(p).toMatchObject({
      orderCount: 2, grossSales: 1600, refunds: 100, serviceCharge: 100, netSales: 1400,
      costOfGoods: 270, grossProfit: 1130, waste: 50, labor: 440, expenses: 350, netProfit: 290,
    });
    expect(p.grossMargin).toBe(80.71);
    expect(p.netMargin).toBe(20.71);
    expect(p.expenseByCategory[0]).toEqual({ category: 'Rent', amount: 300 });
  });
  it('has no margin when there are no sales', () => {
    const p = summarizeProfit({ orders: [], usage: [], waste: [], expenses: [{ amount: 10, category: 'X' }], payroll: [] });
    expect(p.netProfit).toBe(-10);
    expect(p.netMargin).toBeNull();
  });
});

describe('toCsv', () => {
  it('quotes, escapes and blocks spreadsheet formulas', () => {
    const csv = toCsv(
      [{ a: 'Juan, "JD"', b: 12.5, c: '=SUM(A1)' }, { a: null, b: 0, c: 'line\nbreak' }],
      [{ label: 'Name', value: (r) => r.a }, { label: 'Amount', value: (r) => r.b }, { label: 'Note', value: (r) => r.c }],
    );
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.slice(1).split('\r\n')).toEqual(['Name,Amount,Note', '"Juan, ""JD""",12.5,\'=SUM(A1)', ',0,"line\nbreak"', '']);
  });
  it('makes a safe file name', () => {
    expect(csvFileName('Order History', new Date(2026, 10, 14))).toBe('order-history-2026-11-14.csv');
  });
});

describe('stock counts and waste', () => {
  const ings = [
    { id: 1, name: 'Rice', currentStock: 10000, costPerUnit: 0.05, baseUnit: 'g' },
    { id: 2, name: 'Eggs', currentStock: 30, costPerUnit: 8, baseUnit: 'pcs' },
  ];
  it('turns counts into corrections and values the difference', () => {
    const r = countAdjustments(ings, { 1: '9000', 2: '30' });
    expect(r).toMatchObject({ ok: true, rows: [{ ingredientId: 1, adjustment: -1000 }], value: -50 });
  });
  it('rejects negative counts and says when nothing changed', () => {
    expect(countAdjustments(ings, { 2: '-1' })).toMatchObject({ ok: false });
    expect(countAdjustments(ings, { 2: '30' })).toMatchObject({ ok: false, error: expect.stringContaining('matches') });
  });
  it('turns waste into negative corrections, never more than in stock', () => {
    expect(wasteAdjustments(ings, { 2: '6' })).toMatchObject({ ok: true, rows: [{ ingredientId: 2, adjustment: -6 }], value: -48 });
    expect(wasteAdjustments(ings, { 2: '31' })).toMatchObject({ ok: false });
    expect(wasteAdjustments(ings, { 2: '0' })).toMatchObject({ ok: false });
  });
  it('marks waste notes so reports can find them', () => {
    expect(wasteNote('Spoiled', 'fridge broke')).toBe('Waste: Spoiled — fridge broke');
    expect(isWasteNote(wasteNote('Expired'))).toBe(true);
    expect(isWasteNote('Stock count')).toBe(false);
  });
});
