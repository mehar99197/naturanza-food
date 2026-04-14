import { useEffect, useMemo, useState } from "react";
import { Heart, Loader2, ShoppingCart, Trash2, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { wishlistAPI } from "@/services/api";
import { useCart } from "@/context/CartContext";
import { useSettings } from "@/context/SettingsContext";
import { formatPrice } from "@/lib/utils";
import { products as localProducts } from "@/data/products";

const normalizeProductId = (value) => String(value || "").trim();

const emitWishlistUpdated = () => {
  window.dispatchEvent(new Event("wishlistUpdated"));
};

const resolveImage = (item) => {
  if (!item?.image_url) {
    return "/images/products/powder.webp";
  }

  if (item.image_url.startsWith("http")) {
    return item.image_url;
  }

  if (item.image_url.startsWith("/")) {
    return item.image_url;
  }

  return `/images/products/${item.image_url}`;
};

export function ProfileWishlist() {
  const { settings } = useSettings();
  const { addToCart } = useCart();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [movingId, setMovingId] = useState(null);
  const [removingId, setRemovingId] = useState(null);

  const localProductsMap = useMemo(() => {
    return localProducts.reduce((acc, product) => {
      acc[normalizeProductId(product.id)] = product;
      return acc;
    }, {});
  }, []);

  const loadWishlist = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await wishlistAPI.get();
      setItems(Array.isArray(response?.items) ? response.items : []);
    } catch (err) {
      setError(err.response?.data?.error || "Could not load wishlist");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWishlist();

    const handleWishlistUpdated = () => {
      void loadWishlist();
    };

    window.addEventListener("wishlistUpdated", handleWishlistUpdated);

    return () => {
      window.removeEventListener("wishlistUpdated", handleWishlistUpdated);
    };
  }, []);

  const removeItemFromList = (productId) => {
    const normalized = normalizeProductId(productId);
    setItems((prev) =>
      prev.filter(
        (item) => normalizeProductId(item.product_id || item.id) !== normalized,
      ),
    );
  };

  const handleRemove = async (productId) => {
    try {
      setRemovingId(productId);
      setError("");
      await wishlistAPI.removeByProduct(productId);
      removeItemFromList(productId);
      setSuccess("Item removed from wishlist.");
      setTimeout(() => setSuccess(""), 2500);
      emitWishlistUpdated();
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

      await wishlistAPI.removeByProduct(productId);
      removeItemFromList(productId);
      setSuccess("Moved to cart successfully.");
      setTimeout(() => setSuccess(""), 2500);
      emitWishlistUpdated();
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
            const fallback = localProductsMap[normalizeProductId(productId)] || {};
            const rating = Number(item.rating || fallback.rating || 0);
            const reviewCount = Number(item.reviews || fallback.reviews || 0);

            return (
              <article
                key={`${productId}-${item.id || "wishlist"}`}
                className="border border-gray-100 rounded-xl overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow p-2.5 sm:p-0"
              >
                <div className="flex gap-3 sm:block">
                  <Link
                    to={`/product/${productId}`}
                    className="block h-24 w-24 flex-shrink-0 rounded-lg bg-gray-50 sm:h-auto sm:w-full sm:rounded-none sm:aspect-[4/3]"
                  >
                    <img
                      src={resolveImage(item)}
                      alt={item.name || fallback.name || "Wishlist product"}
                      className="w-full h-full object-contain sm:object-cover"
                      onError={(event) => {
                        event.currentTarget.src = "/images/products/powder.webp";
                      }}
                    />
                  </Link>

                  <div className="min-w-0 flex-1 sm:p-4">
                    <Link
                      to={`/product/${productId}`}
                      className="text-sm sm:text-base font-semibold text-gray-900 hover:text-green-700 line-clamp-2"
                    >
                      {item.name || fallback.name || "Product"}
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

                    <p className="mt-1.5 sm:mt-2 text-base sm:text-lg font-bold text-green-700">
                      {formatPrice(Number(item.price || fallback.price || 0), settings.currency)}
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
