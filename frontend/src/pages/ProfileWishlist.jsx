import { useEffect, useState } from "react";
import { Heart, Loader2, ShoppingCart, Trash2, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { useCart } from "@/context/CartContext";
import { useSettings } from "@/context/SettingsContext";
import { useWishlist } from "@/context/WishlistContext";
import { formatPrice } from "@/lib/utils";
import { getAbsoluteImageUrl } from "@/lib/imageUtils";
import { getProductContentDefaults } from "@/lib/productContentDefaults";

const resolveImage = (item) => {
  const imageValue = item?.image_url || item?.image || "";
  if (!imageValue) {
    return "/images/products/honey.webp";
  }

  // Use getAbsoluteImageUrl to convert relative URLs to absolute backend URLs
  return getAbsoluteImageUrl(imageValue, { defaultFolder: 'products' });
};

export function ProfileWishlist() {
  const { settings } = useSettings();
  const { addToCart } = useCart();
  const {
    items,
    loading,
    error: wishlistError,
    refreshWishlist,
    removeFromWishlist,
  } = useWishlist();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [movingId, setMovingId] = useState(null);
  const [removingId, setRemovingId] = useState(null);

  useEffect(() => {
    setError(wishlistError || "");
  }, [wishlistError]);

  const handleRemove = async (productId) => {
    try {
      setRemovingId(productId);
      setError("");
      const result = await removeFromWishlist(productId);
      if (!result?.success) {
        setError(result?.message || "Failed to remove wishlist item");
        return;
      }

      setSuccess("Item removed from wishlist.");
      setTimeout(() => setSuccess(""), 2500);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to remove wishlist item");
    } finally {
      setRemovingId(null);
    }
  };

  const handleMoveToCart = async (productId) => {
    try {
      setMovingId(productId);
      setError("");

      const addResult = await addToCart({ id: productId }, 1);
      if (!addResult?.success) {
        setError(addResult?.error || "Could not move item to cart");
        return;
      }

      const removeResult = await removeFromWishlist(productId);
      if (!removeResult?.success) {
        setError(removeResult?.message || "Could not move item to cart");
        return;
      }

      await refreshWishlist({ silent: true });
      setSuccess("Moved to cart successfully.");
      setTimeout(() => setSuccess(""), 2500);
    } catch (err) {
      setError(err.response?.data?.error || "Could not move item to cart");
    } finally {
      setMovingId(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-8 border border-gray-100 flex items-center justify-center min-h-[220px] sm:min-h-[320px]">
        <div className="flex items-center gap-2 text-green-700 font-medium">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading wishlist...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-3 sm:p-8 border border-gray-100">
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          {success}
        </div>
      )}

      {items.length === 0 ? (
        <div className="py-8 sm:py-12 text-center">
          <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-3 sm:mb-4 rounded-full bg-green-50 flex items-center justify-center">
            <Heart className="w-8 h-8 sm:w-10 sm:h-10 text-green-500" />
          </div>
          <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-1.5 sm:mb-2">
            Your wishlist is empty
          </h3>
          <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">
            Save your favorite herbal products to view them here.
          </p>
          <Link
            to="/shop"
            className="inline-flex items-center justify-center min-h-[42px] px-4 sm:px-5 py-2.5 rounded-lg bg-green-600 text-white hover:bg-green-700"
          >
            Browse Products
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-5">
          {items.map((item) => {
            const productId = item.product_id || item.id;
            const rating = Number(item.average_rating ?? item.rating ?? 0);
            const reviewCount = Number(item.review_count ?? item.reviews ?? 0);
            const isInStock = Number(item.in_stock ?? item.stock_quantity ?? 0) > 0;
            const contentDefaults = getProductContentDefaults(item);
            const shortDescription = String(
              item.description || contentDefaults?.description || "",
            ).trim();
            const discount = Number(item.discount_percentage || 0);

            return (
              <article
                key={`${productId}-${item.id || "wishlist"}`}
                className="border border-gray-100 rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow p-2.5 sm:p-0"
              >
                <div className="flex gap-3 sm:block">
                  <Link
                    to={`/product/${productId}`}
                    className="block h-24 w-24 flex-shrink-0 rounded-lg bg-gradient-to-br from-emerald-50 via-white to-lime-50 sm:h-auto sm:w-full sm:rounded-none sm:aspect-[4/3]"
                  >
                    <img
                      src={resolveImage(item)}
                      alt={item.name || "Wishlist product"}
                      className="w-full h-full object-contain p-2 sm:p-4"
                      onError={(event) => {
                        event.currentTarget.src = "/images/products/honey.webp";
                      }}
                    />
                  </Link>

                  <div className="min-w-0 flex-1 sm:p-4">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs">
                      {item.category_name && (
                        <span className="rounded-full bg-green-50 px-2.5 py-1 font-medium text-green-700">
                          {item.category_name}
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2.5 py-1 font-medium ${
                          isInStock
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {isInStock ? "In Stock" : "Out of Stock"}
                      </span>
                      {discount > 0 && (
                        <span className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-700">
                          {discount}% OFF
                        </span>
                      )}
                    </div>

                    <Link
                      to={`/product/${productId}`}
                      className="mt-2 block text-sm sm:text-base font-semibold text-gray-900 hover:text-green-700 line-clamp-2"
                    >
                      {item.name || "Product"}
                    </Link>

                    <div className="mt-1.5 sm:mt-2 flex items-center gap-1.5 text-xs sm:text-sm text-amber-600">
                      <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
                      <span className="font-medium">
                        {rating > 0 ? rating.toFixed(1) : "N/A"}
                      </span>
                      {reviewCount > 0 && (
                        <span className="text-gray-500">({reviewCount})</span>
                      )}
                    </div>

                    {shortDescription ? (
                      <p className="mt-2 text-xs sm:text-sm leading-6 text-gray-600 line-clamp-2">
                        {shortDescription}
                      </p>
                    ) : (
                      <p className="mt-2 text-xs sm:text-sm leading-6 text-gray-400">
                        View full product details and customer reviews.
                      </p>
                    )}

                    <p className="mt-1.5 sm:mt-2 text-base sm:text-lg font-bold text-green-700">
                      {formatPrice(Number(item.price || 0), settings.currency)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 sm:mt-4 flex gap-2 sm:px-4 sm:pb-4">
                  <button
                    type="button"
                    onClick={() => handleMoveToCart(productId)}
                    disabled={movingId === productId}
                    className="flex-1 inline-flex min-h-[40px] sm:min-h-[42px] items-center justify-center gap-2 px-3 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-70"
                  >
                    {movingId === productId ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ShoppingCart className="w-4 h-4" />
                    )}
                    Move to Cart
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRemove(productId)}
                    disabled={removingId === productId}
                    className="inline-flex min-h-[40px] w-11 sm:w-auto items-center justify-center px-3 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-70"
                    aria-label="Remove from wishlist"
                  >
                    {removingId === productId ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ProfileWishlist;
