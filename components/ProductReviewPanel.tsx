'use client';

import { useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Star, ThumbsDown, ThumbsUp } from 'lucide-react';
import type { Product } from '@/lib/products';
import type { ProductReview } from '@/types/domain';
import { useShopStore } from '@/store/shopStore';

const EMPTY_REVIEWS: ProductReview[] = [];

type ReviewSort = 'recent' | 'high' | 'low' | 'helpful';

type ProductReviewPanelProps = {
  product: Product;
  signedIn: boolean;
};

export default function ProductReviewPanel({
  product,
  signedIn,
}: ProductReviewPanelProps) {
  // Select the stored value directly. Returning `[]` inside this selector would
  // create a new array on every Zustand snapshot and break React's snapshot cache.
  const storedReviews = useShopStore((state) => state.reviews[product.id]);
  const reviews = storedReviews ?? EMPTY_REVIEWS;
  const addReview = useShopStore((state) => state.addReview);
  const voteReview = useShopStore((state) => state.voteReview);
  const user = useShopStore((state) => state.user);

  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sort, setSort] = useState<ReviewSort>('recent');
  const [error, setError] = useState('');

  const sortedReviews = useMemo(() => {
    return [...reviews].sort((a, b) => {
      if (sort === 'high') return b.rating - a.rating;
      if (sort === 'low') return a.rating - b.rating;
      if (sort === 'helpful') return b.helpful - a.helpful;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [reviews, sort]);

  const ratingCounts = useMemo(
    () => [5, 4, 3, 2, 1].map((value) => ({
      rating: value,
      count: reviews.filter((review) => review.rating === value).length,
    })),
    [reviews],
  );

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!user) {
      setError('Sign in to submit a review.');
      return;
    }

    const trimmedBody = body.trim();
    if (trimmedBody.length < 15 || trimmedBody.length > 800) {
      setError('Review text must be between 15 and 800 characters.');
      return;
    }

    let hasPurchased = false;
    try {
      const response = await fetch('/api/orders', { cache: 'no-store' });
      if (response.ok) {
        const payload = await response.json() as {
          orders?: Array<{ order_items?: Array<{ product_id?: string | null }> }>;
        };
        hasPurchased = (payload.orders ?? []).some((order) =>
          (order.order_items ?? []).some((item) => item.product_id === product.id),
        );
      }
    } catch {
      // Reviews remain available if order history is temporarily unreachable;
      // the review is simply not marked as a verified purchase.
    }

    addReview({
      id: `review-${Date.now()}`,
      productId: product.id,
      userId: user.id,
      userName: user.name,
      rating,
      title: title.trim().slice(0, 80) || 'Customer review',
      body: trimmedBody,
      createdAt: new Date().toISOString(),
      helpful: 0,
      notHelpful: 0,
      verifiedPurchase: hasPurchased,
    });

    setTitle('');
    setBody('');
    setRating(5);
    setError('');
  }

  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow text-moss">Community notes</p>
          <h2 className="mt-2 text-2xl font-semibold">Ratings &amp; reviews</h2>
        </div>
        <select
          aria-label="Sort reviews"
          value={sort}
          onChange={(event) => setSort(event.target.value as ReviewSort)}
          className="rounded-xl border border-ink/10 bg-white px-3 py-2 text-xs"
        >
          <option value="recent">Most recent</option>
          <option value="high">Highest rated</option>
          <option value="low">Lowest rated</option>
          <option value="helpful">Most helpful</option>
        </select>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-[220px_1fr]">
        <div className="rounded-2xl border border-ink/10 bg-white p-4">
          <p className="text-3xl font-semibold">
            {product.rating.toFixed(1)}
            <span className="text-sm text-ink/40"> / 5</span>
          </p>
          <p className="mt-1 flex items-center gap-1 text-amber-500" aria-label="Catalogue rating">
            {[1, 2, 3, 4, 5].map((value) => (
              <Star key={value} size={13} fill="currentColor" />
            ))}
          </p>
          <p className="mt-1 text-[10px] text-ink/45">
            Catalogue rating · {product.reviews} seed reviews
          </p>

          <div className="mt-5 space-y-2">
            {ratingCounts.map((row) => (
              <div key={row.rating} className="flex items-center gap-2 text-[10px]">
                <span>{row.rating}★</span>
                <div className="h-1.5 flex-1 rounded-full bg-ink/10">
                  <div
                    className="h-full rounded-full bg-moss"
                    style={{ width: `${reviews.length ? (row.count / reviews.length) * 100 : 0}%` }}
                  />
                </div>
                <span>{row.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {sortedReviews.length ? (
            sortedReviews.map((review) => (
              <article key={review.id} className="rounded-2xl border border-ink/10 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{review.title}</p>
                    <p className="mt-1 text-[10px] text-ink/45">
                      {review.userName} · {new Date(review.createdAt).toLocaleDateString()}
                      {review.verifiedPurchase ? ' · Verified purchase (local order history)' : ''}
                    </p>
                  </div>
                  <span className="flex items-center gap-1 text-xs font-bold">
                    {review.rating}
                    <Star size={12} fill="#dda83a" stroke="#dda83a" />
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-ink/65">{review.body}</p>
                <div className="mt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={() => voteReview(product.id, review.id, true)}
                    className="flex items-center gap-1 text-[10px] text-ink/50"
                  >
                    <ThumbsUp size={12} /> Helpful {review.helpful}
                  </button>
                  <button
                    type="button"
                    onClick={() => voteReview(product.id, review.id, false)}
                    className="flex items-center gap-1 text-[10px] text-ink/50"
                  >
                    <ThumbsDown size={12} /> Not helpful {review.notHelpful}
                  </button>
                </div>
              </article>
            ))
          ) : (
            <p className="rounded-2xl border border-dashed border-ink/15 p-6 text-sm text-ink/50">
              No community reviews yet. Be the first to leave one.
            </p>
          )}
        </div>
      </div>

      <form onSubmit={submitReview} className="mt-5 rounded-2xl border border-ink/10 bg-white p-5">
        <h3 className="font-semibold">Write a review</h3>
        {signedIn ? (
          <>
            <div className="mt-3 flex items-center gap-2">
              <label htmlFor="review-rating" className="text-xs">Your rating</label>
              <select
                id="review-rating"
                value={rating}
                onChange={(event) => setRating(Number(event.target.value))}
                className="rounded-lg border border-ink/10 px-2 py-1 text-xs"
              >
                {[5, 4, 3, 2, 1].map((value) => (
                  <option key={value} value={value}>{value} stars</option>
                ))}
              </select>
            </div>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={80}
              placeholder="Review title (optional)"
              className="mt-3 w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm"
            />
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              minLength={15}
              maxLength={800}
              required
              placeholder="What should other shoppers know? (15–800 characters)"
              className="mt-3 min-h-28 w-full rounded-xl border border-ink/10 px-3 py-3 text-sm"
            />
            {error && <p role="alert" className="mt-2 text-xs text-rose-600">{error}</p>}
            <button type="submit" className="pill-button mt-3 bg-ink text-white">
              Submit review
            </button>
          </>
        ) : (
          <p className="mt-2 text-xs text-ink/55">
            Please <Link href="/login" className="font-bold text-moss">sign in</Link> to submit a review.
          </p>
        )}
      </form>
    </section>
  );
}
