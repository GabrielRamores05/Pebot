'use client';

import { useState, useEffect, useCallback } from 'react';

interface Review {
  id: number;
  productId: number;
  customerName: string;
  rating: number;
  comment: string | null;
  tasteSuggestion: string | null;
  imageUrl: string | null;
  createdAt: string;
  product: {
    id: number;
    name: string;
    imageUrl: string | null;
  };
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterProduct, setFilterProduct] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/reviews');
      const data = await res.json();
      setReviews(Array.isArray(data.reviews) ? data.reviews : []);
    } catch (e) {
      console.error('Failed to fetch reviews:', e);
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this review? This cannot be undone.')) return;
    try {
      await fetch(`/api/reviews?id=${id}`, { method: 'DELETE' });
      setReviews((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      console.error('Failed to delete review:', e);
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={i < rating ? 'text-amber-400' : 'text-gray-300'}>
        ★
      </span>
    ));
  };

  const uniqueProducts = Array.from(new Set(reviews.map((r) => r.product.name)));

  const filtered = reviews.filter((r) => {
    const matchesProduct = filterProduct === 'all' || r.product.name === filterProduct;
    const matchesSearch =
      r.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.comment?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesProduct && matchesSearch;
  });

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 min-h-screen">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 px-6 py-4 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-100 to-amber-200 rounded-xl flex items-center justify-center text-xl">
              ⭐
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Reviews</h1>
              <p className="text-xs text-gray-500">Manage customer product reviews</p>
            </div>
          </div>
          <button
            onClick={fetchReviews}
            className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-medium shadow-sm border border-gray-200 transition-all hover:shadow-md"
          >
            <span>🔄</span>
            Refresh
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex gap-4">
          <select
            value={filterProduct}
            onChange={(e) => setFilterProduct(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-black"
          >
            <option value="all">All Products</option>
            {uniqueProducts.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Search reviews..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading reviews...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-200/50 p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">⭐</span>
            </div>
            <p className="text-gray-500 font-medium">No reviews found</p>
          </div>
        ) : (
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl overflow-hidden border border-gray-200/50 shadow-sm">
            <table className="w-full">
              <thead className="bg-gray-50/80">
                <tr>
                  <th className="text-left px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Product</th>
                  <th className="text-left px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Customer</th>
                  <th className="text-center px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Rating</th>
                  <th className="text-left px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Comment</th>
                  <th className="text-left px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Date</th>
                  <th className="text-right px-5 py-4 text-gray-500 text-xs font-semibold uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((review) => (
                  <tr key={review.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {review.product.imageUrl ? (
                          <img src={review.product.imageUrl} alt={review.product.name} className="w-8 h-8 rounded object-cover" />
                        ) : (
                          <span className="text-xl">☕</span>
                        )}
                        <p className="text-gray-900 font-medium text-sm">{review.product.name}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-gray-900 font-medium text-sm">{review.customerName}</p>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {renderStars(review.rating)}
                        <span className="text-xs text-gray-500">({review.rating})</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-600 max-w-xs">
                      <div className="space-y-1">
                        {review.comment && <p>{review.comment}</p>}
                        {review.tasteSuggestion && (
                          <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">
                            💡 {review.tasteSuggestion}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-500">
                      {new Date(review.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleDelete(review.id)}
                          className="text-red-600 hover:text-red-800 px-3 py-1.5 rounded-xl text-xs font-medium hover:bg-red-50 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
