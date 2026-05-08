import { useMemo, useState } from 'react';
import { Star } from 'lucide-react';

// Mock reviews removed - now using real reviews from database
const DEFAULT_REVIEWS = [];

function formatDate(dateValue) {
 const parsed = new Date(dateValue);
 if (Number.isNaN(parsed.getTime())) return dateValue;

 return parsed.toLocaleDateString('en-US', {
 year: 'numeric',
 month: 'short',
 day: 'numeric',
 });
}

function renderStars(rating, interactive = false, onSelect = () => {}, hoverValue = 0) {
 const activeValue = interactive && hoverValue > 0 ? hoverValue : rating;

 return (
 <div className="flex items-center gap-1">
 {[1, 2, 3, 4, 5].map((starValue) => {
 const isActive = starValue <= activeValue;

 return (
 <button
 key={starValue}
 type={interactive ? 'button' : undefined}
 onClick={interactive ? () => onSelect(starValue) : undefined}
 className={interactive ? ' ' : 'cursor-default'}
 aria-label={interactive ? `Set rating ${starValue}` : undefined}
 >
 <Star
 className={`h-5 w-5 ${isActive ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
 />
 </button>
 );
 })}
 </div>
 );
}

export function ProductReviews({
  isLoggedIn = false,
  user = null,
  mockReviews = DEFAULT_REVIEWS,
  onLoginClick,
  onSubmitReview,
}) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localReviews, setLocalReviews] = useState(mockReviews);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);

  // Check if user is actually logged in - if isLoggedIn is true, user is logged in
  // The token check is redundant because AuthContext already verifies this
  const isActuallyLoggedIn = isLoggedIn;

 const displayedReviews = useMemo(() => {
 return Array.isArray(mockReviews) && mockReviews.length > 0 ? mockReviews : localReviews;
 }, [mockReviews, localReviews]);

 const visibleReviews = showAllReviews ? displayedReviews : displayedReviews.slice(0, 3);

 const handleSubmit = async (event) => {
 event.preventDefault();

 if (!rating || !comment.trim() || isSubmitting) return;

 setIsSubmitting(true);

 const newReview = {
 id: Date.now(),
 name: user?.name || user?.fullName || 'You',
 date: new Date().toISOString(),
 rating,
 comment: comment.trim(),
 userAvatar: user?.profileImage || user?.avatar || localStorage.getItem('profileImage') || '',
 };

 try {
 if (typeof onSubmitReview === 'function') {
 await onSubmitReview(newReview);
 } else {
 setLocalReviews((prev) => [newReview, ...prev]);
 }

 setRating(0);
 setHoverRating(0);
 setComment('');
 } finally {
 setIsSubmitting(false);
 }
 };

 return (
 <section className="mt-8 md:mt-10 rounded-2xl bg-[#fdfdfb] p-4 sm:p-6 md:p-8">
 <h2 className="mb-4 md:mb-6 border-b border-gray-200 pb-3 md:pb-4 text-[1.75rem] md:text-2xl font-bold text-gray-900">
 Customer Reviews
 </h2>

 {!isActuallyLoggedIn ? (
 <div className="mb-8 rounded-xl border border-green-100 bg-green-50/60 p-6 text-center">
 <p className="mb-4 text-base font-medium text-gray-700">
 Please log in to leave a review
 </p>
 <button
 type="button"
 onClick={onLoginClick}
 className="bg-green-600 text-white rounded-lg px-6 py-2 hover:bg-green-700"
 >
 Log In
 </button>
 </div>
 ) : (
 <>
 <button
 type="button"
 onClick={() => setShowReviewForm((prev) => !prev)}
 className="md:hidden mb-3 w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700"
 >
 {showReviewForm ? 'Hide Review Form' : 'Write a Review'}
 </button>

 <form
 onSubmit={handleSubmit}
 className={`mb-6 md:mb-8 rounded-xl border border-gray-200 bg-white p-4 md:p-5 shadow-sm ${showReviewForm ? 'block' : 'hidden md:block'}`}
 >
 <h3 className="mb-4 text-lg font-semibold text-gray-900">Write a Review</h3>

 <div
 className="mb-4"
 onMouseLeave={() => setHoverRating(0)}
 >
 <p className="mb-2 text-sm font-medium text-gray-700">Your Rating</p>
 <div className="flex items-center gap-1">
 {[1, 2, 3, 4, 5].map((starValue) => {
 const isActive = starValue <= (hoverRating || rating);
 return (
 <button
 key={starValue}
 type="button"
 onMouseEnter={() => setHoverRating(starValue)}
 onFocus={() => setHoverRating(starValue)}
 onClick={() => setRating(starValue)}
 className=""
 aria-label={`Rate ${starValue} stars`}
 >
 <Star
 className={`h-6 w-6 ${isActive ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
 />
 </button>
 );
 })}
 </div>
 </div>

 <div className="mb-4">
 <label htmlFor="review-comment" className="mb-2 block text-sm font-medium text-gray-700">
 Your Comment
 </label>
 <textarea
 id="review-comment"
 rows={4}
 value={comment}
 onChange={(event) => setComment(event.target.value)}
 placeholder="Share your experience with this product..."
 className="w-full rounded-lg border-gray-200 bg-gray-50 p-4 focus:ring-2 focus:ring-green-500/20 focus:outline-none"
 />
 </div>

 <button
 type="submit"
 disabled={!rating || !comment.trim() || isSubmitting}
 className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-6 py-2 disabled:cursor-not-allowed disabled:opacity-60"
 >
 {isSubmitting ? 'Submitting...' : 'Submit Review'}
 </button>
 </form>
 </>
 )}

 <div className="grid gap-4 sm:gap-5">
 {visibleReviews.map((review) => (
 <article key={review.id} className="rounded-xl bg-white p-4 md:p-6 shadow-sm">
 <div className="flex items-start gap-3">
 {review.userAvatar ? (
 <img
 src={review.userAvatar}
 alt={review.name || 'Reviewer'}
 className="h-10 w-10 rounded-full object-cover border border-gray-200"
 />
 ) : (
 <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-600">
 {String(review.name || 'U').charAt(0).toUpperCase()}
 </div>
 )}

 <div className="flex-1">
 <div className="mb-2 flex items-center justify-between gap-2">
 <div>
 <p className="font-semibold text-gray-900">{review.name}</p>
 <p className="text-xs text-gray-500">{formatDate(review.date)}</p>
 </div>
 {renderStars(review.rating)}
 </div>

 <p className="mt-3 text-gray-600">{review.comment}</p>
 </div>
 </div>
 </article>
 ))}
 </div>

 {displayedReviews.length > 3 && (
 <div className="mt-4 md:hidden">
 <button
 type="button"
 onClick={() => setShowAllReviews((prev) => !prev)}
 className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700"
 >
 {showAllReviews ? 'Show Less Reviews' : `Show All Reviews (${displayedReviews.length})`}
 </button>
 </div>
 )}
 </section>
 );
}

export default ProductReviews;
