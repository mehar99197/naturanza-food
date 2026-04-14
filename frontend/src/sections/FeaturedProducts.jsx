import { useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { ProductCard } from '@/components/ProductCard';
import { useProducts } from '@/context/ProductContext';

export function FeaturedProducts() {
 const { getFeaturedProducts } = useProducts();
 const trackRef = useRef(null);
 const programmaticScrollRef = useRef(false);

 const featuredProducts = useMemo(() => getFeaturedProducts(), [getFeaturedProducts]);

 useEffect(() => {
 // Keep auto-scroll behavior mobile-only to avoid desktop horizontal scrollbar.
 if (typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches) {
 return;
 }

 const track = trackRef.current;
 if (!track) return;

 let startDelayTimer;
 let autoInterval;
 let programmaticResetTimer;
 let currentCardIndex = 0;

 const stepScroll = () => {
 if (!track) return;

 const cards = Array.from(track.children);
 if (cards.length === 0) return;

 currentCardIndex = (currentCardIndex + 1) % cards.length;
 const card = cards[currentCardIndex];
 const targetLeft = card.offsetLeft - (track.clientWidth - card.clientWidth) / 2;

 programmaticScrollRef.current = true;
 track.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });

 if (programmaticResetTimer) clearTimeout(programmaticResetTimer);
 programmaticResetTimer = setTimeout(() => {
 programmaticScrollRef.current = false;
 }, 450);
 };

 startDelayTimer = setTimeout(() => {
 autoInterval = setInterval(stepScroll, 3000);
 }, 3000);

 return () => {
 if (startDelayTimer) clearTimeout(startDelayTimer);
 if (autoInterval) clearInterval(autoInterval);
 if (programmaticResetTimer) clearTimeout(programmaticResetTimer);
 };
 }, [featuredProducts.length]);

 return (
 <section className="featured-mobile-shell py-8 sm:py-10 md:py-12 lg:py-14 bg-gradient-to-b from-white via-green-50/30 to-white relative overflow-hidden">
 {/* Background Pattern */}
 <div className="hidden sm:block absolute inset-0 bg-[linear-gradient(rgba(61,122,61,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(61,122,61,0.02)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
 
 <div className="w-full max-w-screen-2xl mx-auto px-2.5 xs:px-3.5 sm:px-4 md:px-5 lg:px-6 relative z-10">
 <div className="text-center mb-7 sm:mb-10 md:mb-12 lg:mb-14">
 <span className="inline-block text-white font-bold text-xs uppercase tracking-wider mb-2 md:mb-3 px-3 py-1 md:px-4 md:py-1.5 bg-green-600 rounded-full shadow-md animate-fade-in-up opacity-0 [animation-fill-mode:forwards]">Featured Collection</span>
 <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-2.5 md:mb-3.5 lg:mb-4 text-gray-900 animate-fade-in-up opacity-0 [animation-delay:0.1s] [animation-fill-mode:forwards]">
 <span className="bg-gradient-to-r from-green-700 to-emerald-600 bg-clip-text text-transparent">Featured Products</span>
 </h2>
 <p className="text-sm text-gray-600 max-w-2xl mx-auto px-1 sm:px-4 md:px-0 animate-fade-in-up opacity-0 [animation-delay:0.2s] [animation-fill-mode:forwards]">
 Explore our handpicked selection of premium organic products
 </p>
 </div>

 {/* Single horizontal row with controlled auto-scroll */}
 {featuredProducts.length === 0 ? (
 <div className="text-center py-16 mb-8">
 <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
 <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
 </svg>
 </div>
 <h3 className="text-lg font-semibold text-gray-900 mb-2">No Featured Products Available</h3>
 <p className="text-sm text-gray-600 mb-6">Check back soon for new arrivals and special offers</p>
 <Link
 to="/shop"
 className="inline-flex items-center gap-2 bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-3 rounded-lg font-semibold hover:from-green-700 hover:to-green-800"
 >
 Browse All Products
 <ArrowRight className="w-4 h-4" />
 </Link>
 </div>
 ) : (
 <div 
 ref={trackRef}
 className="flex flex-nowrap overflow-x-auto gap-3 xs:gap-4 sm:gap-5 md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-5 lg:gap-6 px-0 py-1.5 sm:py-2 md:py-1 mb-10 sm:mb-12 md:mb-14 lg:mb-16 scrollbar-hide snap-x snap-mandatory scroll-smooth md:overflow-visible md:snap-none"
 style={{
 scrollbarWidth: 'none',
 msOverflowStyle: 'none',
 WebkitOverflowScrolling: 'touch',
 }}
 >
 {featuredProducts.map((product, index) => (
 <div
 key={product.id}
 className="featured-mobile-card snap-center flex-shrink-0 py-1 w-[86vw] min-w-[86vw] xs:w-[72vw] xs:min-w-[72vw] sm:w-[52vw] sm:min-w-[52vw] md:w-full md:min-w-0 rounded-2xl animate-fade-in-up opacity-0 [animation-fill-mode:forwards]"
 style={{ animationDelay: `${index * 80}ms` }}
 >
 <ProductCard product={product} viewMode="grid" />
 </div>
 ))}
 </div>
 )}

 <div className="text-center">
 <Link
 to="/shop"
 className="btn-3d inline-flex items-center gap-1.5 md:gap-2 bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-2 md:px-5 md:py-2.5 rounded-lg md:rounded-xl font-semibold text-sm shadow-3d md:hover:shadow-3d-hover md:hover:-translate-y-0.5 active:scale-95 transition-all duration-300"
 >
 View All Products
 <ArrowRight className="w-3.5 h-3.5 md:w-4 md:h-4" />
 </Link>
 </div>
 </div>
 </section>
 );
}
