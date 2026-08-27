import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth';
import { calcInventoryValue, getStockStatus, formatStock } from '@/lib/ingredient-utils';
import { serverError, unauthorized } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  const user = await requirePermission(req, 'inventory');
  if (!user) {
    return unauthorized();
  }

  try {
    const ingredients = await prisma.ingredient.findMany({
      include: {
        supplier: { select: { id: true, name: true } },
        _count: { select: { transactions: true } },
      },
      orderBy: { name: 'asc' },
    });

    const totalIngredients = ingredients.length;
    const inStock = ingredients.filter((i) => i.currentStock > i.minStock).length;
    const lowStock = ingredients.filter((i) => i.currentStock <= i.minStock && i.currentStock > 0).length;
    const outOfStock = ingredients.filter((i) => i.currentStock <= 0).length;

    // Total inventory value = sum of (currentStock × costPerUnit)
    const totalInventoryValue = ingredients.reduce((sum, i) => sum + calcInventoryValue(i.currentStock, i.costPerUnit), 0);

    // Recent purchases (last 10 PURCHASE transactions)
    const recentPurchases = await prisma.ingredientTransaction.findMany({
      where: { type: 'PURCHASE' },
      include: {
        ingredient: { select: { id: true, name: true, baseUnit: true, category: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Recent usage (last 10 USAGE transactions)
    const recentUsage = await prisma.ingredientTransaction.findMany({
      where: { type: 'USAGE' },
      include: {
        ingredient: { select: { id: true, name: true, baseUnit: true, category: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Highest cost ingredients (by inventory value, top 10)
    const highestCostIngredients = ingredients
      .map((i) => ({
        id: i.id,
        name: i.name,
        category: i.category,
        currentStock: i.currentStock,
        baseUnit: i.baseUnit,
        costPerUnit: i.costPerUnit,
        inventoryValue: calcInventoryValue(i.currentStock, i.costPerUnit),
        status: getStockStatus(i.currentStock, i.minStock),
      }))
      .sort((a, b) => b.inventoryValue - a.inventoryValue)
      .slice(0, 10);

    // Ingredients with status for the list view
    const ingredientList = ingredients.map((i) => ({
      id: i.id,
      name: i.name,
      category: i.category,
      currentStock: i.currentStock,
      baseUnit: i.baseUnit,
      purchaseUnit: i.purchaseUnit,
      minStock: i.minStock,
      costPerUnit: i.costPerUnit,
      inventoryValue: calcInventoryValue(i.currentStock, i.costPerUnit),
      status: getStockStatus(i.currentStock, i.minStock),
      statusText:
        i.currentStock <= 0 ? 'OUT OF STOCK' :
        i.currentStock <= i.minStock ? 'LOW STOCK' : 'IN STOCK',
      supplier: i.supplier ? { id: i.supplier.id, name: i.supplier.name } : null,
      transactionCount: i._count.transactions,
    }));

    return NextResponse.json({
      summary: {
        totalIngredients,
        inStock,
        lowStock,
        outOfStock,
        totalInventoryValue,
      },
      recentPurchases,
      recentUsage,
      highestCostIngredients,
      ingredients: ingredientList,
    });
  } catch (error) {
    return serverError(error, 'Failed to fetch dashboard data');
  }
}
