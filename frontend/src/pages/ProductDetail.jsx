import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Star,
  ShoppingCart,
  Check,
  Minus,
  Plus,
  Heart,
  Share2,
  Truck,
  Shield,
  Package,
  ChevronLeft,
  ChevronRight,
  Leaf,
  Award,
  Zap,
  Clock,
} from 'lucide-react';
import { useProducts } from '@/context/ProductContext';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { useReviews } from '@/context/ReviewContext';
import { useWishlist } from '@/context/WishlistContext';
import { formatPrice } from '@/lib/utils';
import { ProductCard } from '@/components/ProductCard';
import { ProductDetailSkeleton } from '@/components/Skeletons/ProductDetailSkeleton';
import ProductReviews from '@/components/ProductReviews';
import { SEO } from '@/components/SEO';
import {
  ProductStructuredData,
  BreadcrumbStructuredData,
} from '@/components/StructuredData';

const FALLBACK_IMAGE = '/images/products/powder.webp';

const DETAIL_SECTIONS = [
  { key: 'description', label: 'Description' },
  { key: 'ingredients', label: 'Ingredients' },
  { key: 'benefits', label: 'Benefits' },
  { key: 'usage', label: 'Usage' },
];

const toArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || '').trim())
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const normalizeImageSource = (value) => {
  const imageValue = String(value || '').trim();
  if (!imageValue) return null;

  if (/^https?:\/\//i.test(imageValue)) return imageValue;
  if (imageValue.startsWith('/')) return imageValue;
  if (imageValue.startsWith('images/')) return `/${imageValue}`;

  return `/images/products/${imageValue}`;
};

const getGalleryImages = (product) => {
  if (!product) return [FALLBACK_IMAGE];

  const candidates = [
    product.image_url,
    product.image,
    ...toArray(product.image_urls),
    ...toArray(product.images),
    ...toArray(product.gallery_images),
  ];

  const normalized = candidates
    .map((item) => normalizeImageSource(item))
    .filter(Boolean);

  const unique = [...new Set(normalized)];
  return unique.length > 0 ? unique : [FALLBACK_IMAGE];
};

const clampQuantity = (value, maxAllowedQty) => {
  const parsed = Math.max(1, Number(value) || 1);
  if (maxAllowedQty) {
    return Math.min(parsed, maxAllowedQty);
  }
  return parsed;
};

export function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    getProductById,
    getProductsByCategory,
    loading: productsLoading,
  } = useProducts();
  const { addToCart } = useCart();
  const { isAuthenticated, user } = useAuth();
  const { settings } = useSettings();
  const { addReview, getProductReviews, getProductReviewStats } = useReviews();
  const { isInWishlist, isUpdating, toggleWishlist } = useWishlist();

  const [isLoading, setIsLoading] = useState(true);
  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [activeDesktopTab, setActiveDesktopTab] = useState('description');
  const [activeMobileSection, setActiveMobileSection] = useState('description');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    if (productsLoading) {
      return;
    }

    setIsLoading(true);

    const currentProduct = getProductById(id) || null;
    setProduct(currentProduct);

    if (currentProduct) {
      const categoryLookup =
        currentProduct.category_id ||
        currentProduct.category ||
        currentProduct.category_name ||
        'all';

      let pool = getProductsByCategory(categoryLookup);
      if (!Array.isArray(pool) || pool.length === 0) {
        pool = getProductsByCategory('all');
      }

      const nextRelated = (Array.isArray(pool) ? pool : [])
        .filter((item) => String(item.id) !== String(id))
        .slice(0, 8);

      setRelatedProducts(nextRelated);
    } else {
      setRelatedProducts([]);
    }

    setQuantity(1);
    setActiveImage(0);
    setActiveDesktopTab('description');
    setActiveMobileSection('description');

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    }

    const timeoutId = window.setTimeout(() => {
      setIsLoading(false);
    }, 220);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [id, productsLoading, getProductById, getProductsByCategory]);

  const productImages = useMemo(() => getGalleryImages(product), [product]);

  useEffect(() => {
    if (activeImage >= productImages.length) {
      setActiveImage(0);
    }
  }, [activeImage, productImages.length]);

  const ingredientsArray = useMemo(() => toArray(product?.ingredients), [product]);
  const benefitsArray = useMemo(() => toArray(product?.benefits), [product]);

  const productReviews = useMemo(
    () =>
      getProductReviews(id).map((review) => ({
        id: review.id,
        name: review.userName || review.name || 'Guest User',
        rating: Number(review.rating || 0),
        date: review.date,
        comment: review.comment || '',
        userAvatar:
          review.userAvatar ||
          review.avatar ||
          review.profileImage ||
          '',
      })),
    [getProductReviews, id],
  );

  const { reviewCount: liveReviewCount, averageRating: liveAverageRating } =
    getProductReviewStats(id);

  const displayedRating =
    liveReviewCount > 0 ? Number(liveAverageRating || 0) : Number(product?.rating || 0);

  const stockQuantity = Number(product?.stock_quantity ?? product?.stock ?? 0);
  const hasStock = Boolean(
    product?.inStock || product?.is_in_stock || stockQuantity > 0,
  );
  const maxAllowedQty =
    Number.isFinite(stockQuantity) && stockQuantity > 0 ? stockQuantity : null;

  const currentPrice = Number(product?.price || 0);
  const originalPrice = Number(product?.originalPrice || product?.original_price || 0);
  const hasDiscount = originalPrice > currentPrice;
  const savedAmount = hasDiscount ? originalPrice - currentPrice : 0;

  const productId = product?.id ?? id;
  const isWishlisted = isInWishlist(productId);
  const isWishlistUpdating = isUpdating(productId);

  const breadcrumbItems = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return [
      { name: 'Home', url: `${origin}/` },
      { name: 'Shop', url: `${origin}/shop` },
      {
        name: product?.name || 'Product',
        url: origin && productId ? `${origin}/product/${productId}` : '',
      },
    ];
  }, [product?.name, productId]);

  const showFeedback = (message) => {
    setToastMessage(message);
    setShowToast(true);
    window.setTimeout(() => setShowToast(false), 2000);
  };

  const goToLogin = () => {
    navigate('/login', {
      state: { from: { pathname: `/product/${id}` } },
    });
  };

  const handleAddToCart = async () => {
    if (!isAuthenticated) {
      goToLogin();
      return;
    }

    const result = await addToCart(product, clampQuantity(quantity, maxAllowedQty));

    if (result?.success) {
      showFeedback('Added to cart!');
    } else {
      showFeedback(result?.error || 'Unable to add item to cart.');
    }
  };

  const handleBuyNow = async () => {
    if (!isAuthenticated) {
      goToLogin();
      return;
    }

    const result = await addToCart(product, clampQuantity(quantity, maxAllowedQty));

    if (result?.success) {
      navigate('/checkout');
      return;
    }

    showFeedback(result?.error || 'Unable to continue to checkout.');
  };

  const handleWishlistToggle = async () => {
    if (!isAuthenticated) {
      goToLogin();
      return;
    }

    if (!product || isWishlistUpdating) {
      return;
    }

    const wasWishlisted = isWishlisted;
    const result = await toggleWishlist({
      ...product,
      id: product.id,
      product_id: product.id,
    });

    if (result?.success) {
      showFeedback(wasWishlisted ? 'Removed from wishlist' : 'Added to wishlist');
    } else if (result?.message) {
      showFeedback(result.message);
    }
  };

  const handleShare = async () => {
    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

    if (navigator.share) {
      try {
        await navigator.share({
          title: product?.name,
          text: product?.description,
          url: shareUrl,
        });
        return;
      } catch (error) {
      }
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        showFeedback('Link copied to clipboard!');
      }
    } catch (error) {
      showFeedback('Unable to share link right now.');
    }
  };

  const handleSubmitReview = async (newReview) => {
    const profileImage =
      user?.profileImage ||
      user?.avatar ||
      localStorage.getItem('profileImage') ||
      '';

    addReview(id, {
      id: newReview.id,
      rating: Number(newReview.rating || 0),
      comment: newReview.comment || '',
      date: newReview.date || new Date().toISOString(),
      userName: user?.name || 'Guest User',
      userAvatar: profileImage,
    });

    showFeedback('Review submitted successfully!');
  };

  const renderDetailSectionContent = (sectionKey) => {
    if (sectionKey === 'description') {
      return (
        <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
          <p>{product.description || 'No description available.'}</p>
          <p>
            Sourced with quality-first standards and designed for daily wellness use.
            Every batch is prepared with consistency, freshness, and safety in mind.
          </p>
        </div>
      );
    }

    if (sectionKey === 'ingredients') {
      if (ingredientsArray.length === 0) {
        return (
          <p className="text-sm text-gray-600">
            100% natural ingredient blend. No artificial preservatives.
          </p>
        );
      }

      return (
        <ul className="grid gap-2 sm:grid-cols-2">
          {ingredientsArray.map((ingredient, index) => (
            <li
              key={`${ingredient}-${index}`}
              className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-sm font-medium text-gray-700"
            >
              {ingredient}
            </li>
          ))}
        </ul>
      );
    }

    if (sectionKey === 'benefits') {
      if (benefitsArray.length === 0) {
        return (
          <p className="text-sm text-gray-600">
            Supports everyday health and immunity with naturally active compounds.
          </p>
        );
      }

      return (
        <ul className="space-y-2">
          {benefitsArray.map((benefit, index) => (
            <li
              key={`${benefit}-${index}`}
              className="flex items-start gap-2 text-sm text-gray-700"
            >
              <Zap className="mt-0.5 h-4 w-4 text-amber-500" />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
      );
    }

    return (
      <div className="space-y-3 text-sm text-gray-600 leading-relaxed">
        <p>{product.usage || 'Use as directed for your product type.'}</p>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-800">
          <p>
            Consult your healthcare professional before use if you are pregnant,
            nursing, or managing a medical condition.
          </p>
        </div>
      </div>
    );
  };

  const handleIncreaseQuantity = () => {
    setQuantity((prev) => clampQuantity(prev + 1, maxAllowedQty));
  };

  const handleDecreaseQuantity = () => {
    setQuantity((prev) => clampQuantity(prev - 1, maxAllowedQty));
  };

  const nextImage = () => {
    setActiveImage((prev) => (prev + 1) % productImages.length);
  };

  const prevImage = () => {
    setActiveImage((prev) =>
      prev === 0 ? productImages.length - 1 : prev - 1,
    );
  };

  const relatedGridClass =
    relatedProducts.length <= 2
      ? 'md:grid-cols-2'
      : relatedProducts.length === 3
        ? 'md:grid-cols-3'
        : 'md:grid-cols-2 lg:grid-cols-4';

  if (productsLoading || isLoading) {
    return <ProductDetailSkeleton />;
  }

  if (!product) {
    return (
      <main className="pt-24 pb-16 min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h1 className="font-display text-3xl font-bold text-[#2d3a2d] mb-4">
            Product Not Found
          </h1>
          <p className="text-gray-600 mb-2">Looking for product ID: {id}</p>
          <p className="text-gray-500 mb-6">This product does not exist or has been removed.</p>
          <Link
            to="/shop"
            className="inline-block px-6 py-3 bg-gradient-to-r from-[#3d7a3d] to-[#2d5a2d] text-white rounded-xl font-semibold hover:shadow-lg"
          >
            Back to Shop
          </Link>
        </div>
      </main>
    );
  }

  return (
    <>
      <SEO
        title={product.name}
        description={product.description}
        image={productImages[0]}
        type="product"
        price={String(currentPrice || '')}
        currency={settings.currency || 'PKR'}
        availability={hasStock ? 'in stock' : 'out of stock'}
      />

      <ProductStructuredData
        product={{
          ...product,
          image_url: productImages[0],
          averageRating: displayedRating,
          reviewCount: liveReviewCount,
          stock_quantity: hasStock ? maxAllowedQty || 1 : 0,
        }}
      />

      <BreadcrumbStructuredData items={breadcrumbItems} />

      <main className="pt-20 md:pt-24 pb-10 md:pb-16 bg-gradient-to-b from-[#f8fbf8] via-white to-[#f6faf6] min-h-screen">
        <div className="container-custom">
          <div className="mb-4 md:mb-7 flex items-center gap-2 text-xs md:text-sm text-[#6b7a6b]">
            <Link to="/" className="hover:text-[#2f7a2f]">Home</Link>
            <span>/</span>
            <Link to="/shop" className="hover:text-[#2f7a2f]">Shop</Link>
            <span>/</span>
            <span className="font-semibold text-[#2d3a2d] truncate">{product.name}</span>
          </div>

          <section className="md:hidden space-y-4">
            <div className="rounded-2xl border border-emerald-100 bg-white p-3 shadow-sm">
              <div className="relative rounded-xl bg-[#f8faf7] p-2">
                <img
                  src={productImages[activeImage]}
                  alt={product.name}
                  className="mx-auto aspect-square w-full max-w-[380px] object-contain"
                  onError={(event) => {
                    event.currentTarget.src = FALLBACK_IMAGE;
                  }}
                />

                {productImages.length > 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={prevImage}
                      className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full border border-gray-200 bg-white/90 p-1.5 text-gray-700"
                      aria-label="Previous image"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={nextImage}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-gray-200 bg-white/90 p-1.5 text-gray-700"
                      aria-label="Next image"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </>
                ) : null}
              </div>

              <div className="scrollbar-hide mt-3 flex gap-2 overflow-x-auto pb-1">
                {productImages.map((img, index) => (
                  <button
                    key={`${img}-${index}`}
                    type="button"
                    onClick={() => setActiveImage(index)}
                    className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-white p-1 ${
                      index === activeImage
                        ? 'border-emerald-500 ring-1 ring-emerald-300'
                        : 'border-gray-200'
                    }`}
                  >
                    <img
                      src={img}
                      alt={`${product.name} thumbnail ${index + 1}`}
                      className="h-full w-full object-contain"
                      onError={(event) => {
                        event.currentTarget.src = FALLBACK_IMAGE;
                      }}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
              <h1 className="text-[1.85rem] font-bold leading-tight text-[#233023]">{product.name}</h1>

              <div className="mt-2 flex items-center gap-2 text-sm">
                <div className="flex items-center gap-0.5 text-amber-500">
                  {[...Array(5)].map((_, index) => (
                    <Star
                      key={index}
                      className={`h-4 w-4 ${index < Math.round(displayedRating) ? 'fill-current' : ''}`}
                    />
                  ))}
                </div>
                <span className="font-semibold text-gray-700">{displayedRating.toFixed(1)}</span>
                <span className="text-gray-500">({liveReviewCount} reviews)</span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-3xl font-extrabold text-emerald-700">
                  {formatPrice(currentPrice, settings.currency)}
                </span>
                {hasDiscount ? (
                  <>
                    <span className="text-base text-gray-400 line-through">
                      {formatPrice(originalPrice, settings.currency)}
                    </span>
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600">
                      Save {formatPrice(savedAmount, settings.currency)}
                    </span>
                  </>
                ) : null}
              </div>

              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                {hasStock ? <Check className="h-3.5 w-3.5" /> : <Package className="h-3.5 w-3.5" />}
                {hasStock
                  ? `In stock${maxAllowedQty ? ` (${maxAllowedQty} left)` : ''}`
                  : 'Out of stock'}
              </div>

              <p className="mt-3 text-sm leading-relaxed text-gray-600">
                {product.description}
              </p>

              <div className="mt-4 flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
                <span className="text-sm font-semibold text-gray-700">Quantity</span>
                <div className="inline-flex items-center rounded-full border border-gray-200 bg-white p-1">
                  <button
                    type="button"
                    onClick={handleDecreaseQuantity}
                    disabled={!hasStock || quantity <= 1}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-gray-700 disabled:opacity-40"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="min-w-[30px] text-center text-sm font-bold text-gray-900">{quantity}</span>
                  <button
                    type="button"
                    onClick={handleIncreaseQuantity}
                    disabled={!hasStock || (maxAllowedQty !== null && quantity >= maxAllowedQty)}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-gray-700 disabled:opacity-40"
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={!hasStock}
                  className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  <ShoppingCart className="h-4 w-4" />
                  Add to Cart
                </button>

                <button
                  type="button"
                  onClick={handleBuyNow}
                  disabled={!hasStock}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#2f6f2f] px-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  Buy Now
                </button>
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleWishlistToggle}
                  disabled={isWishlistUpdating}
                  className={`inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border text-sm font-semibold ${
                    isWishlisted
                      ? 'border-red-200 bg-red-50 text-red-600'
                      : 'border-gray-200 bg-white text-gray-700'
                  } ${isWishlistUpdating ? 'opacity-60' : ''}`}
                >
                  <Heart className={`h-4 w-4 ${isWishlisted ? 'fill-current' : ''}`} />
                  Wishlist
                </button>

                <button
                  type="button"
                  onClick={handleShare}
                  className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-700"
                >
                  <Share2 className="h-4 w-4" />
                  Share
                </button>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-emerald-100 bg-emerald-50/50 p-2.5">
                <div className="text-center">
                  <Truck className="mx-auto h-4 w-4 text-emerald-700" />
                  <p className="mt-1 text-[11px] font-semibold text-gray-700">Free Shipping</p>
                </div>
                <div className="text-center">
                  <Shield className="mx-auto h-4 w-4 text-emerald-700" />
                  <p className="mt-1 text-[11px] font-semibold text-gray-700">Safe Checkout</p>
                </div>
                <div className="text-center">
                  <Clock className="mx-auto h-4 w-4 text-emerald-700" />
                  <p className="mt-1 text-[11px] font-semibold text-gray-700">Fast Dispatch</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-3.5 shadow-sm">
              {DETAIL_SECTIONS.map((section) => {
                const isOpen = activeMobileSection === section.key;
                return (
                  <div key={section.key} className="border-b border-gray-100 last:border-b-0">
                    <button
                      type="button"
                      onClick={() =>
                        setActiveMobileSection((prev) =>
                          prev === section.key ? '' : section.key,
                        )
                      }
                      className="flex w-full items-center justify-between py-3 text-left"
                    >
                      <span className="text-sm font-semibold text-gray-900">{section.label}</span>
                      <span className="text-lg font-semibold text-gray-500">{isOpen ? '-' : '+'}</span>
                    </button>
                    {isOpen ? (
                      <div className="pb-3">
                        {renderDetailSectionContent(section.key)}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="hidden md:block">
            <div className="grid grid-cols-12 items-start gap-8 lg:gap-10">
              <div className="col-span-7 space-y-5">
                <div className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
                  <div className="relative rounded-2xl bg-[#f7faf7] p-5">
                    <img
                      src={productImages[activeImage]}
                      alt={product.name}
                      className="mx-auto aspect-square w-full max-w-[620px] object-contain"
                      onError={(event) => {
                        event.currentTarget.src = FALLBACK_IMAGE;
                      }}
                    />

                    {productImages.length > 1 ? (
                      <>
                        <button
                          type="button"
                          onClick={prevImage}
                          className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full border border-gray-200 bg-white/90 p-2 text-gray-700"
                          aria-label="Previous image"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          onClick={nextImage}
                          className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-gray-200 bg-white/90 p-2 text-gray-700"
                          aria-label="Next image"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-3">
                  {productImages.map((img, index) => (
                    <button
                      key={`${img}-${index}`}
                      type="button"
                      onClick={() => setActiveImage(index)}
                      className={`aspect-square overflow-hidden rounded-xl border bg-white p-2 shadow-sm ${
                        index === activeImage
                          ? 'border-emerald-500 ring-1 ring-emerald-300'
                          : 'border-gray-200'
                      }`}
                    >
                      <img
                        src={img}
                        alt={`${product.name} thumbnail ${index + 1}`}
                        className="h-full w-full object-contain"
                        onError={(event) => {
                          event.currentTarget.src = FALLBACK_IMAGE;
                        }}
                      />
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                        <Leaf className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">100% Organic</p>
                        <p className="text-xs text-gray-500">Certified Natural</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                        <Award className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Premium Quality</p>
                        <p className="text-xs text-gray-500">Batch Tested</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <aside className="col-span-5">
                <div className="sticky top-28 rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
                  <h1 className="text-4xl font-bold leading-tight text-[#213121]">{product.name}</h1>

                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex items-center gap-0.5 text-amber-500">
                      {[...Array(5)].map((_, index) => (
                        <Star
                          key={index}
                          className={`h-5 w-5 ${index < Math.round(displayedRating) ? 'fill-current' : ''}`}
                        />
                      ))}
                    </div>
                    <span className="text-sm font-semibold text-gray-700">{displayedRating.toFixed(1)}</span>
                    <span className="text-sm text-gray-500">({liveReviewCount} reviews)</span>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2.5">
                    <span className="text-[2.1rem] font-extrabold text-emerald-700">
                      {formatPrice(currentPrice, settings.currency)}
                    </span>
                    {hasDiscount ? (
                      <>
                        <span className="text-lg text-gray-400 line-through">
                          {formatPrice(originalPrice, settings.currency)}
                        </span>
                        <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-600">
                          Save {formatPrice(savedAmount, settings.currency)}
                        </span>
                      </>
                    ) : null}
                  </div>

                  <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
                    {hasStock ? <Check className="h-4 w-4" /> : <Package className="h-4 w-4" />}
                    {hasStock
                      ? `In stock${maxAllowedQty ? ` (${maxAllowedQty} left)` : ''}`
                      : 'Out of stock'}
                  </div>

                  <p className="mt-4 text-[15px] leading-relaxed text-gray-600">{product.description}</p>

                  {benefitsArray.length > 0 ? (
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      {benefitsArray.slice(0, 4).map((benefit, index) => (
                        <div key={`${benefit}-${index}`} className="flex items-center gap-1.5 text-sm text-gray-600">
                          <Zap className="h-4 w-4 text-amber-500" />
                          <span className="truncate">{benefit}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  <div className="mt-5 flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5">
                    <span className="text-sm font-semibold text-gray-700">Quantity</span>
                    <div className="inline-flex items-center rounded-full border border-gray-200 bg-white p-1">
                      <button
                        type="button"
                        onClick={handleDecreaseQuantity}
                        disabled={!hasStock || quantity <= 1}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-gray-700 disabled:opacity-40"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="min-w-[36px] text-center text-base font-bold text-gray-900">{quantity}</span>
                      <button
                        type="button"
                        onClick={handleIncreaseQuantity}
                        disabled={!hasStock || (maxAllowedQty !== null && quantity >= maxAllowedQty)}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-gray-700 disabled:opacity-40"
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    <div className="grid grid-cols-[1fr_auto_auto] gap-2.5">
                      <button
                        type="button"
                        onClick={handleAddToCart}
                        disabled={!hasStock}
                        className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-base font-semibold text-white disabled:opacity-50"
                      >
                        <ShoppingCart className="h-4 w-4" />
                        Add to Cart
                      </button>

                      <button
                        type="button"
                        onClick={handleWishlistToggle}
                        disabled={isWishlistUpdating}
                        className={`inline-flex h-12 w-12 items-center justify-center rounded-xl border ${
                          isWishlisted
                            ? 'border-red-200 bg-red-50 text-red-600'
                            : 'border-gray-200 bg-white text-gray-700'
                        } ${isWishlistUpdating ? 'opacity-60' : ''}`}
                        aria-label="Toggle wishlist"
                      >
                        <Heart className={`h-5 w-5 ${isWishlisted ? 'fill-current' : ''}`} />
                      </button>

                      <button
                        type="button"
                        onClick={handleShare}
                        className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700"
                        aria-label="Share product"
                      >
                        <Share2 className="h-5 w-5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleBuyNow}
                      disabled={!hasStock}
                      className="inline-flex min-h-[50px] w-full items-center justify-center rounded-xl bg-[#2f6f2f] px-4 text-base font-bold text-white disabled:opacity-50"
                    >
                      Buy Now
                    </button>
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
                    <div className="text-center">
                      <Truck className="mx-auto h-4 w-4 text-emerald-700" />
                      <p className="mt-1 text-[11px] font-semibold text-gray-700">Free Shipping</p>
                    </div>
                    <div className="text-center">
                      <Shield className="mx-auto h-4 w-4 text-emerald-700" />
                      <p className="mt-1 text-[11px] font-semibold text-gray-700">Secure Payment</p>
                    </div>
                    <div className="text-center">
                      <Clock className="mx-auto h-4 w-4 text-emerald-700" />
                      <p className="mt-1 text-[11px] font-semibold text-gray-700">Fast Dispatch</p>
                    </div>
                  </div>
                </div>
              </aside>
            </div>

            <div className="mt-10 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
              <div className="flex border-b border-gray-200">
                {DETAIL_SECTIONS.map((section) => (
                  <button
                    key={section.key}
                    type="button"
                    onClick={() => setActiveDesktopTab(section.key)}
                    className={`flex-1 px-4 py-4 text-sm font-semibold ${
                      activeDesktopTab === section.key
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {section.label}
                  </button>
                ))}
              </div>
              <div className="p-6">
                {renderDetailSectionContent(activeDesktopTab)}
              </div>
            </div>
          </section>

          <section className="mt-8 md:mt-12">
            <ProductReviews
              isLoggedIn={isAuthenticated}
              user={user}
              mockReviews={productReviews}
              onLoginClick={goToLogin}
              onSubmitReview={handleSubmitReview}
            />
          </section>

          {relatedProducts.length > 0 ? (
            <section className="mt-8 md:mt-14">
              <h2 className="font-display text-2xl md:text-3xl font-bold text-[#2d3a2d] mb-4 md:mb-7">
                You May Also Like
              </h2>

              <div className="md:hidden scrollbar-hide flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
                {relatedProducts.map((related) => (
                  <div key={related.id} className="w-[230px] shrink-0 snap-center">
                    <ProductCard product={related} />
                  </div>
                ))}
              </div>

              <div className={`hidden md:grid gap-5 ${relatedGridClass}`}>
                {relatedProducts.map((related) => (
                  <ProductCard key={related.id} product={related} />
                ))}
              </div>
            </section>
          ) : null}
        </div>

        {showToast ? (
          <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-1.5rem)] max-w-sm -translate-x-1/2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-700 px-4 py-3 text-white shadow-xl md:left-auto md:right-6 md:w-auto md:translate-x-0">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4" />
              <span className="text-sm font-semibold">{toastMessage}</span>
            </div>
          </div>
        ) : null}
      </main>
    </>
  );
}
