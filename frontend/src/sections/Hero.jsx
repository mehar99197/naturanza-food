import { Fragment, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ShoppingBag, Sparkles, Star, Leaf, Package, Tag } from 'lucide-react';
import { motion } from 'framer-motion';
import { fadeIn, slideUp, staggerContainer } from '@/lib/animations';
import { getAbsoluteImageUrl } from '@/lib/imageUtils';
import { formatPrice, getProductPricing } from '@/lib/utils';
import {
  buildHeroSlides,
  buildHeroSlideChips,
  splitHeadlineWords,
} from '@/lib/heroSlideUtils';
import { useSettings } from '@/context/SettingsContext';
import { useProducts } from '@/context/ProductContext';

const CHIP_ICONS = {
  tag: Tag,
  star: Star,
  leaf: Leaf,
  package: Package,
};

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

export function Hero() {
  const { settings } = useSettings();
  const { getActiveProducts } = useProducts();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [textKey, setTextKey] = useState(0);
  const animTimerRef = useRef(null);

  const slides = useMemo(
    () => buildHeroSlides(getActiveProducts()),
    [getActiveProducts],
  );

  useEffect(() => {
    return () => {
      if (animTimerRef.current) {
        clearTimeout(animTimerRef.current);
      }
    };
  }, []);

  const scheduleAnimationReset = useCallback(() => {
    if (animTimerRef.current) {
      clearTimeout(animTimerRef.current);
    }
    animTimerRef.current = setTimeout(() => setIsAnimating(false), 700);
  }, []);

  const nextSlide = useCallback(() => {
    if (isAnimating || slides.length === 0) return;
    setIsAnimating(true);
    setTextKey((k) => k + 1);
    setCurrentSlide((prev) => (prev + 1) % slides.length);
    scheduleAnimationReset();
  }, [isAnimating, slides.length, scheduleAnimationReset]);

  const prevSlide = useCallback(() => {
    if (isAnimating || slides.length === 0) return;
    setIsAnimating(true);
    setTextKey((k) => k + 1);
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
    scheduleAnimationReset();
  }, [isAnimating, slides.length, scheduleAnimationReset]);

  const goToSlide = (index) => {
    if (isAnimating || index === activeSlideIndex) return;
    setIsAnimating(true);
    setTextKey((k) => k + 1);
    setCurrentSlide(index);
    scheduleAnimationReset();
  };

  useEffect(() => {
    if (!isHovered && !isAnimating && slides.length > 1) {
      const interval = setInterval(() => {
        nextSlide();
      }, 3000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [isHovered, isAnimating, slides.length, nextSlide]);

  const hasSlides = slides.length > 0;
  const shouldShowNav = slides.length > 1;
  const activeSlideIndex = hasSlides ? currentSlide % slides.length : 0;

  return (
    <section
      className="relative w-full max-w-full h-[560px] sm:h-[560px] md:h-[520px] lg:h-[600px] overflow-hidden overflow-x-hidden pt-[56px] sm:pt-[60px] md:pt-[68px]"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="region"
      aria-label="Featured products carousel"
    >
      {/* Slides Container */}
      <div className="relative w-full h-full">
        {hasSlides ? (
          slides.map((slide, index) => {
            const isActiveSlide = index === activeSlideIndex;
            const slideImage = resolveSlideImage(slide.image, slide.headline);
            const perSlideChips = buildHeroSlideChips(slide, settings, {
              getProductPricing,
              formatPrice,
            });
            const SlideHeading = index === 0 ? motion.h1 : motion.h2;
            const headlineWords = splitHeadlineWords(slide.headline);
            return (
              <div
                key={slide.id}
                className={`absolute inset-0 transition-all duration-700 ease-in-out ${
                  isActiveSlide
                    ? 'opacity-100 translate-x-0 z-10'
                    : index < activeSlideIndex
                    ? 'opacity-0 -translate-x-full z-0 pointer-events-none'
                    : 'opacity-0 translate-x-full z-0 pointer-events-none'
                }`}
                aria-hidden={!isActiveSlide}
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
                    Mobile & sm (<768px): flex-col — Image top, text+CTA below, with bottom padding clearing pagination dots.
                    Tablet & Desktop (md+): 2-column grid, dots absolute at bottom.
                  */}
                  <div className="flex flex-col justify-center md:grid md:grid-cols-2 md:gap-8 lg:gap-12 md:items-center h-full gap-2 sm:gap-3 pt-2 pb-12 sm:pt-4 sm:pb-14 md:pt-4 md:pb-14 lg:pt-0 lg:pb-16 px-8 sm:px-12 md:px-14 lg:px-16">

                    {/* Product Image — top on mobile/sm, right on md+ */}
                    <div className="flex items-center justify-center order-1 md:order-2 md:h-full py-1 md:py-2">
                      <div className="relative w-full max-w-[140px] sm:max-w-[190px] md:max-w-sm lg:max-w-lg mx-auto">
                        <div className={`absolute inset-0 bg-gradient-to-r ${slide.accentColor} opacity-10 blur-3xl rounded-full`} />
                        <img
                          src={slideImage}
                          alt={slide.headline}
                            onError={(event) => {
                              event.currentTarget.onerror = null;
                              event.currentTarget.src = fallbackHeroImage;
                            }}
                          className="relative z-10 w-full h-auto object-contain drop-shadow-2xl max-h-[135px] sm:max-h-[175px] md:max-h-[300px] lg:max-h-[380px]"
                          loading={index === 0 ? 'eager' : 'lazy'}
                        />
                      </div>
                    </div>

                    {/* Text + CTA — below image on mobile/sm, left on md+ */}
                    <motion.div
                      key={isActiveSlide ? `${slide.id}-${textKey}` : slide.id}
                      variants={staggerContainer}
                      initial="hidden"
                      animate="visible"
                      className="text-center md:text-left order-2 md:order-1 space-y-2 sm:space-y-2.5 md:space-y-3.5 lg:space-y-5"
                    >
                      {/* Badge */}
                      <motion.div
                        variants={fadeIn}
                        className="inline-flex items-center gap-1.5 bg-white/90 backdrop-blur-sm px-2.5 py-0.5 md:px-3 md:py-1.5 rounded-full shadow-md"
                      >
                        <Sparkles className="w-2.5 h-2.5 md:w-3.5 md:h-3.5 text-green-600 flex-shrink-0" />
                        <span className="text-xs font-bold bg-gradient-to-r from-green-700 to-emerald-600 bg-clip-text text-transparent">
                          {slide.badge}
                        </span>
                      </motion.div>

                      {/* Headline */}
                      <SlideHeading
                        variants={slideUp}
                        className="text-2xl sm:text-3xl md:text-3xl lg:text-5xl font-black leading-tight text-[#243447] drop-shadow-sm"
                      >
                        {headlineWords.map((word, i) => {
                          const normalizedWord = word.toLowerCase().replace(/[^a-z]/g, '');
                          const isHighlightedWord = highlightedHeadlineWords.has(normalizedWord);
                          return (
                            <Fragment key={`${slide.id}-word-${i}`}>
                              {i > 0 ? ' ' : ''}
                              <span className={isHighlightedWord ? 'text-[#16A34A]' : 'text-current'}>
                                {word}
                              </span>
                            </Fragment>
                          );
                        })}
                      </SlideHeading>

                      {/* Description */}
                      <motion.p
                        variants={fadeIn}
                        className="text-sm sm:text-base md:text-sm lg:text-lg text-green-950/75 max-w-xl mx-auto md:mx-0 leading-relaxed line-clamp-2 sm:line-clamp-2 md:line-clamp-3"
                      >
                        {slide.description}
                      </motion.p>

                      {/* Chips */}
                      {perSlideChips.length > 0 ? (
                        <motion.div
                          variants={fadeIn}
                          className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 md:justify-start"
                        >
                          {perSlideChips.map((chip) => {
                            const ChipIcon = chip.iconName ? CHIP_ICONS[chip.iconName] : null;
                            return (
                              <span
                                key={chip.key}
                                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold sm:text-xs ${chip.classes}`}
                              >
                                {ChipIcon ? <ChipIcon className="h-3.5 w-3.5 flex-shrink-0" /> : null}
                                <span className="truncate text-current">{chip.label}</span>
                                {chip.originalLabel ? (
                                  <>
                                    {' '}
                                    <span className="line-through text-slate-500 font-medium">
                                      {chip.originalLabel}
                                    </span>
                                  </>
                                ) : null}
                              </span>
                            );
                          })}
                        </motion.div>
                      ) : null}

                      {/* CTA Buttons */}
                      <motion.div
                        variants={slideUp}
                        className="flex flex-row items-center gap-2 md:gap-3 justify-center md:justify-start"
                      >
                        <Link
                          to={slide.linkPrimary}
                          tabIndex={isActiveSlide ? 0 : -1}
                          className={`btn-3d inline-flex items-center justify-center gap-1.5 bg-gradient-to-r ${slide.accentColor} text-white px-3.5 py-2 sm:px-4 sm:py-2.5 md:px-5 md:py-2.5 lg:px-6 lg:py-3 rounded-lg md:rounded-xl font-semibold text-[13px] sm:text-sm md:text-sm lg:text-base shadow-lg md:hover:shadow-3d-hover md:hover:-translate-y-0.5 active:scale-95 transition-all duration-300 group min-h-[40px] whitespace-nowrap`}
                        >
                          <ShoppingBag className="w-3.5 h-3.5 md:w-4 md:h-4 flex-shrink-0" />
                          <span className="text-current">{slide.ctaPrimary}</span>
                        </Link>
                        <Link
                          to={slide.linkSecondary}
                          tabIndex={isActiveSlide ? 0 : -1}
                          className="inline-flex items-center justify-center gap-1.5 bg-white/90 backdrop-blur-sm text-gray-800 px-3.5 py-2 sm:px-4 sm:py-2.5 md:px-5 md:py-2.5 lg:px-6 lg:py-3 rounded-lg md:rounded-xl font-semibold text-[13px] sm:text-sm md:text-sm lg:text-base border-2 border-gray-200 shadow-md md:hover:shadow-xl md:hover:border-gray-300 md:hover:-translate-y-0.5 active:scale-95 transition-all duration-300 min-h-[40px] whitespace-nowrap"
                        >
                          {slide.ctaSecondary}
                        </Link>
                      </motion.div>

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

          {/* Pagination Dots — all screen sizes, outside slides so they never animate with content */}
          <div className="absolute bottom-4 sm:bottom-4 md:bottom-6 lg:bottom-8 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 sm:gap-2 bg-white/80 backdrop-blur-sm px-2 py-1 sm:px-3 sm:py-2 rounded-full shadow-md">
            {slides.map((slide, index) => (
              <button
                key={slide.id}
                onClick={() => goToSlide(index)}
                disabled={isAnimating}
                className={`transition-all duration-300 rounded-full disabled:cursor-not-allowed ${
                  index === activeSlideIndex
                    ? 'w-4 sm:w-6 lg:w-8 h-2 bg-green-500 shadow-sm'
                    : 'w-2 h-2 bg-gray-300/80 hover:bg-gray-400 active:scale-110'
                }`}
                aria-label={`Go to slide ${index + 1}`}
                aria-current={index === activeSlideIndex ? 'true' : 'false'}
              />
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
