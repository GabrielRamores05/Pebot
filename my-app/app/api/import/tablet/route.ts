import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, requireRole } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { apiError, badRequest, forbidden, unauthorized, serverError } from '@/lib/api-response';

export const maxDuration = 60;

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

    const result = { orders: 0, orderItems: 0, payments: 0, products: 0, ingredients: 0, skipped: 0 };

    await prisma.$transaction(async (tx) => {
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

      // Ingredients
      if (data.ingredients && Array.isArray(data.ingredients)) {
        for (const ing of data.ingredients) {
          await tx.ingredient.upsert({ where: { id: ing.id }, update: { name: ing.name, currentStock: ing.currentStock, minStock: ing.minStock }, create: { name: ing.name, currentStock: ing.currentStock, minStock: ing.minStock, baseUnit: ing.baseUnit, costPerUnit: ing.costPerUnit } });
          result.ingredients++;
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
