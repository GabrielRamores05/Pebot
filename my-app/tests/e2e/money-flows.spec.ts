import { expect, test, type APIRequestContext } from '@playwright/test';
import { computeCheckout } from '../../lib/checkout';

/**
 * Money flows against a running, activated Pebot (seeded database).
 * Run before every release:  PEBOT_URL=http://localhost:3000 npm run test:e2e
 * Uses the seed admin; change PEBOT_EMAIL / PEBOT_PASSWORD for other data.
 * It creates orders, so never point it at a restaurant's real database.
 */

const EMAIL = process.env.PEBOT_EMAIL ?? 'admin@cafeos.local';
const PASSWORD = process.env.PEBOT_PASSWORD ?? 'admin123';
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

test.describe.configure({ mode: 'serial' });

let api: APIRequestContext;
let me: { userId: number };
let product: { id: number; price: number; name: string };
let settings: { vatRegistered: boolean; vatRate: number; serviceChargeRate: number; serviceChargeOrderTypes: string };

async function ok<T>(res: Awaited<ReturnType<APIRequestContext['get']>>): Promise<T> {
  if (!res.ok()) throw new Error(`${res.url()} → ${res.status()} ${await res.text()}`);
  return (await res.json()) as T;
}

async function order(body: Record<string, unknown>) {
  return ok<{ id: number; orderNumber: string; totalAmount: number; grossAmount: number; discountAmount: number; vatRemoved: number; serviceCharge: number; status: string }>(
    await api.post('/api/orders', {
      data: { customerName: 'QA', items: [{ productId: product.id, quantity: 2 }], paymentMethod: 'CASH', paymentConfirmed: true, overrideStock: true, orderType: 'TAKEOUT', ...body },
    }),
  );
}

test.beforeAll(async ({ playwright, baseURL }) => {
  api = await playwright.request.newContext({ baseURL });
  const login = await ok<{ user: { userId: number } }>(await api.post('/api/auth/login', { data: { email: EMAIL, password: PASSWORD } }));
  me = login.user;
  const products = await ok<{ id: number; price: number; name: string; available?: boolean }[]>(await api.get('/api/products'));
  product = products.find((p) => p.price > 0 && p.available !== false) ?? products[0];
  settings = await ok(await api.get('/api/settings/business'));
});

test.afterAll(async () => api?.dispose());

test('a paid cash sale is counted in End of Day', async () => {
  const before = await ok<{ summary: { net: number; orderCount: number } }>(await api.get(`/api/reports/end-of-day?date=${today()}`));
  const o = await order({});
  expect(o.totalAmount).toBeGreaterThan(0);
  const after = await ok<{ summary: { net: number; orderCount: number } }>(await api.get(`/api/reports/end-of-day?date=${today()}`));
  expect(after.summary.orderCount).toBe(before.summary.orderCount + 1);
  expect(after.summary.net).toBeCloseTo(before.summary.net + o.totalAmount, 2);
});

test('Senior discount: VAT removed on the holder share, then 20%, matches the checkout rules', async () => {
  const o = await order({ discount: { kind: 'STATUTORY', diners: 2, holders: [{ type: 'SENIOR', name: 'Lola QA', idNumber: 'SC-0001' }] } });
  const expected = computeCheckout({
    lines: [{ amount: product.price * 2, vatExempt: false }],
    discount: { kind: 'SENIOR', holders: 1, diners: 2 },
    vatRegistered: settings.vatRegistered,
    vatRate: settings.vatRate,
    serviceChargeRate: 0,
  });
  expect(o.discountAmount).toBeCloseTo(expected.discount, 2);
  expect(o.vatRemoved).toBeCloseTo(expected.vatRemoved, 2);
  expect(o.totalAmount).toBeCloseTo(expected.total, 2);
  expect(o.totalAmount).toBeLessThan(product.price * 2);
});

test('a staff discount cannot be sent without signing in', async ({ playwright, baseURL }) => {
  const guest = await playwright.request.newContext({ baseURL });
  const res = await guest.post('/api/orders', {
    data: { customerName: 'Guest', items: [{ productId: product.id, quantity: 1 }], discount: { kind: 'STUDENT' }, paymentConfirmed: true },
  });
  expect(res.status()).toBeGreaterThanOrEqual(400);
  await guest.dispose();
});

test('void needs a manager PIN; a wrong PIN changes nothing; the refund shows in End of Day', async () => {
  await ok(await api.put(`/api/staff/${me.userId}`, { data: { pin: '4821' } }));
  const o = await order({});

  const wrong = await api.post(`/api/orders/${o.id}/void`, { data: { reason: 'Wrong dish', pin: '0000' } });
  expect(wrong.status()).toBe(403);

  const voided = await ok<{ status: string; refundAmount: number }>(await api.post(`/api/orders/${o.id}/void`, { data: { reason: 'Wrong dish', pin: '4821' } }));
  expect(voided.status).toBe('CANCELLED');
  expect(voided.refundAmount).toBeCloseTo(o.totalAmount, 2);

  const again = await api.post(`/api/orders/${o.id}/void`, { data: { reason: 'Again', pin: '4821' } });
  expect(again.status()).toBe(409);

  const eod = await ok<{ summary: { voids: { orderNumber: string; refund: number }[] } }>(await api.get(`/api/reports/end-of-day?date=${today()}`));
  expect(eod.summary.voids.find((v) => v.orderNumber === o.orderNumber)?.refund).toBeCloseTo(o.totalAmount, 2);
});

test('waste is saved on the ingredient and shows in the profit report', async () => {
  const ings = await ok<{ id: number; currentStock: number; costPerUnit: number }[] | { ingredients: { id: number; currentStock: number; costPerUnit: number }[] }>(await api.get('/api/ingredients'));
  const list = Array.isArray(ings) ? ings : ings.ingredients;
  const ing = list.find((i) => i.currentStock >= 10 && i.costPerUnit > 0);
  test.skip(!ing, 'No ingredient with stock and cost in this database');
  const before = await ok<{ waste: number }>(await api.get(`/api/reports/profit?from=${today()}&to=${today()}`));
  await ok(await api.post('/api/ingredients/bulk-adjust', { data: { rows: [{ ingredientId: ing!.id, adjustment: -5 }], notes: 'Waste: Spoiled — QA' } }));
  const after = await ok<{ waste: number; netSales: number; netProfit: number }>(await api.get(`/api/reports/profit?from=${today()}&to=${today()}`));
  expect(after.waste).toBeCloseTo(before.waste + 5 * ing!.costPerUnit, 2);
  expect(after.netSales).toBeGreaterThan(0);
});

test('a stock count below zero is refused and nothing changes', async () => {
  const ings = await ok<{ id: number; currentStock: number }[] | { ingredients: { id: number; currentStock: number }[] }>(await api.get('/api/ingredients'));
  const ing = (Array.isArray(ings) ? ings : ings.ingredients)[0];
  const res = await api.post('/api/ingredients/bulk-adjust', { data: { rows: [{ ingredientId: ing.id, adjustment: -(ing.currentStock + 1000) }], notes: 'Stock count' } });
  expect(res.status()).toBe(400);
});

test('cash drawer: open, count, close with the expected cash', async () => {
  const current = await api.get('/api/cash-drawer');
  const open = current.ok() ? ((await current.json()) as { current?: { id: number } | null }).current : null;
  if (open?.id) await api.post(`/api/cash-drawer/close`, { data: { countedCash: 0 } });
  await ok(await api.post('/api/cash-drawer', { data: { openingCash: 1000 } }));
  const sale = await order({});
  const closed = await ok<{ expectedCash?: number; expected?: number; difference?: number }>(await api.post('/api/cash-drawer/close', { data: { countedCash: 1000 + sale.totalAmount } }));
  const diff = closed.difference ?? 0;
  expect(Math.abs(diff)).toBeLessThan(0.01);
});

test('payroll: holidays, run for everyone and 13th month answer without errors', async () => {
  const year = new Date().getFullYear();
  const holidays = await ok<{ date: string; type: string }[]>(await api.get(`/api/holidays?year=${year}`));
  expect(holidays.some((h) => h.date === `${year}-12-25` && h.type === 'REGULAR_HOLIDAY')).toBe(true);
  const run = await ok<{ created: number; skipped: unknown[] }>(await api.post('/api/payroll/batch', { data: { periodStart: `${year}-01-01`, periodEnd: `${year}-01-15`, includeServiceCharge: true } }));
  expect(run.created + run.skipped.length).toBeGreaterThan(0);
  const thirteenth = await ok<{ total: number; staff: unknown[] }>(await api.get(`/api/payroll/thirteenth-month?year=${year}`));
  expect(thirteenth.total).toBeGreaterThanOrEqual(0);
  const balances = await ok<unknown[]>(await api.get(`/api/leave-balances?year=${year}`));
  expect(Array.isArray(balances)).toBe(true);
});

test('backup now writes a copy and reports it', async () => {
  const r = await ok<{ lastFiles: string[]; lastError: string | null }>(await api.post('/api/backup/auto'));
  expect(r.lastError).toBeNull();
  expect(r.lastFiles.length).toBeGreaterThan(0);
});
