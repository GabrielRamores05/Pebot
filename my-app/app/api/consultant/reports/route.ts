import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { badRequest, serverError, unauthorized } from '@/lib/api-response';

// GET /api/consultant/reports?type=sales&format=csv&days=30
// Types: sales, profitability, inventory, loyalty
// Formats: csv (default), json, pdf

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission(req, 'settings');
    if (!user) {
      return unauthorized();
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'sales';
    const format = searchParams.get('format') || 'csv';
    const days = parseInt(searchParams.get('days') || '30');

    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    const fileName = `${type}-report-${new Date().toISOString().slice(0, 10)}`;

    let csvContent = '';
    let jsonContent: any = {};

    switch (type) {
      case 'sales': {
        const orders = await prisma.order.findMany({
          where: {
            createdAt: { gte: dateFrom },
            status: { notIn: ['CANCELLED'] },
          },
          include: { items: { include: { product: { include: { category: true } } } } },
        });

        jsonContent = {
          type: 'sales',
          period: `Last ${days} days`,
          totalRevenue: orders.reduce((sum, o) => sum + Number(o.totalAmount), 0),
          totalOrders: orders.length,
          orders: orders.map((o) => ({
            orderNumber: o.orderNumber,
            customerName: o.customerName,
            status: o.status,
            totalAmount: o.totalAmount,
            paymentMethod: o.paymentMethod,
            createdAt: o.createdAt,
            items: o.items.map((i) => ({
              name: i.product.name,
              category: i.product.category?.name || 'Uncategorized',
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              subtotal: i.subtotal,
            })),
          })),
        };

        csvContent = [
          ['Date', 'Order #', 'Customer', 'Status', 'Total', 'Payment Method'].join(','),
          ...orders.map((o) =>
            [
              new Date(o.createdAt).toISOString().split('T')[0],
              `"${o.orderNumber}"`,
              `"${o.customerName}"`,
              o.status,
              o.totalAmount.toFixed(2),
              o.paymentMethod || 'CASH',
            ].join(',')
          ),
        ].join('\n');
        break;
      }

      case 'profitability': {
        const orders = await prisma.order.findMany({
          where: {
            createdAt: { gte: dateFrom },
            status: { notIn: ['CANCELLED'] },
          },
          include: { items: { include: { product: true } } },
        });

        const productStats: Record<string, { name: string; revenue: number; cost: number; profit: number }> = {};

        for (const order of orders) {
          for (const item of order.items) {
            const name = item.product.name;
            if (!productStats[name]) {
              productStats[name] = { name, revenue: 0, cost: 0, profit: 0 };
            }
            productStats[name].revenue += Number(item.subtotal);
            productStats[name].cost += Number(item.product.capitalCost) * item.quantity;
            productStats[name].profit = productStats[name].revenue - productStats[name].cost;
          }
        }

        const products = Object.values(productStats);
        jsonContent = {
          type: 'profitability',
          period: `Last ${days} days`,
          totalRevenue: products.reduce((s, p) => s + p.revenue, 0),
          totalCost: products.reduce((s, p) => s + p.cost, 0),
          totalProfit: products.reduce((s, p) => s + p.profit, 0),
          products,
        };

        csvContent = [
          ['Product', 'Revenue', 'Cost', 'Profit', 'Margin %'].join(','),
          ...products.map((p) =>
            [
              `"${p.name}"`,
              p.revenue.toFixed(2),
              p.cost.toFixed(2),
              p.profit.toFixed(2),
              p.revenue > 0 ? ((p.profit / p.revenue) * 100).toFixed(1) : '0',
            ].join(',')
          ),
        ].join('\n');
        break;
      }

      case 'inventory': {
        const ingredients = await prisma.ingredient.findMany({
          include: { supplier: { select: { name: true } } },
        });

        jsonContent = {
          type: 'inventory',
          totalValue: ingredients.reduce((s, i) => s + i.currentStock * i.costPerUnit, 0),
          items: ingredients.map((i) => ({
            name: i.name,
            currentStock: i.currentStock,
            minStock: i.minStock,
            baseUnit: i.baseUnit,
            costPerUnit: i.costPerUnit,
            totalValue: i.currentStock * i.costPerUnit,
            supplier: i.supplier?.name || 'Unknown',
            status: i.currentStock <= i.minStock ? 'LOW' : 'OK',
          })),
        };

        csvContent = [
          ['Ingredient', 'Current Stock', 'Min Stock', 'Unit', 'Cost/Unit', 'Total Value', 'Supplier', 'Status'].join(','),
          ...ingredients.map((i) =>
            [
              `"${i.name}"`,
              i.currentStock.toFixed(2),
              i.minStock.toFixed(2),
              i.baseUnit,
              i.costPerUnit.toFixed(2),
              (i.currentStock * i.costPerUnit).toFixed(2),
              `"${i.supplier?.name || 'Unknown'}"`,
              i.currentStock <= i.minStock ? 'LOW' : 'OK',
            ].join(',')
          ),
        ].join('\n');
        break;
      }

      case 'loyalty': {
        const transactions = await prisma.loyaltyTransaction.findMany({
          where: { createdAt: { gte: dateFrom } },
          include: { card: true },
        });

        const cards = await prisma.loyaltyCard.findMany({
          include: { vouchers: true },
        });

        jsonContent = {
          type: 'loyalty',
          period: `Last ${days} days`,
          pointsEarned: transactions.filter((t) => t.type === 'EARNED').reduce((s, t) => s + t.points, 0),
          transactions,
          cards: cards.map((c) => ({
            customerName: c.customerName,
            loyaltyPoints: c.loyaltyPoints,
            paidCoffeesCount: c.paidCoffeesCount,
            activeVouchers: c.vouchers.filter((v) => v.status === 'ACTIVE').length,
          })),
        };

        csvContent = [
          ['Customer', 'Loyalty Points', 'Paid Coffees', 'Active Vouchers'].join(','),
          ...cards.map((c) =>
            [
              `"${c.customerName}"`,
              c.loyaltyPoints,
              c.paidCoffeesCount,
              c.vouchers.filter((v) => v.status === 'ACTIVE').length,
            ].join(',')
          ),
        ].join('\n');
        break;
      }

      default:
        return badRequest('Invalid report type');
    }

    if (format === 'csv') {
      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${fileName}.csv"`,
        },
      });
    }

    if (format === 'json') {
      return NextResponse.json(jsonContent);
    }

    if (format === 'pdf') {
      const pdfLines: string[] = [];
      pdfLines.push(`CAFÉOS REPORT: ${type.toUpperCase()}`);
      pdfLines.push(`Period: Last ${days} days`);
      pdfLines.push(`Generated: ${new Date().toISOString()}`);
      pdfLines.push('');

      if (type === 'sales') {
        jsonContent.orders.forEach((o: any) => {
          pdfLines.push(`#${o.orderNumber} - ${o.customerName} - ${o.status} - ₱${o.totalAmount.toFixed(2)}`);
        });
      } else if (type === 'profitability') {
        jsonContent.products.forEach((p: any) => {
          pdfLines.push(`${p.name}: Revenue ₱${p.revenue.toFixed(2)}, Cost ₱${p.cost.toFixed(2)}, Profit ₱${p.profit.toFixed(2)}`);
        });
      } else if (type === 'inventory') {
        jsonContent.items.forEach((i: any) => {
          pdfLines.push(`${i.name}: ${i.currentStock}${i.baseUnit} (Min: ${i.minStock}) - ₱${i.totalValue.toFixed(2)}`);
        });
      } else if (type === 'loyalty') {
        jsonContent.cards.forEach((c: any) => {
          pdfLines.push(`${c.customerName}: ${c.loyaltyPoints} points, ${c.activeVouchers} active vouchers`);
        });
      }

      const pdfBody = pdfLines.join('\n');
      const pdfContent = `BT\n/F1 10 Tf\n72 720 Td\n(${pdfBody.replace(/[()\\]/g, (m: string) => '\\' + m).replace(/\n/g, '\\n')}) Tj\nET`;
      const pdfDoc = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Font << /F1 5 0 R >> >>\nendobj\n4 0 obj\n<< /Length ${pdfContent.length} >>\nstream\n${pdfContent}\nendstream\nendobj\n5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000119 00000 n \n0000000271 00000 n \n0000000532 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n591\n%%EOF`;

      return new NextResponse(pdfDoc, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${fileName}.pdf"`,
        },
      });
    }

    return badRequest('Invalid format. Use csv, json, or pdf.');
  } catch (error) {
    return serverError(error, 'Failed to generate report');
  }
}
