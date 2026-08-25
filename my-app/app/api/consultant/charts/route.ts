import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';

// GET /api/consultant/charts?type=...&days=30
// Types: daily-sales, category-sales, product-revenue, inventory-status, loyalty-growth, order-status

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission(req, 'settings');
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'daily-sales';
    const days = parseInt(searchParams.get('days') || '30');

    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    switch (type) {
      case 'daily-sales': {
        const orders = await prisma.order.findMany({
          where: {
            createdAt: { gte: dateFrom },
            status: { notIn: ['CANCELLED'] },
          },
        });

        const dailyData: Record<string, number> = {};
        for (let i = 0; i <= days; i++) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const key = d.toISOString().slice(0, 10);
          dailyData[key] = 0;
        }

        orders.forEach((o) => {
          const key = new Date(o.createdAt).toISOString().slice(0, 10);
          dailyData[key] = (dailyData[key] || 0) + Number(o.totalAmount);
        });

        const labels = Object.keys(dailyData).sort();
        const data = labels.map((l) => dailyData[l]);

        return NextResponse.json({
          type: 'bar',
          title: 'Daily Sales',
          data: {
            labels,
            datasets: [{ label: 'Revenue (₱)', data, backgroundColor: 'rgba(139, 69, 19, 0.7)' }],
          },
        });
      }

      case 'category-sales': {
        const orders = await prisma.order.findMany({
          where: {
            createdAt: { gte: dateFrom },
            status: { notIn: ['CANCELLED'] },
          },
          include: { items: { include: { product: { include: { category: true } } } } },
        });

        const catData: Record<string, number> = {};
        orders.forEach((o) => {
          o.items.forEach((item) => {
            const cat = item.product.category?.name || 'Uncategorized';
            catData[cat] = (catData[cat] || 0) + Number(item.subtotal);
          });
        });

        const labels = Object.keys(catData);
        const data = labels.map((l) => catData[l]);

        return NextResponse.json({
          type: 'pie',
          title: 'Sales by Category',
          data: {
            labels,
            datasets: [{
              label: 'Revenue (₱)',
              data,
              backgroundColor: [
                'rgba(139, 69, 19, 0.7)', 'rgba(245, 152, 66, 0.7)',
                'rgba(142, 193, 189, 0.7)', 'rgba(237, 195, 99, 0.7)',
                'rgba(211, 152, 127, 0.7)', 'rgba(113, 178, 121, 0.7)',
              ],
            }],
          },
        });
      }

      case 'product-revenue': {
        const orders = await prisma.order.findMany({
          where: {
            createdAt: { gte: dateFrom },
            status: { notIn: ['CANCELLED'] },
          },
          include: { items: { include: { product: true } } },
        });

        const prodData: Record<string, number> = {};
        orders.forEach((o) => {
          o.items.forEach((item) => {
            prodData[item.product.name] = (prodData[item.product.name] || 0) + Number(item.subtotal);
          });
        });

        const sorted = Object.entries(prodData).sort(([, a], [, b]) => b - a).slice(0, 10);
        const labels = sorted.map(([n]) => n);
        const data = sorted.map(([, v]) => v);

        return NextResponse.json({
          type: 'bar',
          title: 'Top 10 Products by Revenue',
          data: {
            labels,
            datasets: [{ label: 'Revenue (₱)', data, backgroundColor: 'rgba(139, 69, 19, 0.7)' }],
          },
        });
      }

      case 'inventory-status': {
        const inventories = await prisma.inventory.findMany({
          include: { product: { select: { name: true } } },
        });

        const okCount = inventories.filter((i) => i.quantity > i.lowStockThreshold).length;
        const lowCount = inventories.filter((i) => i.quantity <= i.lowStockThreshold && i.quantity > 0).length;
        const outCount = inventories.filter((i) => i.quantity === 0).length;

        return NextResponse.json({
          type: 'doughnut',
          title: 'Inventory Status',
          data: {
            labels: ['In Stock', 'Low Stock', 'Out of Stock'],
            datasets: [{
              data: [okCount, lowCount, outCount],
              backgroundColor: [
                'rgba(34, 197, 94, 0.7)',
                'rgba(251, 146, 60, 0.7)',
                'rgba(239, 68, 68, 0.7)',
              ],
            }],
          },
        });
      }

      case 'loyalty-growth': {
        const cards = await prisma.loyaltyCard.findMany({
          where: { createdAt: { gte: dateFrom } },
          orderBy: { createdAt: 'asc' },
        });

        const monthlyData: Record<string, number> = {};
        for (let i = 0; i <= 12; i++) {
          const d = new Date();
          d.setMonth(d.getMonth() - i);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          monthlyData[key] = 0;
        }

        cards.forEach((c) => {
          const key = new Date(c.createdAt).toISOString().slice(0, 7);
          monthlyData[key] = (monthlyData[key] || 0) + 1;
        });

        const labels = Object.keys(monthlyData).sort().slice(-6);
        const data = labels.map((l) => monthlyData[l]);

        return NextResponse.json({
          type: 'line',
          title: 'Loyalty Card Growth',
          data: {
            labels,
            datasets: [{
              label: 'New Cards',
              data,
              borderColor: 'rgba(139, 69, 19, 1)',
              backgroundColor: 'rgba(139, 69, 19, 0.2)',
              fill: true,
            }],
          },
        });
      }

      case 'order-status': {
        const orders = await prisma.order.findMany({
          where: { createdAt: { gte: dateFrom } },
        });

        const statusCounts: Record<string, number> = {};
        orders.forEach((o) => {
          statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
        });

        const labels = Object.keys(statusCounts);
        const data = labels.map((l) => statusCounts[l]);

        return NextResponse.json({
          type: 'pie',
          title: 'Order Status Distribution',
          data: {
            labels,
            datasets: [{
              data,
              backgroundColor: [
                'rgba(251, 191, 36, 0.7)',
                'rgba(59, 130, 246, 0.7)',
                'rgba(34, 197, 94, 0.7)',
                'rgba(239, 68, 68, 0.7)',
              ],
            }],
          },
        });
      }

      default:
        return NextResponse.json({ error: 'Invalid chart type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Chart error:', error);
    return NextResponse.json({ error: 'Failed to generate chart data' }, { status: 500 });
  }
}
