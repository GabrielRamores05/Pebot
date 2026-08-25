import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface OrderMetric {
  orderNumber: string;
  customerName: string;
  createdAt: string;
  completedAt: string | null;
  status: string;
  prepTimeMinutes: number;
  itemCount: number;
  isOnTime: boolean;
}

interface FulfillmentStats {
  totalOrders: number;
  completedOrders: number;
  averagePrepTimeMinutes: number;
  medianPrepTimeMinutes: number;
  onTimePercentage: number;
  completionRate: number;
  averageItemsPerOrder: number;
  peakHour: string;
  prepTimeByHour: { hour: string; avgTime: number; count: number }[];
  statusBreakdown: { status: string; count: number; percentage: number }[];
  prepTimeDistribution: { range: string; count: number }[];
  ordersPerHour: { hour: string; count: number }[];
}

function getDateRange(range: string) {
  const now = new Date();
  let startDate = new Date();

  if (range === 'today') {
    startDate.setHours(0, 0, 0, 0);
  } else if (range === 'week') {
    startDate.setDate(now.getDate() - 6);
  } else if (range === 'month') {
    startDate.setDate(1);
  }

  return { startDate, endDate: now };
}

export async function GET(req: NextRequest) {
  try {
    const range = req.nextUrl.searchParams.get('range') || 'today';
    const { startDate, endDate } = getDateRange(range);

    // Fetch all orders with items in the date range
    const orders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Build order metrics
    const orderMetrics: OrderMetric[] = [];
    const prepTimes: number[] = [];
    const statusMap = new Map<string, number>();
    const hourMap = new Map<string, { count: number; totalPrepTime: number }>();
    let totalItems = 0;

    orders.forEach(order => {
      const createdTime = order.createdAt.getTime();
      const completedTime = order.updatedAt.getTime();
      const prepTimeMs = completedTime - createdTime;
      const prepTimeMinutes = Math.round(prepTimeMs / (1000 * 60));
      const itemCount = order.items.length;
      totalItems += itemCount;

      const hour = order.createdAt.getHours().toString().padStart(2, '0') + ':00';
      const hourData = hourMap.get(hour) || { count: 0, totalPrepTime: 0 };
      hourData.count += 1;
      if (prepTimeMinutes > 0) {
        hourData.totalPrepTime += prepTimeMinutes;
      }
      hourMap.set(hour, hourData);

      // Track status
      const status = order.status || 'UNKNOWN';
      statusMap.set(status, (statusMap.get(status) || 0) + 1);

      // For completed orders, calculate prep time
      const isOnTime = prepTimeMinutes > 0 && prepTimeMinutes <= 15; // Target: 15 minutes or less

      if (order.status === 'COMPLETED' && prepTimeMinutes > 0) {
        prepTimes.push(prepTimeMinutes);
      }

      orderMetrics.push({
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        createdAt: order.createdAt.toISOString(),
        completedAt: order.updatedAt.toISOString(),
        status: order.status || 'PENDING',
        prepTimeMinutes,
        itemCount,
        isOnTime,
      });
    });

    // Calculate stats
    const totalOrders = orders.length;
    const completedOrders = Array.from(statusMap.entries()).find(([s]) => s === 'COMPLETED')?.[1] || 0;
    const completionRate = totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;
    const averageItemsPerOrder = totalOrders > 0 ? totalItems / totalOrders : 0;

    // Prep time stats
    const averagePrepTimeMinutes = prepTimes.length > 0 ? prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length : 0;
    const sortedPrepTimes = [...prepTimes].sort((a, b) => a - b);
    const medianPrepTimeMinutes =
      sortedPrepTimes.length > 0
        ? sortedPrepTimes[Math.floor(sortedPrepTimes.length / 2)]
        : 0;

    // On-time percentage
    const onTimeOrders = orderMetrics.filter(o => o.isOnTime && o.prepTimeMinutes > 0).length;
    const completedWithTime = orderMetrics.filter(o => o.status === 'COMPLETED' && o.prepTimeMinutes > 0).length;
    const onTimePercentage = completedWithTime > 0 ? (onTimeOrders / completedWithTime) * 100 : 0;

    // Status breakdown
    const statusBreakdown = Array.from(statusMap.entries()).map(([status, count]) => ({
      status,
      count,
      percentage: totalOrders > 0 ? count / totalOrders : 0,
    }));

    // Prep time by hour
    const prepTimeByHour = Array.from(hourMap.entries())
      .map(([hour, data]) => ({
        hour,
        avgTime: data.count > 0 ? data.totalPrepTime / data.count : 0,
        count: data.count,
      }))
      .sort((a, b) => a.hour.localeCompare(b.hour));

    // Find peak hour
    const peakHour = prepTimeByHour.length > 0 
      ? prepTimeByHour.reduce((max, curr) => (curr.count > max.count ? curr : max)).hour
      : '—';

    // Orders per hour
    const ordersPerHour = Array.from(hourMap.entries())
      .map(([hour, data]) => ({
        hour,
        count: data.count,
      }))
      .sort((a, b) => a.hour.localeCompare(b.hour));

    // Prep time distribution
    const prepTimeDistribution = [
      { range: '0-5m', count: prepTimes.filter(t => t >= 0 && t < 5).length },
      { range: '5-10m', count: prepTimes.filter(t => t >= 5 && t < 10).length },
      { range: '10-15m', count: prepTimes.filter(t => t >= 10 && t < 15).length },
      { range: '15-20m', count: prepTimes.filter(t => t >= 15 && t < 20).length },
      { range: '20m+', count: prepTimes.filter(t => t >= 20).length },
    ];

    const stats: FulfillmentStats = {
      totalOrders,
      completedOrders,
      averagePrepTimeMinutes,
      medianPrepTimeMinutes,
      onTimePercentage,
      completionRate,
      averageItemsPerOrder,
      peakHour,
      prepTimeByHour,
      statusBreakdown,
      prepTimeDistribution,
      ordersPerHour,
    };

    return NextResponse.json({
      stats,
      orders: orderMetrics.slice(0, 100), // Return last 100 orders
    });
  } catch (e) {
    console.error('[FULFILLMENT API] Error:', e);
    return NextResponse.json({ error: 'Failed to fetch fulfillment metrics' }, { status: 500 });
  }
}
