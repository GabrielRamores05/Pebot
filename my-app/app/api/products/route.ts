import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { emitEvent } from '@/lib/socket';
import { badRequest, serverError, unauthorized } from '@/lib/api-response';
import { normalizeMarginType, sellingPrice } from '@/lib/bir-pricing';
import { requirePermission } from '@/lib/auth';

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      include: { category: true, inventory: true },
      orderBy: { name: 'asc' },
    });
    // Ensure BIR pricing fields are included in response
    return NextResponse.json(products.map(p => ({
      ...p,
      capitalCost: p.capitalCost ?? 0,
      marginType: p.marginType ?? 'PERCENTAGE',
      marginValue: p.marginValue ?? 30,
      vatExempt: p.vatExempt ?? false,
    })));
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: NextRequest) {
  const user = await requirePermission(req, 'products');
  if (!user) return unauthorized();

  try {
    const body = await req.json() as {
      name: string; description?: string; price?: number; categoryId: number; imageUrl?: string;
      prepTimeMinutes?: number; stationType?: string;
      // BIR pricing fields
      capitalCost?: number; marginType?: string; marginValue?: number; vatExempt?: boolean;
    };

    // Validate required fields
    if (!body.name || typeof body.name !== 'string') {
      return badRequest('Name is required');
    }
    if (typeof body.categoryId !== 'number' || body.categoryId <= 0) {
      return badRequest('Valid categoryId is required');
    }
    if (body.price !== undefined && typeof body.price !== 'number') {
      return badRequest('Price must be a number');
    }
    if (body.imageUrl !== undefined && typeof body.imageUrl !== 'string') {
      return badRequest('imageUrl must be a string');
    }
    // Extract and validate BIR pricing fields
    const capitalCost = body.capitalCost ?? 0;
    const marginType = normalizeMarginType(body.marginType);
    const marginValue = typeof body.marginValue === 'number' && body.marginValue >= 0 ? body.marginValue : 30;
    const vatExempt = body.vatExempt ?? false;

    // Calculate price from BIR pricing if not explicitly provided
    let finalPrice = body.price;
    if (finalPrice === undefined && capitalCost > 0) {
      finalPrice = sellingPrice(capitalCost, marginType, marginValue, vatExempt);
    }

    // Validate that we have a price
    if (finalPrice === undefined) {
      return badRequest('Price or capitalCost is required');
    }

    const product = await prisma.product.create({
      data: {
        name: body.name,
        description: body.description,
        price: finalPrice,
        categoryId: body.categoryId,
        imageUrl: body.imageUrl,
        prepTimeMinutes: body.prepTimeMinutes ?? 5,
        stationType: body.stationType ?? 'general',
        capitalCost,
        marginType,
        marginValue,
        vatExempt,
      },
    });
    // Create inventory entry
    await prisma.inventory.create({ data: { productId: product.id, quantity: 0 } });
    return NextResponse.json(product, { status: 201 });
  } catch (e) {
    return serverError(e);
  }
}

export async function PATCH(req: NextRequest) {
  const user = await requirePermission(req, 'products');
  if (!user) return unauthorized();

  try {
    const { id, ...data } = await req.json() as { id: number; [key: string]: unknown };
    let updateData = data;

    // Handle BIR pricing fields explicitly
    const birPricingFields = ['capitalCost', 'marginType', 'marginValue', 'vatExempt'];
    const hasBirPricing = birPricingFields.some(field => field in data);

    // If BIR pricing fields are being updated, recalculate price
    if (hasBirPricing && 'price' in data === false) {
      const capitalCost = typeof data.capitalCost === 'number' ? data.capitalCost : 0;
      const marginType = normalizeMarginType(data.marginType);
      const marginValue = typeof data.marginValue === 'number' ? data.marginValue : 30;
      const vatExempt = typeof data.vatExempt === 'boolean' ? data.vatExempt : false;

      if (capitalCost > 0) {
        const calculatedPrice = sellingPrice(capitalCost, marginType, marginValue, vatExempt);
        updateData = { ...updateData, price: calculatedPrice, marginType };
      }
    }

    const product = await prisma.product.update({ where: { id }, data: updateData });
    emitEvent('product-update', product);
    return NextResponse.json(product);
  } catch (e) {
    return serverError(e);
  }
}

export async function DELETE(req: NextRequest) {
  const user = await requirePermission(req, 'products');
  if (!user) return unauthorized();

  try {
    const body = await req.json();
    const id = parseInt(body.id);
    
    if (!id || isNaN(id)) {
      return badRequest('Invalid product ID provided');
    }
    
    // Check if product exists
    const existingProduct = await prisma.product.findUnique({ where: { id } });
    if (!existingProduct) {
      return NextResponse.json({ error: `Product with ID ${id} not found` }, { status: 404 });
    }
    
    // Delete inventory records first (foreign key constraint)
    await prisma.inventory.deleteMany({ where: { productId: id } });
    
    // Delete order items that reference this product
    await prisma.orderItem.deleteMany({ where: { productId: id } });
    
    // Delete the product
    const product = await prisma.product.delete({ where: { id } });
    console.log(`[DELETE PRODUCT] Successfully deleted product ${id}: ${product.name}`);
    emitEvent('product-update', { id, deleted: true });
    return NextResponse.json({ ok: true, product });
  } catch (e) {
    console.error('[DELETE PRODUCT ERROR]', e);
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to delete product: ${message}` }, { status: 500 });
  }
}
