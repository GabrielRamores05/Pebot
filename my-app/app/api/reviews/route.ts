import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
    console.error('Error fetching reviews:', error);
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 });
  }
}

// POST /api/reviews - Create a new review
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, customerName, rating, comment, tasteSuggestion, imageUrl, orderNumber } = body;

    if (!productId || !customerName || !rating) {
      return NextResponse.json(
        { error: 'productId, customerName, and rating are required' },
        { status: 400 }
      );
    }

    // Ensure productId is a valid number
    const parsedProductId = parseInt(productId);
    if (isNaN(parsedProductId)) {
      return NextResponse.json(
        { error: 'Invalid productId' },
        { status: 400 }
      );
    }

    // Ensure rating is a number and in valid range (1-5)
    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      );
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
        return NextResponse.json(
          { error: 'Order not found' },
          { status: 404 }
        );
      }

      if (order.items.length === 0) {
        return NextResponse.json(
          { error: 'This order does not contain the specified product' },
          { status: 400 }
        );
      }

      // Verify the customer name matches the order
      if (order.customerName.toLowerCase() !== customerName.toLowerCase()) {
        return NextResponse.json(
          { error: 'Customer name does not match the order' },
          { status: 403 }
        );
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
    console.error('Error creating review:', error);
    return NextResponse.json({ error: 'Failed to create review' }, { status: 500 });
  }
}

// DELETE /api/reviews?id=X — admin delete a review
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Review ID required' }, { status: 400 });
    }

    await prisma.review.delete({ where: { id: Number(id) } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }
    console.error('Error deleting review:', error);
    return NextResponse.json({ error: 'Failed to delete review' }, { status: 500 });
  }
}
