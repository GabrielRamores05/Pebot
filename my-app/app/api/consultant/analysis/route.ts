import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { badRequest, serverError, unauthorized } from '@/lib/api-response';

// GET /api/consultant/analysis?type=...&days=30
// Types: sales, profitability, inventory, loyalty, staff-performance

export async function GET(req: NextRequest) {
  try {
    const user = await requirePermission(req, 'settings');
    if (!user) {
      return unauthorized();
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'sales';
    const days = parseInt(searchParams.get('days') || '30');

    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - days);

    switch (type) {
      case 'sales':
        return NextResponse.json(await getSalesAnalysis(dateFrom));

      case 'profitability':
        return NextResponse.json(await getProfitabilityAnalysis(dateFrom));

      case 'inventory':
        return NextResponse.json(await getInventoryAnalysis());

      case 'loyalty':
        return NextResponse.json(await getLoyaltyAnalysis(dateFrom));

      case 'staff-performance':
        return NextResponse.json(await getStaffPerformanceAnalysis(dateFrom));

      default:
        return badRequest('Invalid analysis type');
    }
  } catch (error) {
    return serverError(error, 'Failed to generate analysis');
  }
}

async function getSalesAnalysis(dateFrom: Date) {
  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: dateFrom },
      status: { notIn: ['CANCELLED'] },
    },
    include: {
      items: { include: { product: { include: { category: true } } } },
    },
  });

  const dailySales: Record<string, number> = {};
  const categorySales: Record<string, number> = {};
  const productSales: Record<string, { count: number; revenue: number }> = {};

  let totalRevenue = 0;
  let totalOrders = 0;
  let totalItems = 0;

  for (const order of orders) {
    totalOrders++;
    totalRevenue += Number(order.totalAmount);
    const dateKey = new Date(order.createdAt).toISOString().slice(0, 10);
    dailySales[dateKey] = (dailySales[dateKey] || 0) + Number(order.totalAmount);

    for (const item of order.items) {
      totalItems += item.quantity;
      const productName = item.product.name;
      const categoryName = item.product.category?.name || 'Uncategorized';
      const itemRevenue = Number(item.subtotal);

      if (!productSales[productName]) {
        productSales[productName] = { count: 0, revenue: 0 };
      }
      productSales[productName].count += item.quantity;
      productSales[productName].revenue += itemRevenue;

      categorySales[categoryName] = (categorySales[categoryName] || 0) + itemRevenue;
    }
  }

  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  return {
    type: 'sales',
    period: `Last ${Math.ceil((Date.now() - dateFrom.getTime()) / (1000 * 60 * 60 * 24))} days`,
    totalRevenue,
    totalOrders,
    totalItems,
    avgOrderValue,
    dailySales,
    categorySales,
    productSales: Object.entries(productSales)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue),
  };
}

async function getProfitabilityAnalysis(dateFrom: Date) {
  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: dateFrom },
      status: { notIn: ['CANCELLED'] },
    },
    include: {
      items: { include: { product: true } },
    },
  });

  const productProfit: Record<string, { revenue: number; cost: number; profit: number; margin: number }> = {};

  for (const order of orders) {
    for (const item of order.items) {
      const productName = item.product.name;
      const revenue = Number(item.subtotal);
      const cost = Number(item.product.capitalCost) * item.quantity;
      const profit = revenue - cost;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

      if (!productProfit[productName]) {
        productProfit[productName] = { revenue: 0, cost: 0, profit: 0, margin: 0 };
      }
      productProfit[productName].revenue += revenue;
      productProfit[productName].cost += cost;
      productProfit[productName].profit += profit;
    }
  }

  const totalRevenue = Object.values(productProfit).reduce((sum, p) => sum + p.revenue, 0);
  const totalCost = Object.values(productProfit).reduce((sum, p) => sum + p.cost, 0);
  const totalProfit = totalRevenue - totalCost;

  return {
    type: 'profitability',
    totalRevenue,
    totalCost,
    totalProfit,
    overallMargin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
    products: Object.entries(productProfit)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.profit - a.profit),
  };
}

async function getInventoryAnalysis() {
  const ingredients = await prisma.ingredient.findMany({
    include: { supplier: { select: { name: true } } },
  });

  const lowStock = ingredients.filter((i) => i.currentStock <= i.minStock);
  const totalValue = ingredients.reduce((sum, i) => sum + i.currentStock * i.costPerUnit, 0);
  const totalMinStock = ingredients.reduce((sum, i) => sum + i.minStock * i.costPerUnit, 0);

  return {
    type: 'inventory',
    totalIngredients: ingredients.length,
    lowStockCount: lowStock.length,
    lowStockItems: lowStock.map((i) => ({
      name: i.name,
      currentStock: i.currentStock,
      minStock: i.minStock,
      baseUnit: i.baseUnit,
      supplier: i.supplier?.name,
    })),
    totalInventoryValue: totalValue,
    totalMinStockValue: totalMinStock,
    itemsBySupplier: Array.from(
      ingredients.reduce((acc, i) => {
        const supplier = i.supplier?.name || 'Unknown';
        if (!acc.has(supplier)) acc.set(supplier, 0);
        acc.set(supplier, acc.get(supplier)! + i.currentStock * i.costPerUnit);
        return acc;
      }, new Map<string, number>()).entries()
    ).map(([name, value]) => ({ supplier: name, value })),
  };
}

async function getLoyaltyAnalysis(dateFrom: Date) {
  const transactions = await prisma.loyaltyTransaction.findMany({
    where: {
      createdAt: { gte: dateFrom },
    },
    include: { card: true },
  });

  const pointsEarned = transactions.filter((t) => t.type === 'EARNED').reduce((sum, t) => sum + t.points, 0);
  const pointsRedeemed = transactions
    .filter((t) => t.type === 'REDEEMED')
    .reduce((sum, t) => sum + t.points, 0);

  const vouchers = await prisma.loyaltyVoucher.findMany({
    where: {
      status: 'REDEEMED',
      redeemedDate: { gte: dateFrom },
    },
  });

  const totalRedeemedValue = vouchers.reduce((sum, v) => sum + Number(v.discountValue), 0);

  return {
    type: 'loyalty',
    pointsEarned,
    pointsRedeemed,
    netPoints: pointsEarned - pointsRedeemed,
    vouchersRedeemed: vouchers.length,
    totalRedeemedValue,
    topCustomers: Array.from(
      transactions.reduce((acc, t) => {
        const name = t.card.customerName;
        if (!acc.has(name)) acc.set(name, 0);
        acc.set(name, acc.get(name)! + t.points);
        return acc;
      }, new Map<string, number>()).entries()
    )
      .map(([name, points]) => ({ customerName: name, points }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 10),
  };
}

async function getStaffPerformanceAnalysis(dateFrom: Date) {
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      createdAt: { gte: dateFrom },
      userId: { not: null },
    },
    include: { user: true },
  });

  const userActions: Array<[number, { name: string; actions: number }]> = Array.from(
    auditLogs.reduce((acc, log) => {
      const userId = log.userId!;
      if (!acc.has(userId)) {
        acc.set(userId, { name: log.user?.name || 'Unknown', actions: 0 });
      }
      acc.get(userId)!.actions += 1;
      return acc;
    }, new Map<number, { name: string; actions: number }>())
  );

  const staffPerformance = userActions
    .map(([userId, data]) => ({
      userId,
      name: data.name,
      actions: data.actions,
    }))
    .sort((a, b) => b.actions - a.actions);

  return {
    type: 'staff-performance',
    staff: staffPerformance,
    totalActions: auditLogs.length,
  };
}
