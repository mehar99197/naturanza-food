import { useMemo } from "react";
import { Link } from "react-router-dom";
import { MessageSquare, Star } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useReviews } from "@/context/ReviewContext";
import { products as localProducts } from "@/data/products";

const renderStars = (rating) => {
  const normalized = Math.max(0, Math.min(5, Number(rating) || 0));
  const filled = Math.round(normalized);

  return Array.from({ length: 5 }).map((_, index) => (
    <Star
      key={`star-${index}`}
      className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${index < filled ? "text-amber-500 fill-amber-500" : "text-gray-300"}`}
    />
  ));
};

const formatDate = (value) => {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
};

export function ProfileReviews() {
  const { user } = useAuth();
  const { reviews } = useReviews();

  const productLookup = useMemo(() => {
    return localProducts.reduce((acc, product) => {
      acc[String(product.id)] = product;
      return acc;
    }, {});
  }, []);

  const myReviews = useMemo(() => {
    if (!user?.name) {
      return [];
    }

    return reviews
      .filter((review) => String(review.userName || "") === String(user.name))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [reviews, user?.name]);

  return (
    <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-3 sm:p-8 border border-gray-100">
      {myReviews.length === 0 ? (
        <div className="py-8 sm:py-10 text-center">
          <MessageSquare className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-2.5 sm:mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-1">No reviews yet</h3>
          <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-5">
            Your submitted product reviews will appear here.
          </p>
          <Link
            to="/shop"
            className="inline-flex min-h-[42px] items-center justify-center px-4 sm:px-5 py-2.5 rounded-lg bg-green-600 text-white hover:bg-green-700"
          >
            Browse Products
          </Link>
        </div>
      ) : (
        <div className="space-y-2.5 sm:space-y-4">
          {myReviews.map((review, index) => {
            const product = productLookup[String(review.productId)] || null;

            return (
              <article
                key={review.id || `${review.productId}-${index}`}
                className="rounded-xl border border-gray-100 p-3 sm:p-4 hover:border-green-200 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs sm:text-sm text-gray-500">{formatDate(review.date)}</p>
                  <div className="flex items-center gap-1">{renderStars(review.rating)}</div>
                </div>

                {product ? (
                  <Link
                    to={`/product/${review.productId}`}
                    className="mt-1 block text-[15px] sm:text-base font-semibold text-gray-900 hover:text-green-700 line-clamp-1"
                  >
                    {product.name}
                  </Link>
                ) : (
                  <h4 className="mt-1 text-[15px] sm:text-base font-semibold text-gray-900 line-clamp-1">
                    Product #{review.productId}
                  </h4>
                )}

                <p className="mt-2 text-sm text-gray-700 leading-relaxed break-words">
                  {review.comment || "No comment added."}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ProfileReviews;
