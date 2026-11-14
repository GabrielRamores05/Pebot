'use client';

import { useState, useEffect, useCallback } from 'react';

// Self-contained reviews block for a single product: stats header, review
// list, and the write-review form. Used inside the product popup on the
// customer menu.
export default function ProductReviews({
  productId,
  defaultWriteOpen = false,
  onSubmitted,
}: {
  productId: number;
  defaultWriteOpen?: boolean;
  onSubmitted?: (rating: number) => void;
}) {
  const [reviews, setReviews] = useState<
    { id: number; customerName: string; rating: number; comment: string | null; imageUrl: string | null; createdAt: string }[]
  >([]);
  const [avgRating, setAvgRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showList, setShowList] = useState(true);
  const [showWrite, setShowWrite] = useState(defaultWriteOpen);
  const [submitting, setSubmitting] = useState(false);

  const [reviewerName, setReviewerName] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('loyaltyCustomerName') || '';
    }
    return '';
  });
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [error, setError] = useState('');

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reviews?productId=${productId}`);
      const data = await res.json();
      if (res.ok) {
        setReviews(data.reviews || []);
        setAvgRating(data.averageRating || 0);
        setTotalReviews(data.totalReviews || 0);
      }
    } catch (e) {
      console.error('Error fetching reviews:', e);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  async function submitReview() {
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }
    setSubmitting(true);
    setError('');

    const nameToUse = reviewerName.trim() || 'Guest';

    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          customerName: nameToUse,
          rating,
          comment: comment.trim() ? comment.trim() : null,
          tasteSuggestion: suggestion ? suggestion.trim() : null,
        }),
      });

      if (res.ok) {
        setRating(0);
        setComment('');
        setSuggestion('');
        setShowWrite(false);
        fetchReviews();
        onSubmitted?.(rating);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to submit review');
      }
    } catch {
      setError('Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-3 border-t border-gray-100 pt-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900">Customer Reviews</h4>
        <button
          onClick={() => setShowList((s) => !s)}
          className="text-xs font-medium text-gray-500 hover:text-gray-700"
        >
          {showList ? 'Hide' : 'Show'}
        </button>
      </div>

      {!loading && (
        <p className="mb-2 text-xs text-gray-500">
          {totalReviews > 0
            ? `${'⭐'.repeat(Math.round(avgRating))} ${avgRating.toFixed(1)}/5 · ${totalReviews} review${totalReviews > 1 ? 's' : ''}`
            : 'No reviews yet'}
        </p>
      )}

      {loading ? (
        <div className="py-4 text-center text-sm text-gray-500">Loading reviews...</div>
      ) : !showList ? null : reviews.length === 0 ? (
        <div className="rounded-2xl bg-gray-50 py-4 text-center text-sm text-gray-500">
          No reviews yet. Be the first to review!
        </div>
      ) : (
        <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
          {reviews.map((review) => (
            <div key={review.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-gray-800">{review.customerName}</p>
                <p className="text-[10px] text-gray-400">{new Date(review.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="mb-1 text-xs text-amber-500">
                {'⭐'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
              </div>
              {review.comment && <p className="text-xs leading-5 text-gray-600">{review.comment}</p>}
              {review.imageUrl && (
                <img src={review.imageUrl} alt="Review attachment" className="mt-2 h-20 w-full rounded-lg object-cover" />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 rounded-2xl bg-gray-50 p-3">
        {!showWrite ? (
          <button
            onClick={() => setShowWrite(true)}
            className="w-full rounded-full bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800"
          >
            Write a Review
          </button>
        ) : (
          <div className="space-y-2">
            <div className="rounded-xl bg-white px-3 py-2 text-sm text-gray-700">
              {reviewerName || 'Guest'}
            </div>

            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className="text-2xl transition-transform hover:scale-110"
                >
                  {star <= rating ? '⭐' : '☆'}
                </button>
              ))}
            </div>

            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value.slice(0, 200))}
              rows={2}
              maxLength={200}
              placeholder="Tell us what you liked"
              className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
            <p className="text-right text-[10px] text-gray-400">{comment.length}/200</p>

            <textarea
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value.slice(0, 300))}
              rows={2}
              maxLength={300}
              placeholder="Suggestions for taste improvement (optional)"
              className="mt-2 w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
            <p className="text-right text-[10px] text-gray-400">{suggestion.length}/300</p>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <button
              onClick={submitReview}
              disabled={submitting}
              className="w-full rounded-full bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Review'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
