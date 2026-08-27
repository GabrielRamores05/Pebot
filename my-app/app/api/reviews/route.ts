import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { badRequest, forbidden, notFound, serverError } from '@/lib/api-response';

// GET /api/reviews?productId=X OR /api/reviews (all reviews)
// ?suggestions=true — only return reviews with tasteSuggestion
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const suggestionsOnly = searchParams.get('suggestions') === 'true';

    let whereClause: any = {};
    if (productId) {
      whereClause.productId = parseInt(productId);
    }
    if (suggestionsOnly) {
      whereClause.tasteSuggestion = { not: null };
    }

    const reviews = await prisma.review.findMany({
      where: whereClause,
      include: {
        product: {
          select: { id: true, name: true, imageUrl: true }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    if (productId && !suggestionsOnly) {
      // Single product reviews — calculate average rating
      const avgRating = reviews.length > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
        : 0;

      return NextResponse.json({
        reviews,
        averageRating: avgRating,
        totalReviews: reviews.length,
      });
    }

    // All reviews or suggestions — group with stats
    const allReviews = reviews.filter(r => !suggestionsOnly || r.tasteSuggestion);
    const avgRating = allReviews.length > 0
      ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
      : 0;

    return NextResponse.json({
      reviews: allReviews,
      averageRating: avgRating,
      totalReviews: allReviews.length,
    });
  } catch (error) {
    return serverError(error, 'Failed to fetch reviews');
  }
}

// POST /api/reviews - Create a new review
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, customerName, rating, comment, tasteSuggestion, imageUrl, orderNumber } = body;

    if (!productId || !customerName || !rating) {
      return badRequest('productId, customerName, and rating are required');
    }

    // Ensure productId is a valid number
    const parsedProductId = parseInt(productId);
    if (isNaN(parsedProductId)) {
      return badRequest('Invalid productId');
    }

    // Ensure rating is a number and in valid range (1-5)
    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      return badRequest('Rating must be between 1 and 5');
    }

    // Verify the customer actually ordered this product if orderNumber is provided
    if (orderNumber) {
      const order = await prisma.order.findUnique({
        where: { orderNumber },
        include: {
          items: {
            where: { productId: parsedProductId }
          }
        }
      });

      if (!order) {
        return notFound('Order not found');
      }

      if (order.items.length === 0) {
        return badRequest('This order does not contain the specified product');
      }

      // Verify the customer name matches the order
      if (order.customerName.toLowerCase() !== customerName.toLowerCase()) {
        return forbidden('Customer name does not match the order');
      }
    }

    const review = await prisma.review.create({
      data: {
        productId: parsedProductId,
        customerName,
        rating,
        comment: comment || null,
        tasteSuggestion: tasteSuggestion || null,
        imageUrl: imageUrl || null,
      },
      include: { product: { select: { name: true } } },
    });

    return NextResponse.json(review, { status: 201 });
  } catch (error) {
    return serverError(error, 'Failed to create review');
  }
}

// DELETE /api/reviews?id=X — admin delete a review
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return badRequest('Review ID required');
    }

    await prisma.review.delete({ where: { id: Number(id) } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return notFound('Review not found');
    }
    return serverError(error, 'Failed to delete review');
  }
}
