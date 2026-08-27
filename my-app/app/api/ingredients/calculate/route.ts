import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { badRequest, serverError } from '@/lib/api-response';

// POST /api/ingredients/calculate - Calculate total ingredients needed
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { items } = body; // Array of { productId, quantity }

    if (!items || items.length === 0) {
      return badRequest('No items provided');
    }

    // Get all product ingredients for the requested products
    const productIds = items.map((item: { productId: number }) => item.productId);
    
    const productIngredients = await prisma.productIngredient.findMany({
      where: { productId: { in: productIds } },
      include: {
        ingredient: true,
      },
    });

    // Calculate total ingredients needed
    const ingredientTotals: Record<number, {
      ingredientId: number;
      name: string;
      baseUnit: string;
      quantityNeeded: number;
      costPerUnit: number;
      totalCost: number;
      currentStock: number;
      minStock: number;
    }> = {};

    for (const item of items) {
      const { productId, quantity } = item;
      
      // Find all ingredients for this product
      const ingredients = productIngredients.filter(pi => pi.productId === productId);
      
      for (const pi of ingredients) {
        const needed = pi.quantity * quantity;
        
        if (ingredientTotals[pi.ingredientId]) {
          ingredientTotals[pi.ingredientId].quantityNeeded += needed;
          ingredientTotals[pi.ingredientId].totalCost = 
            ingredientTotals[pi.ingredientId].quantityNeeded * ingredientTotals[pi.ingredientId].costPerUnit;
        } else {
          ingredientTotals[pi.ingredientId] = {
            ingredientId: pi.ingredientId,
            name: pi.ingredient.name,
            baseUnit: pi.ingredient.baseUnit,
            quantityNeeded: needed,
            costPerUnit: pi.ingredient.costPerUnit,
            totalCost: needed * pi.ingredient.costPerUnit,
            currentStock: pi.ingredient.currentStock || 0,
            minStock: pi.ingredient.minStock || 0,
          };
        }
      }
    }

    // Convert to array and sort by name
    const result = Object.values(ingredientTotals).sort((a, b) => a.name.localeCompare(b.name));

    // Calculate grand total
    const grandTotal = result.reduce((sum, item) => sum + item.totalCost, 0);

    return NextResponse.json({
      ingredients: result,
      grandTotal,
      itemCount: items.length,
    });
  } catch (error) {
    return serverError(error, 'Failed to calculate ingredients');
  }
}
