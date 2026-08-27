import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { serverError } from '@/lib/api-response';
import { guardFeature } from '@/lib/api-guards';

function getDateRange(filter: string): { start: Date; end: Date } {
  const now = new Date();

  if (filter === 'yesterday') {
    const start = new Date(now);
    start.setDate(now.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  let start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (filter === 'week') {
    start = new Date(now);
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  } else if (filter === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (filter === 'year') {
    start = new Date(now.getFullYear(), 0, 1);
  }

  return { start, end };
}

export async function GET(req: NextRequest) {
  // Check if user has access to analytics feature
  const { error } = await guardFeature(req, 'analytics');
  if (error) return error;

  try {
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get('filter') || 'today';
    const { start, end } = getDateRange(filter);

    const orders = await prisma.order.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: { not: 'CANCELLED' },
      },
      include: {
        items: { include: { product: { include: { category: true } } } },
      },
    });

    const completedOrders = orders.filter((o) => o.status === 'COMPLETED');
    const totalSales = completedOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalOrders = orders.length;
    const avgOrderValue = completedOrders.length > 0 ? totalSales / completedOrders.length : 0;

    // Top-selling items
    const itemMap = new Map<string, { name: string; count: number; revenue: number }>();
    for (const order of orders) {
      for (const item of order.items) {
        const key = item.product.name;
        const existing = itemMap.get(key) || { name: key, count: 0, revenue: 0 };
        existing.count += item.quantity;
        existing.revenue += item.subtotal;
        itemMap.set(key, existing);
      }
    }
    const topItems = Array.from(itemMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Sales by hour
    const hourMap = new Map<number, number>();
    const ordersByHour = new Map<number, number>();
    for (const order of completedOrders) {
      const hour = new Date(order.createdAt).getHours();
      hourMap.set(hour, (hourMap.get(hour) || 0) + order.totalAmount);
      ordersByHour.set(hour, (ordersByHour.get(hour) || 0) + 1);
    }
    const salesByHour = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      label: `${String(h).padStart(2, '0')}:00`,
      sales: hourMap.get(h) || 0,
      orders: ordersByHour.get(h) || 0,
    }));

    // Sales by category
    const catMap = new Map<string, number>();
    for (const order of completedOrders) {
      for (const item of order.items) {
        const cat = item.product.category.name;
        catMap.set(cat, (catMap.get(cat) || 0) + item.subtotal);
      }
    }
    const salesByCategory = Array.from(catMap.entries()).map(([name, sales]) => ({ name, sales }));

    // Sales by day (for week/month/year views)
    const dayMap = new Map<string, number>();
    for (const order of completedOrders) {
      const d = new Date(order.createdAt);
      const key = filter === 'year'
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        : d.toISOString().slice(0, 10);
      dayMap.set(key, (dayMap.get(key) || 0) + order.totalAmount);
    }
    const salesByDay = Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, sales]) => ({
        date,
        label: filter === 'year'
          ? new Date(date + '-01').toLocaleDateString([], { month: 'short' })
          : new Date(date).toLocaleDateString([], { month: 'short', day: 'numeric' }),
        sales,
      }));

    // Order status breakdown
    const pendingOrders = orders.filter((o) => o.status === 'PENDING').length;
    const preparingOrders = orders.filter((o) => o.status === 'PREPARING').length;
    const completedCount = completedOrders.length;
    const cancelledOrders = orders.filter((o) => o.status === 'CANCELLED').length;

    return NextResponse.json({
      totalSales,
      totalOrders,
      completedOrders: completedCount,
      pendingOrders,
      preparingOrders,
      cancelledOrders,
      avgOrderValue,
      topItems,
      salesByHour,
      salesByDay,
      salesByCategory,
    });
  } catch (e) {
    return serverError(e);
  }
}
