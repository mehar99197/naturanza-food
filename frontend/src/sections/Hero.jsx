import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ShoppingBag, Sparkles, Star, Leaf, Package, Tag } from 'lucide-react';
import { motion } from 'framer-motion';
import { fadeIn, slideUp, staggerContainer, buttonTap } from '@/lib/animations';
import { productAPI } from '@/services/api';
import { getAbsoluteImageUrl } from '@/lib/imageUtils';
import { formatPrice } from '@/lib/utils';
import { useSettings } from '@/context/SettingsContext';

const highlightedHeadlineWords = new Set([
  'nourish',
  'natural',
  'pure',
  'organic',
  'herbal',
  'wellness',
  'coconut',
  'digestion',
  'ispaghol',
]);

const fallbackHeroImage = '/images/logo.png';

const NAME_KEYWORD_TO_IMAGE = [
  { keyword: 'honey', path: '/images/products/honey.webp' },
  { keyword: 'ispagh', path: '/images/products/ispaghol_2.webp' },
  { keyword: 'coconut', path: '/images/products/coconut-oil.webp' },
  { keyword: 'oil', path: '/images/products/oil.webp' },
  { keyword: 'herb', path: '/images/products/herbs.webp' },
  { keyword: 'tea', path: '/images/products/tea.webp' },
];

const guessImageFromName = (name) => {
  const lower = String(name || '').toLowerCase();
  const hit = NAME_KEYWORD_TO_IMAGE.find(({ keyword }) => lower.includes(keyword));
  return hit ? hit.path : null;
};

const resolveSlideImage = (image, productName) => {
  if (typeof image === 'string' && image.trim()) {
    return getAbsoluteImageUrl(image.trim(), { defaultFolder: 'products' });
  }
  const guessed = guessImageFromName(productName);
  return guessed || fallbackHeroImage;
};

const normalizeProductList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const isHoneyProduct = (product) => {
  const text = `${product?.name || ''} ${product?.slug || ''}`.toLowerCase();
  return text.includes('honey');
};

const buildSlideChips = (slide, currency) => {
  const chips = [];

  if (Number.isFinite(slide.price) && slide.price > 0) {
    chips.push({
      key: 'price',
      label: `From ${formatPrice(slide.price, currency)}`,
      classes: 'border-emerald-200 bg-white/80 text-emerald-800',
      Icon: Tag,
    });
  }

  if (Number.isFinite(slide.rating) && slide.rating > 0) {
    const reviewLabel = slide.reviewCount > 0 ? ` (${slide.reviewCount})` : '';
    chips.push({
      key: 'rating',
      label: `${slide.rating.toFixed(1)}${reviewLabel}`,
      classes: 'border-amber-200 bg-amber-50/80 text-amber-800',
      Icon: Star,
    });
  }

  if (slide.category) {
    chips.push({
      key: 'category',
      label: slide.category,
      classes: 'border-slate-200 bg-white/70 text-slate-700',
    });
  }

  if (slide.isOrganic) {
    chips.push({
      key: 'organic',
      label: 'Organic',
      classes: 'border-emerald-200 bg-emerald-50/80 text-emerald-700',
      Icon: Leaf,
    });
  }

  if (Number.isFinite(slide.stockQty) && slide.stockQty > 0) {
    chips.push({
      key: 'stock',
      label: 'In stock',
      classes: 'border-emerald-200 bg-emerald-50/80 text-emerald-700',
      Icon: Package,
    });
  }

  return chips.slice(0, 3);
};

export function Hero() {
  const { settings } = useSettings();
  const [slides, setSlides] = useState([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [textKey, setTextKey] = useState(0);

  useEffect(() => {
    const fetchSlides = async () => {
      try {
        const response = await productAPI.getAll();
        const list = normalizeProductList(response)
          .map((item, index) => ({ item, index }))
          .sort((a, b) => {
            const honeyDiff = Number(isHoneyProduct(b.item)) - Number(isHoneyProduct(a.item));
            if (honeyDiff !== 0) return honeyDiff;
            return a.index - b.index;
          })
          .map(({ item }) => item);

        if (list.length > 0) {
          const gradients = [
            "from-green-50 via-emerald-50 to-green-100",
            "from-emerald-50 via-green-50 to-teal-50",
            "from-green-100 via-emerald-50 to-green-50",
          ];
          const accents = [
            "from-green-600 to-emerald-600",
            "from-emerald-600 to-green-700",
            "from-green-700 to-emerald-600",
          ];

          const mapped = list.map((p, idx) => {
            const numericPrice = Number(p?.price);
            const ratingValue = Number(p?.average_rating || p?.rating || 0);
            const reviewCount = Number(p?.review_count || p?.reviews_count || p?.reviewCount || 0);
            const categoryLabel = String(p?.category_name || p?.category || '').trim();
            const stockQty = Number(p?.stock_quantity ?? p?.stock ?? NaN);

            return {
              id: p.id,
              badge: "Featured",
              headline: p.name,
              description: p.description?.substring(0, 100) || "Discover our premium organic products.",
              ctaPrimary: "Shop Now",
              ctaSecondary: "Learn More",
              linkPrimary: `/product/${p.id ?? p.product_id ?? p.slug}`,
              linkSecondary: "/about",
              image: p.image || p.image_url || "",
              bgGradient: gradients[idx % gradients.length],
              accentColor: accents[idx % accents.length],
              imageSizeClass: "max-h-[200px] sm:max-h-[220px] md:max-h-none",
              price: Number.isFinite(numericPrice) ? numericPrice : null,
              rating: Number.isFinite(ratingValue) ? ratingValue : 0,
              reviewCount: Number.isFinite(reviewCount) ? reviewCount : 0,
              category: categoryLabel,
              isOrganic: p?.is_organic === true || p?.is_organic === 1,
              stockQty: Number.isFinite(stockQty) ? stockQty : null,
            };
          });
          setSlides(mapped);
          setCurrentSlide(0);
        }
      } catch (err) {
        console.error("Failed to fetch hero slides:", err);
      }
    };
    fetchSlides();
  }, []);

  useEffect(() => {
    if (!isHovered && !isAnimating && slides.length > 1) {
      const interval = setInterval(() => {
        nextSlide();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [currentSlide, isHovered, isAnimating, slides.length]);

  const nextSlide = useCallback(() => {
    if (isAnimating || slides.length === 0) return;
    setIsAnimating(true);
    setTextKey(k => k + 1);
    setCurrentSlide((prev) => (prev + 1) % slides.length);
    setTimeout(() => setIsAnimating(false), 700);
  }, [isAnimating, slides.length]);

  const prevSlide = useCallback(() => {
    if (isAnimating || slides.length === 0) return;
    setIsAnimating(true);
    setTextKey(k => k + 1);
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
    setTimeout(() => setIsAnimating(false), 700);
  }, [isAnimating, slides.length]);

  const goToSlide = (index) => {
    if (isAnimating || index === currentSlide) return;
    setIsAnimating(true);
    setTextKey(k => k + 1);
    setCurrentSlide(index);
    setTimeout(() => setIsAnimating(false), 700);
  };

  const hasSlides = slides.length > 0;
  const shouldShowNav = slides.length > 1;
  const currentSlideData = hasSlides ? slides[currentSlide] : null;
  const slideChips = useMemo(
    () => buildSlideChips(currentSlideData || {}, settings?.currency || 'PKR'),
    [currentSlideData, settings?.currency],
  );

  return (
    <section
      className="relative w-full max-w-full h-[540px] sm:h-[460px] md:h-[550px] lg:h-[600px] overflow-hidden overflow-x-hidden pt-[56px] sm:pt-[60px] md:pt-[68px]"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="region"
      aria-label="Featured products carousel"
    >
      {/* Slides Container */}
      <div className="relative w-full h-full">
        {hasSlides ? (
          slides.map((slide, index) => {
            const slideImage = resolveSlideImage(slide.image, slide.headline);
            return (
              <div
                key={slide.id}
                className={`absolute inset-0 transition-all duration-700 ease-in-out ${
                  index === currentSlide
                    ? 'opacity-100 translate-x-0 z-10'
                    : index < currentSlide
                    ? 'opacity-0 -translate-x-full z-0'
                    : 'opacity-0 translate-x-full z-0'
                }`}
                aria-hidden={index !== currentSlide}
              >
                {/* Background Gradient */}
                <div className={`absolute inset-0 bg-gradient-to-br ${slide.bgGradient}`} />

                {/* Decorative Pattern Overlay */}
                <div className="absolute inset-0 opacity-5">
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage: `radial-gradient(circle at 2px 2px, rgba(0,0,0,0.2) 1px, transparent 0)`,
                      backgroundSize: '40px 40px',
                    }}
                  />
                </div>

                {/* Floating Decorative Elements */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <div className="absolute top-20 right-20 w-72 h-72 bg-white/30 rounded-full blur-3xl" />
                  <div className="absolute bottom-20 left-20 w-96 h-96 bg-white/20 rounded-full blur-3xl" style={{ animationDelay: '1s' }} />
                </div>

                {/* Content Container */}
                <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-4 h-full relative z-20">
                  {/*
                    Mobile: flex-col — Image top, text+CTA below, dots directly after buttons.
                    Desktop (lg+): 2-column grid, dots absolute at bottom.
                  */}
                  <div className="flex flex-col justify-start sm:justify-center lg:grid lg:grid-cols-2 lg:gap-12 lg:items-center h-full gap-2 sm:gap-3 pt-2 pb-4 sm:pt-6 sm:pb-10 md:py-8 lg:py-0 px-8 sm:px-10 md:px-12 lg:px-16">

                    {/* Product Image — top on mobile, right on desktop */}
                    <div className="flex items-center justify-center order-1 lg:order-2 lg:h-full py-2">
                      <div className="relative w-full max-w-[140px] sm:max-w-xs md:max-w-md lg:max-w-lg mx-auto pt-1">
                        <div className={`absolute inset-0 bg-gradient-to-r ${slide.accentColor} opacity-10 blur-3xl rounded-full`} />
                        <img
                          src={slideImage}
                          alt={slide.headline}
                          className="relative z-10 w-full h-auto object-contain drop-shadow-2xl max-h-[150px] sm:max-h-[220px] md:max-h-none"
                          loading={index === 0 ? 'eager' : 'lazy'}
                        />
                      </div>
                    </div>

                    {/* Text + CTA — below image on mobile, left on desktop */}
                    <motion.div
                      key={textKey}
                      variants={staggerContainer}
                      initial="hidden"
                      animate="visible"
                      className="text-center lg:text-left order-2 lg:order-1 space-y-2 sm:space-y-3 md:space-y-4 lg:space-y-6"
                    >
                      {/* Badge */}
                      <motion.div
                        variants={fadeIn}
                        className="inline-flex items-center gap-1.5 bg-white/90 backdrop-blur-sm px-2 py-0.5 md:px-3 md:py-1.5 rounded-full shadow-md"
                      >
                        <Sparkles className="w-2.5 h-2.5 md:w-3.5 md:h-3.5 text-green-600 flex-shrink-0" />
                        <span className="text-xs font-bold bg-gradient-to-r from-green-700 to-emerald-600 bg-clip-text text-transparent">
                          {slide.badge}
                        </span>
                      </motion.div>

                      {/* Headline */}
                      <motion.h1
                        variants={slideUp}
                        className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black leading-tight"
                      >
                        <span className="text-[#243447] drop-shadow-sm">
                          {slide.headline.split(' ').map((word, i) => {
                            const normalizedWord = word.toLowerCase().replace(/[^a-z]/g, '');
                            const isHighlightedWord = highlightedHeadlineWords.has(normalizedWord);
                            return (
                              <span
                                key={i}
                                className={`inline-block mr-[0.25em] ${isHighlightedWord ? 'text-[#16A34A]' : ''}`}
                              >
                                {word}
                              </span>
                            );
                          })}
                        </span>
                      </motion.h1>

                      {/* Description */}
                      <motion.p
                        variants={fadeIn}
                        className="text-sm sm:text-base md:text-base lg:text-lg text-green-950/70 max-w-xl mx-auto lg:mx-0 leading-relaxed line-clamp-2 sm:line-clamp-none"
                      >
                        {slide.description}
                      </motion.p>

                      {/* Chips */}
                      {slideChips.length > 0 ? (
                        <motion.div
                          variants={fadeIn}
                          className="flex flex-wrap items-center justify-center gap-2 lg:justify-start"
                        >
                          {slideChips.map((chip) => {
                            const ChipIcon = chip.Icon;
                            return (
                              <span
                                key={chip.key}
                                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold sm:text-xs ${chip.classes}`}
                              >
                                {ChipIcon ? <ChipIcon className="h-3.5 w-3.5" /> : null}
                                <span className="truncate">{chip.label}</span>
                              </span>
                            );
                          })}
                        </motion.div>
                      ) : null}

                      {/* CTA Buttons */}
                      <motion.div
                        variants={slideUp}
                        className="flex flex-row items-center gap-2 md:gap-3 justify-center lg:justify-start"
                      >
                        <Link
                          to={slide.linkPrimary}
                          className={`btn-3d inline-flex items-center justify-center gap-1.5 bg-gradient-to-r ${slide.accentColor} text-white px-3 py-2 sm:px-4 sm:py-2.5 md:px-6 md:py-3 rounded-lg md:rounded-xl font-semibold text-[13px] sm:text-base md:text-sm lg:text-base shadow-lg md:hover:shadow-3d-hover md:hover:-translate-y-0.5 active:scale-95 transition-all duration-300 group min-h-[40px] whitespace-nowrap`}
                        >
                          <ShoppingBag className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 flex-shrink-0" />
                          <span>{slide.ctaPrimary}</span>
                        </Link>
                        <Link
                          to={slide.linkSecondary}
                          className="inline-flex items-center justify-center gap-1.5 bg-white/90 backdrop-blur-sm text-gray-800 px-3 py-2 sm:px-4 sm:py-2.5 md:px-6 md:py-3 rounded-lg md:rounded-xl font-semibold text-[13px] sm:text-base md:text-sm lg:text-base border-2 border-gray-200 shadow-md md:hover:shadow-xl md:hover:border-gray-300 md:hover:-translate-y-0.5 active:scale-95 transition-all duration-300 min-h-[40px] whitespace-nowrap"
                        >
                          {slide.ctaSecondary}
                        </Link>
                      </motion.div>

                      {/* Pagination Dots — mobile only, in content flow just after CTA buttons */}
                      {shouldShowNav && (
                        <div className="flex lg:hidden items-center justify-center gap-1.5 pt-1">
                          {slides.map((s, i) => (
                            <button
                              key={s.id}
                              onClick={() => goToSlide(i)}
                              disabled={isAnimating}
                              className={`transition-all duration-300 rounded-full disabled:cursor-not-allowed ${
                                i === currentSlide
                                  ? 'w-4 h-2 bg-green-500 shadow-sm'
                                  : 'w-2 h-2 bg-gray-300/80 active:scale-110'
                              }`}
                              aria-label={`Go to slide ${i + 1}`}
                              aria-current={i === currentSlide ? 'true' : 'false'}
                            />
                          ))}
                        </div>
                      )}
                    </motion.div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div
            className="absolute inset-0 bg-gradient-to-br from-green-50 via-emerald-50 to-green-100"
            aria-hidden="true"
          />
        )}
      </div>

      {shouldShowNav ? (
        <>
          {/* Navigation Arrows */}
          <button
            onClick={prevSlide}
            disabled={isAnimating}
            className="absolute left-2 sm:left-3 md:left-4 lg:left-6 top-1/2 -translate-y-1/2 z-40 w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-white/95 backdrop-blur-sm rounded-full shadow-lg md:hover:shadow-2xl md:hover:scale-105 transition-all duration-300 flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            aria-label="Previous slide"
            style={{ transform: 'translateY(-50%)' }}
          >
            <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-gray-700 md:group-hover:text-green-600 transition-colors duration-300" />
          </button>

          <button
            onClick={nextSlide}
            disabled={isAnimating}
            className="absolute right-2 sm:right-3 md:right-4 lg:right-6 top-1/2 -translate-y-1/2 z-40 w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-white/95 backdrop-blur-sm rounded-full shadow-lg md:hover:shadow-2xl md:hover:scale-105 transition-all duration-300 flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            aria-label="Next slide"
            style={{ transform: 'translateY(-50%)' }}
          >
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-gray-700 md:group-hover:text-green-600 transition-colors duration-300" />
          </button>

          {/* Pagination Dots — desktop only (lg+) */}
          <div className="hidden lg:flex absolute bottom-8 left-1/2 -translate-x-1/2 z-30 items-center gap-2 bg-white/80 backdrop-blur-sm px-3 py-2 rounded-full shadow-md">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                onClick={() => goToSlide(index)}
                disabled={isAnimating}
                className={`transition-all duration-300 rounded-full disabled:cursor-not-allowed ${
                  index === currentSlide
                    ? 'w-8 h-2 bg-green-500 shadow-sm'
                    : 'w-2 h-2 bg-gray-300/80 hover:bg-gray-400 active:scale-110'
                }`}
                aria-label={`Go to slide ${index + 1}`}
                aria-current={index === currentSlide ? 'true' : 'false'}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
