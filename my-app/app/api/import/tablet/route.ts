import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { badRequest, forbidden, unauthorized, serverError } from '@/lib/api-response';
import {
  clearUnknownSupplierLinks,
  normalizeTransactionRow,
  numberFromExport,
  supplierIdFromExport,
} from '@/modules/tablet/ingest';

export const maxDuration = 60;

/**
 * POST /api/import/tablet — import a CaféOS tablet export into the PC ledger.
 *
 * Spec 014 T025 / contracts/bridge-schema.md:
 * - parents (suppliers, ingredients) are inserted/updated before transactions;
 * - ingredient rows carry the supplier link (`lastSupplierId` on the tablet →
 *   the web `supplierId` column);
 * - every ledger row (PURCHASE incl. supplier-linked `referenceType`/
 *   `referenceId`, ADJUSTMENT, VOID_PURCHASE, …) is imported as-is and
 *   append-only: rows already present are left untouched on re-import;
 * - a purchase referencing an unknown supplier keeps its row but its supplier
 *   link is cleared — never dropped as a record; legacy rows without reference
 *   fields import unchanged.
 * The whole import runs in one transaction so a failure never leaves a partial
 * snapshot behind.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return unauthorized();
    if (!requireRole(user, ['ADMIN'])) return forbidden();

    const formData = await req.formData();
    const file = formData.get('export') as File | null;

    if (!file) {
      return badRequest('No export file provided');
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    let data: any;
    try {
      data = JSON.parse(bytes.toString('utf-8'));
    } catch {
      return badRequest('Invalid JSON file');
    }

    if (data.version !== 1) {
      return badRequest(`Unsupported export version: ${data.version}`);
    }

    if (!data.orders || !Array.isArray(data.orders)) {
      return badRequest('Invalid export format: missing orders array');
    }

    const result = {
      orders: 0,
      orderItems: 0,
      payments: 0,
      products: 0,
      ingredients: 0,
      suppliers: 0,
      ingredientTransactions: 0,
      clearedSupplierLinks: 0,
      skipped: 0,
    };

    await prisma.$transaction(async (tx) => {
      // Suppliers (parents) first, so ingredient + transaction links resolve.
      const knownSupplierIds = new Set<number>();
      if (data.suppliers && Array.isArray(data.suppliers)) {
        for (const s of data.suppliers) {
          if (!Number.isInteger(Number(s?.id)) || Number(s.id) <= 0) {
            result.skipped++;
            continue;
          }
          const supplierId = Number(s.id);
          knownSupplierIds.add(supplierId);
          await tx.supplier.upsert({
            where: { id: supplierId },
            update: {
              name: typeof s.name === 'string' ? s.name : undefined,
              contactPerson: s.contactPerson ?? null,
              phone: s.phone ?? null,
              email: s.email ?? null,
              address: s.address ?? null,
              notes: s.notes ?? null,
              status: s.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
            },
            create: {
              id: supplierId,
              name: typeof s.name === 'string' ? s.name : `Supplier ${supplierId}`,
              contactPerson: s.contactPerson ?? null,
              phone: s.phone ?? null,
              email: s.email ?? null,
              address: s.address ?? null,
              notes: s.notes ?? null,
              status: s.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
            },
          });
          result.suppliers++;
        }
      }

      // Products
      if (data.products && Array.isArray(data.products)) {
        for (const p of data.products) {
          const existing = await tx.product.findFirst({ where: { name: p.name } });
          if (existing) {
            await tx.product.update({ where: { id: existing.id }, data: { price: p.price, available: p.available } });
            result.products++;
          } else {
            await tx.product.create({ data: { name: p.name, price: p.price, available: p.available, categoryId: p.categoryId } });
            result.products++;
          }
        }
      }

      // Categories
      if (data.categories && Array.isArray(data.categories)) {
        for (const c of data.categories) {
          await tx.category.upsert({ where: { id: c.id }, update: { name: c.name, icon: c.icon, sortOrder: c.sortOrder }, create: { name: c.name, icon: c.icon, sortOrder: c.sortOrder } });
        }
      }

      // Ingredients (after suppliers). Tablet rows use `lastSupplierId`; the web
      // stores the same latest-supplier cache in `supplierId`.
      if (data.ingredients && Array.isArray(data.ingredients)) {
        for (const ing of data.ingredients) {
          const supplierId = supplierIdFromExport(ing ?? {});
          const upsertData: Record<string, unknown> = {
            name: typeof ing.name === 'string' ? ing.name : `Ingredient ${ing.id}`,
            currentStock: numberFromExport(ing.currentStock),
            minStock: numberFromExport(ing.minStock),
            costPerUnit: numberFromExport(ing.costPerUnit),
            ...(supplierId !== undefined ? { supplierId } : {}),
          };
          const ingredientId = Number(ing.id);
          if (!Number.isInteger(ingredientId) || ingredientId <= 0) {
            result.skipped++;
            continue;
          }
          await tx.ingredient.upsert({
            where: { id: ingredientId },
            update: upsertData,
            create: {
              id: ingredientId,
              name: (upsertData.name as string) ?? `Ingredient ${ingredientId}`,
              baseUnit: typeof ing.baseUnit === 'string' && ing.baseUnit ? ing.baseUnit : 'g',
              ...upsertData,
              purchaseUnit:
                typeof ing.purchaseUnit === 'string' && ing.purchaseUnit
                  ? ing.purchaseUnit
                  : typeof ing.baseUnit === 'string' && ing.baseUnit
                    ? ing.baseUnit
                    : 'g',
              category: typeof ing.category === 'string' ? ing.category : 'General',
            } as any,
          });
          result.ingredients++;
        }
      }

      // Ingredient ledger (after parents). Append-only and idempotent.
      if (data.ingredientTransactions && Array.isArray(data.ingredientTransactions)) {
        const normalized = data.ingredientTransactions
          .map((raw: any) => normalizeTransactionRow(raw ?? {}))
          .filter((row: any) => row !== null);
        const { rows, clearedSupplierLinks } = clearUnknownSupplierLinks(normalized, knownSupplierIds);
        result.clearedSupplierLinks += clearedSupplierLinks;

        for (const row of rows) {
          // Never insert a transaction whose ingredient parent does not exist —
          // an FK failure would roll back the whole import.
          const parent = await tx.ingredient.findUnique({ where: { id: row.ingredientId }, select: { id: true } });
          if (!parent) {
            result.skipped++;
            continue;
          }
          if (row.id != null) {
            const existing = await tx.ingredientTransaction.findUnique({ where: { id: row.id }, select: { id: true } });
            if (existing) {
              result.skipped++;
              continue;
            }
          }
          await tx.ingredientTransaction.create({
            data: {
              ...(row.id != null ? { id: row.id } : {}),
              ingredientId: row.ingredientId,
              type: row.type || 'ADJUSTMENT',
              quantity: row.quantity,
              referenceId: row.referenceId,
              referenceType: row.referenceType,
              purchaseUnit: row.purchaseUnit,
              purchaseCost: row.purchaseCost,
              unitCost: row.unitCost,
              notes: row.notes,
              ...(row.createdAt ? { createdAt: row.createdAt } : {}),
            } as any,
          });
          result.ingredientTransactions++;
        }
      }

      // Orders
      for (const o of data.orders) {
        const existing = await tx.order.findUnique({ where: { orderNumber: o.orderNumber } });
        if (existing) {
          result.skipped++;
          continue;
        }

        const order = await tx.order.create({
          data: {
            orderNumber: o.orderNumber,
            customerName: o.customerName,
            status: o.status,
            totalAmount: o.totalAmount,
            paymentMethod: o.paymentMethod,
            orderType: o.orderType,
            barcodeValue: o.barcodeValue || `IMPORT-${o.orderNumber}`,
            createdAt: new Date(o.createdAt),
          }
        });
        result.orders++;

        // Order items
        const orderItems = (data.orderItems || []).filter((oi: any) => oi.orderId === o.id);
        for (const oi of orderItems) {
          const product = await tx.product.findFirst({ where: { name: oi.product?.name } });
          if (!product) continue;

          const selections = (oi.options || []).map((opt: any) => `${opt.name}:${opt.value}`).join(';');

          const item = await tx.orderItem.create({
            data: {
              orderId: order.id,
              productId: product.id,
              quantity: oi.quantity,
              unitPrice: oi.unitPrice,
              subtotal: oi.subtotal,
              selections: selections || null,
            }
          });
          result.orderItems++;
        }

        // Payments
        const orderPayments = (data.payments || []).filter((p: any) => p.orderId === o.id);
        for (const p of orderPayments) {
          await tx.paymentTransaction.create({
            data: {
              orderId: order.id,
              amount: p.amountTendered,
              method: p.method,
              status: 'COMPLETED',
              processedAt: new Date(p.createdAt),
            }
          });
          result.payments++;
        }
      }
    });

    return NextResponse.json({ imported: result });
  } catch (error) {
    console.error('Tablet import error:', error);
    return serverError(error, 'Failed to import tablet data');
  }
}
