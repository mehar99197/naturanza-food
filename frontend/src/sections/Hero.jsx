import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ShoppingBag, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { fadeIn, slideUp, staggerContainer, buttonTap } from '@/lib/animations';

// Carousel slides data
const slides = [
 {
 id: 1,
 badge:"Pure & Natural",
 headline:"Experience the Power of Pure Organic Honey",
 description:"Raw, unfiltered honey sourced from sustainable bee farms. Rich in antioxidants and natural enzymes for optimal health.",
 ctaPrimary:"Shop Honey",
 ctaSecondary:"Learn More",
 linkPrimary:"/shop?category=honey",
 linkSecondary:"/about",
 image:"/images/products/honey.webp",
 bgGradient:"from-green-50 via-emerald-50 to-green-100",
 accentColor:"from-green-600 to-emerald-600",
 },
 {
 id: 2,
 badge:"Coconut Care",
 headline:"Nourish Skin & Hair with Coconut Oil",
 description:"Cold-pressed coconut oil for hair care, skin hydration, massage, and daily wellness support.",
 ctaPrimary:"Shop Coconut Oil",
 ctaSecondary:"View Benefits",
 linkPrimary:"/shop?category=herbal-oils",
 linkSecondary:"/about",
 image:"/images/products/coconut%20oil.webp",
 imageSizeClass:"max-h-[170px] sm:max-h-[220px] md:max-h-none",
 bgGradient:"from-emerald-50 via-green-50 to-teal-50",
 accentColor:"from-emerald-600 to-green-700",
 },
 {
 id: 3,
 badge:"Digestive Balance",
 headline:"Support Digestion with Natural Ispaghol",
 description:"Natural ispaghol husk fiber for digestive comfort and daily gut wellness support.",
 ctaPrimary:"Shop Ispaghol",
 ctaSecondary:"Learn Usage",
 linkPrimary:"/shop?category=organic-powders",
 linkSecondary:"/faq",
 image:"/images/products/ispaghol_1.png",
 imageSizeClass:"max-h-[165px] sm:max-h-[210px] md:max-h-[430px] lg:max-h-[470px]",
 bgGradient:"from-green-100 via-emerald-50 to-green-50",
 accentColor:"from-green-700 to-emerald-600",
 },
];

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

export function Hero() {
 const [currentSlide, setCurrentSlide] = useState(0);
 const [isHovered, setIsHovered] = useState(false);
 const [isAnimating, setIsAnimating] = useState(false);
 const [textKey, setTextKey] = useState(0);

 // Auto-slide every 6 seconds for better readability
 useEffect(() => {
 if (!isHovered && !isAnimating) {
 const interval = setInterval(() => {
 nextSlide();
 }, 6000);
 return () => clearInterval(interval);
 }
 }, [currentSlide, isHovered, isAnimating]);

 const nextSlide = useCallback(() => {
 if (isAnimating) return;
 setIsAnimating(true);
 setTextKey(k => k + 1);
 setCurrentSlide((prev) => (prev + 1) % slides.length);
 setTimeout(() => setIsAnimating(false), 700);
 }, [isAnimating]);

 const prevSlide = useCallback(() => {
 if (isAnimating) return;
 setIsAnimating(true);
 setTextKey(k => k + 1);
 setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
 setTimeout(() => setIsAnimating(false), 700);
 }, [isAnimating]);

 const goToSlide = (index) => {
 if (isAnimating || index === currentSlide) return;
 setIsAnimating(true);
 setTextKey(k => k + 1);
 setCurrentSlide(index);
 setTimeout(() => setIsAnimating(false), 700);
 };

 const currentSlideData = slides[currentSlide];

 return (
 <section
 className="relative w-full max-w-full h-[520px] sm:h-[460px] md:h-[550px] lg:h-[600px] overflow-hidden overflow-x-hidden pt-[56px] sm:pt-[60px] md:pt-[68px]"
 onMouseEnter={() => setIsHovered(true)}
 onMouseLeave={() => setIsHovered(false)}
 role="region"
 aria-label="Featured products carousel"
 >
 {/* Slides Container */}
 <div className="relative w-full h-full">
 {slides.map((slide, index) => (
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
 Mobile: flex-col â€” Image stacked above Content, with bottom padding
 to keep content above the pagination dots (bottom-3 â‰ˆ 36px).
 Desktop: 2-column grid with items centered.
 */}
 <div className="flex flex-col justify-start sm:justify-center lg:grid lg:grid-cols-2 lg:gap-12 lg:items-center h-full gap-2 sm:gap-3 pt-2 pb-20 sm:pt-6 sm:pb-10 md:py-8 lg:py-0 px-8 sm:px-10 md:px-12 lg:px-16">

 {/* â”€â”€ Product Image â€” top on mobile, right on desktop â”€â”€ */}
 <div className="flex items-center justify-center order-1 lg:order-2 lg:h-full py-2">
 <div className="relative w-full max-w-[180px] sm:max-w-xs md:max-w-md lg:max-w-lg mx-auto pt-1">
 <div className={`absolute inset-0 bg-gradient-to-r ${slide.accentColor} opacity-10 blur-3xl rounded-full`} />
 <img
 src={slide.image}
 alt={slide.headline}
 className={`relative z-10 w-full h-auto object-contain drop-shadow-2xl ${slide.imageSizeClass || 'max-h-[200px] sm:max-h-[220px] md:max-h-none'}`}
 loading={index === 0 ? 'eager' : 'lazy'}
 />
 </div>
 </div>

            {/* â”€â”€ Text + CTA â€” below image on mobile, left on desktop â”€â”€ */}
            <motion.div 
              key={textKey} 
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="text-center lg:text-left order-2 lg:order-1 space-y-2 sm:space-y-3 md:space-y-4 lg:space-y-6"
            >
              {/* Badge â€” fade in from top */}
              <motion.div 
                variants={fadeIn}
                className="inline-flex items-center gap-1.5 bg-white/90 backdrop-blur-sm px-2 py-0.5 md:px-3 md:py-1.5 rounded-full shadow-md"
              >
                <Sparkles className="w-2.5 h-2.5 md:w-3.5 md:h-3.5 text-green-600 flex-shrink-0" />
                <span className="text-xs sm:text-xs md:text-xs font-bold bg-gradient-to-r from-green-700 to-emerald-600 bg-clip-text text-transparent">
                  {slide.badge}
                </span>
              </motion.div>

              {/* Headline â€” words animate one by one */}
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

              {/* Description â€” fade in */}
              <motion.p
                variants={fadeIn}
                className="text-sm sm:text-base md:text-base lg:text-lg text-green-950/70 max-w-xl mx-auto lg:mx-0 leading-relaxed line-clamp-2 sm:line-clamp-none"
              >
                {slide.description}
              </motion.p>

              {/* CTA Buttons â€” fade in last */}
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
            </motion.div>
          </div>
        </div>
        </div>
        ))}
        </div>

 {/* Navigation Arrows â€” compact on mobile, full-size on desktop */}
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

 {/* Pagination Dots â€” above the progress bar, clear of content */}
 <div className="absolute bottom-6 sm:bottom-4 md:bottom-6 lg:bottom-8 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 sm:gap-1.5 md:gap-2 bg-white/80 backdrop-blur-sm px-2 py-1 sm:px-3 sm:py-2 rounded-full shadow-md">
 {slides.map((slide, index) => (
 <button
 key={slide.id}
 onClick={() => goToSlide(index)}
 disabled={isAnimating}
 className={`transition-all duration-300 rounded-full disabled:cursor-not-allowed ${
 index === currentSlide
 ? 'w-3 sm:w-6 md:w-8 h-2 bg-green-500 shadow-sm'
 : 'w-2 h-2 bg-gray-300/80 md:hover:bg-gray-400 active:scale-110'
 }`}
 aria-label={`Go to slide ${index + 1}`}
 aria-current={index === currentSlide ? 'true' : 'false'}
 />
 ))}
 </div>


 </section>
 );
}
