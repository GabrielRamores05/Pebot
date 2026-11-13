import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { unauthorized, serverError } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth';
import { loyaltyCoveredValue } from '@/lib/loyalty-utils';
import { findLoyaltySettingsWithCategory } from '@/modules/loyalty/repository';

interface RevenueMetrics {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  completedOrdersRevenue: number;
  loyaltyRevenueImpact: number;
  paymentMethods: { method: string; amount: number; count: number }[];
  revenueByDay: { date: string; revenue: number; orders: number }[];
  topProductsByRevenue: { name: string; revenue: number; quantity: number }[];
  revenueByCategory: { category: string; revenue: number; percentage: number }[];
  customerSpending: { percentile: string; count: number; revenue: number }[];
}

function getDateRange(filter: string, isPrevious: boolean = false) {
  const now = new Date();
  let startDate = new Date();
  
  if (isPrevious) {
    if (filter === 'today') {
      startDate.setDate(now.getDate() - 1);
      return { startDate, endDate: new Date(startDate) };
    } else if (filter === 'week') {
      startDate.setDate(now.getDate() - 13);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
      return { startDate, endDate };
    } else if (filter === 'month') {
      startDate.setMonth(now.getMonth() - 1);
      startDate.setDate(1);
      const endDate = new Date(now.getFullYear(), now.getMonth(), 0);
      return { startDate, endDate };
    } else if (filter === 'quarter') {
      const q = Math.ceil((now.getMonth() + 1) / 3);
      const prevQ = q === 1 ? 4 : q - 1;
      const year = q === 1 ? now.getFullYear() - 1 : now.getFullYear();
      startDate = new Date(year, (prevQ - 1) * 3, 1);
      const endDate = new Date(year, prevQ * 3, 0);
      return { startDate, endDate };
    } else if (filter === 'year') {
      startDate = new Date(now.getFullYear() - 1, 0, 1);
      const endDate = new Date(now.getFullYear() - 1, 11, 31);
      return { startDate, endDate };
    }
  } else {
    if (filter === 'today') {
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
      return { startDate, endDate };
    } else if (filter === 'week') {
      startDate.setDate(now.getDate() - 6);
      return { startDate, endDate: now };
    } else if (filter === 'month') {
      startDate.setDate(1);
      return { startDate, endDate: now };
    } else if (filter === 'quarter') {
      const q = Math.ceil((now.getMonth() + 1) / 3);
      startDate = new Date(now.getFullYear(), (q - 1) * 3, 1);
      return { startDate, endDate: now };
    } else if (filter === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1);
      return { startDate, endDate: now };
    } else if (filter === 'all') {
      return { startDate: new Date(2020, 0, 1), endDate: now };
    }
  }
  
  return { startDate, endDate: now };
}

export async function GET(req: NextRequest) {
  const user = await requirePermission(req, 'analytics');
  if (!user) return unauthorized();

  try {
    const filter = req.nextUrl.searchParams.get('filter') || 'month';
    const isPrevious = req.nextUrl.searchParams.get('period') === 'previous';
    const { startDate, endDate } = getDateRange(filter, isPrevious);

    // Fetch all orders in date range
    const orders = await prisma.order.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                category: true,
              },
            },
          },
        },
        payment: true,
      },
    });

    // Calculate metrics
    const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
    const completedOrders = orders.filter(o => o.status === 'COMPLETED');
    const completedOrdersRevenue = completedOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalOrders = orders.length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Loyalty impact
    const loyaltyOrders = orders.filter(o => o.loyaltyPromo);
    // Estimate: the value of the items the loyalty program covers on those orders.
    const loyaltySettings = loyaltyOrders.length > 0 ? await findLoyaltySettingsWithCategory() : [];
    const loyaltyRevenueImpact = loyaltyOrders.reduce(
      (sum, o) => sum + loyaltyCoveredValue(o.items, loyaltySettings),
      0,
    );

    // Payment methods
    const paymentMethods: { method: string; amount: number; count: number }[] = [];
    const payments = new Map<string, { amount: number; count: number }>();
    
     orders.forEach(o => {
       const method = o.payment?.method || 'Cash';
       const existing = payments.get(method) || { amount: 0, count: 0 };
       existing.amount += o.totalAmount;
       existing.count += 1;
       payments.set(method, existing);
     });

    payments.forEach((value, method) => {
      paymentMethods.push({ method, ...value });
    });

    // Revenue by day
    const revenueByDayMap = new Map<string, { revenue: number; orders: number }>();
    orders.forEach(o => {
      const date = o.createdAt.toISOString().split('T')[0];
      const existing = revenueByDayMap.get(date) || { revenue: 0, orders: 0 };
      existing.revenue += o.totalAmount;
      existing.orders += 1;
      revenueByDayMap.set(date, existing);
    });

    const revenueByDay = Array.from(revenueByDayMap, ([date, data]) => ({
      date,
      ...data,
    })).sort((a, b) => a.date.localeCompare(b.date));

    // Top products by revenue
    const productRevenueMap = new Map<string, { revenue: number; quantity: number }>();
    orders.forEach(o => {
      o.items.forEach(item => {
        const existing = productRevenueMap.get(item.product.name) || { revenue: 0, quantity: 0 };
        existing.revenue += item.subtotal;
        existing.quantity += item.quantity;
        productRevenueMap.set(item.product.name, existing);
      });
    });

    const topProductsByRevenue = Array.from(productRevenueMap, ([name, data]) => ({
      name,
      ...data,
    }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Revenue by category
    const categoryRevenueMap = new Map<string, number>();
    orders.forEach(o => {
      o.items.forEach(item => {
        const category = item.product.category?.name || 'Uncategorized';
        const existing = categoryRevenueMap.get(category) || 0;
        categoryRevenueMap.set(category, existing + item.subtotal);
      });
    });

    const revenueByCategory = Array.from(categoryRevenueMap, ([category, revenue]) => ({
      category,
      revenue,
      percentage: totalRevenue > 0 ? revenue / totalRevenue : 0,
    })).sort((a, b) => b.revenue - a.revenue);

    // Customer spending distribution
    const customerRevenueMap = new Map<string, number>();
    orders.forEach(o => {
      const existing = customerRevenueMap.get(o.customerName) || 0;
      customerRevenueMap.set(o.customerName, existing + o.totalAmount);
    });

    const customerRevenues = Array.from(customerRevenueMap.values()).sort((a, b) => b - a);
    const topSpenderTotal = customerRevenues.slice(0, Math.ceil(customerRevenues.length * 0.2)).reduce((a, b) => a + b, 0);
    const regularSpenderTotal = customerRevenues.slice(Math.ceil(customerRevenues.length * 0.2), Math.ceil(customerRevenues.length * 0.6)).reduce((a, b) => a + b, 0);
    const casualSpenderTotal = customerRevenues.slice(Math.ceil(customerRevenues.length * 0.6)).reduce((a, b) => a + b, 0);

    const customerSpending = [
      { 
        percentile: 'Top 20%', 
        count: Math.ceil(customerRevenueMap.size * 0.2), 
        revenue: topSpenderTotal 
      },
      { 
        percentile: 'Upper Middle 40%', 
        count: Math.ceil(customerRevenueMap.size * 0.4), 
        revenue: regularSpenderTotal 
      },
      { 
        percentile: 'Lower 40%', 
        count: customerRevenueMap.size - Math.ceil(customerRevenueMap.size * 0.6), 
        revenue: casualSpenderTotal 
      },
    ];

    const result: RevenueMetrics = {
      totalRevenue,
      totalOrders,
      averageOrderValue,
      completedOrdersRevenue,
      loyaltyRevenueImpact,
      paymentMethods: paymentMethods.sort((a, b) => b.amount - a.amount),
      revenueByDay,
      topProductsByRevenue,
      revenueByCategory,
      customerSpending,
    };

    return NextResponse.json(result);
  } catch (e) {
    return serverError(e, 'Failed to fetch revenue data');
  }
}
