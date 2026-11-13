'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import ProductReviews from '../ProductReviews';

interface Review {
  id: number;
  productId: number;
  customerName: string;
  rating: number;
  comment: string | null;
  tasteSuggestion: string | null;
  imageUrl: string | null;
  createdAt: string;
  product: { id: number; name: string; imageUrl: string | null };
}

export const dynamic = 'force-dynamic';

function MenuReviewsContent() {
  const searchParams = useSearchParams();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<{ id: number; name: string }[]>([]);
  const [writeProductId, setWriteProductId] = useState<number | null>(
    searchParams.get('productId') ? Number(searchParams.get('productId')) : null
  );
  const [branding, setBranding] = useState<{ shopName: string; logoUrl: string | null }>({
    shopName: 'Pebot',
    logoUrl: null,
  });

  // Product list for the "Rate a product" selector
  useEffect(() => {
    fetch('/api/categories')
      .then((r) => (r.ok ? r.json() : []))
      .then((cats) => {
        const out: { id: number; name: string }[] = [];
        for (const c of Array.isArray(cats) ? cats : []) {
          for (const p of c.products ?? []) {
            if (!out.some((x) => x.id === p.id)) out.push({ id: p.id, name: p.name });
          }
        }
        setProducts(out);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/settings/branding')
      .then((r) => r.json())
      .then((d) => setBranding({ shopName: d.shopName ?? 'Pebot', logoUrl: d.logoUrl ?? null }))
      .catch(() => {});

    fetch('/api/reviews')
      .then((r) => r.json())
      .then((data) => {
        setReviews(data.reviews || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span
        key={i}
        className={i < Math.round(rating) ? 'text-amber-400' : 'text-gray-300'}
      >
        ★
      </span>
    ));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-bounce">🍽️</div>
          <p className="text-amber-800 font-medium">Loading reviews...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="w-full border-b border-[#eadfcf] bg-[#fffaf4]/90 text-stone-900 shadow-[0_12px_30px_rgba(85,54,30,0.06)] backdrop-blur-xl">
        <div className="flex w-full items-center justify-between gap-3 px-4 pb-2 pt-3 sm:px-6 lg:px-8">
          <div className="min-w-0 flex items-center gap-3">
            <Link href="/menu" className="text-slate-600 hover:text-slate-900 transition-colors">
              ← Back
            </Link>
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-[#f0e0ca] bg-linear-to-br from-[#f7efe4] to-[#e7d3b6] shadow-sm">
              {branding.logoUrl ? (
                <img src={branding.logoUrl} alt="Shop Logo" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xl">🍽️</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8a6c45]">Welcome to</p>
              <h1 className="text-[18px] font-bold -tracking-[0.3px] text-stone-900">{branding.shopName}</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Write / rate a product */}
        <div className="mb-6 rounded-3xl border border-amber-200 bg-amber-50/60 p-4">
          <p className="text-sm font-semibold text-slate-800 mb-2">⭐ Rate one of our products</p>
          {products.length === 0 ? (
            <p className="text-xs text-slate-400">Loading products…</p>
          ) : (
            <>
              <select
                value={writeProductId ?? ''}
                onChange={(e) => setWriteProductId(e.target.value ? Number(e.target.value) : null)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm mb-3"
              >
                <option value="">Choose a product…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {writeProductId && (
                <ProductReviews
                  key={`wall-${writeProductId}`}
                  productId={writeProductId}
                  defaultWriteOpen
                  onSubmitted={() => {
                    fetch('/api/reviews')
                      .then((r) => r.json())
                      .then((data) => setReviews(data.reviews || []))
                      .catch(() => {});
                  }}
                />
              )}
            </>
          )}
        </div>

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900">Customer Reviews</h2>
          {reviews.length > 0 && (
            <div className="flex items-center gap-3 mt-2">
              <div className="flex text-amber-400 text-xl">
                {renderStars(Math.round(avgRating))}
              </div>
              <span className="text-slate-600 font-medium">{avgRating.toFixed(1)}/5 avg</span>
              <span className="text-slate-400">({reviews.length} reviews)</span>
            </div>
          )}
        </div>

        {reviews.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <div className="text-5xl mb-4">😕</div>
            <p>No reviews yet. Be the first to leave one!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div key={review.id} className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-start gap-3 mb-3">
                  {review.product.imageUrl ? (
                    <img
                      src={review.product.imageUrl}
                      alt={review.product.name}
                      className="w-12 h-12 rounded-xl object-cover border border-slate-200"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                      <span className="text-xl">🍽️</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900">{review.product.name}</p>
                    <div className="flex items-center gap-1 mt-1">
                      {renderStars(review.rating)}
                      <span className="text-xs text-slate-500">({review.rating}/5)</span>
                    </div>
                    <p className="text-xs text-slate-500">by {review.customerName}</p>
                  </div>
                  <span className="text-xs text-slate-400">
                    {new Date(review.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>

                {review.comment && (
                  <p className="text-slate-700 text-sm mb-2">{review.comment}</p>
                )}

                {review.imageUrl && (
                  <div className="mb-2">
                    <img
                      src={review.imageUrl}
                      alt="Review photo"
                      className="max-w-full h-32 rounded-xl border border-slate-200 object-cover"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default function MenuReviewsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading reviews...</div>}>
      <MenuReviewsContent />
    </Suspense>
  );
}