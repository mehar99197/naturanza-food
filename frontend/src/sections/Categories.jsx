import { Link } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { categories } from '@/data/products';

export function Categories() {
 const trackRef = useRef(null);
 const programmaticScrollRef = useRef(false);
 const isCategoriesExist = categories.length > 0;

 useEffect(() => {
 // Keep auto-scroll only on mobile; desktop should stay centered and static.
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
 }, []);

 return (
 <section className="py-5 sm:py-6 md:py-7 bg-gradient-to-b from-white via-green-50/30 to-white relative overflow-hidden">
 {/* Background Pattern */}
 <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(61,122,61,0.05),transparent_50%)]"></div>
 
 <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-4 relative z-10">
 <div className="text-center mb-6 sm:mb-10 md:mb-14 lg:mb-20">
 <span className="inline-block text-white font-bold text-xs uppercase tracking-wider mb-3 md:mb-4 px-4 py-1.5 md:px-6 md:py-2 bg-green-600 rounded-full shadow-md animate-fade-in-up opacity-0 [animation-fill-mode:forwards]">Categories</span>
 <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 md:mb-5 lg:mb-6 animate-fade-in-up opacity-0 [animation-delay:0.1s] [animation-fill-mode:forwards]">
 <span className="bg-gradient-to-r from-green-700 to-emerald-600 bg-clip-text text-transparent">Shop by Category</span>
 </h2>
 <p className="text-sm sm:text-base md:text-base text-gray-600 max-w-2xl mx-auto px-4 md:px-0 animate-fade-in-up opacity-0 [animation-delay:0.2s] [animation-fill-mode:forwards]">
 Browse our diverse range of organic products tailored to your wellness needs
 </p>
 </div>

 {/* Single horizontal row with controlled auto-scroll */}
 <div
 ref={trackRef}
 className="flex flex-nowrap overflow-x-auto gap-0 md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-5 lg:gap-4 pb-2 scrollbar-hide snap-x snap-mandatory scroll-smooth md:overflow-x-visible md:snap-none md:pb-0"
 style={{
 scrollbarWidth: 'none',
 msOverflowStyle: 'none',
 WebkitOverflowScrolling: 'touch',
 }}
 >
   
  

   
 {isCategoriesExist ? (
   categories.map((category, index) => (
	 <Link
	   key={category.id}
	   to={`/shop?category=${category.id}`}
	   style={{ animationDelay: `${index * 100}ms` }}
	   className="group snap-center flex-shrink-0 w-full min-w-full md:w-auto md:min-w-0 relative overflow-hidden rounded-lg md:rounded-xl bg-white border-2 border-green-100 shadow-md md:hover:shadow-2xl md:hover:-translate-y-2 md:hover:border-green-300 transition-all duration-500 ease-out animate-fade-in-up opacity-0 [animation-fill-mode:forwards]"
	 >
	   <div className="aspect-[16/10] overflow-hidden bg-gradient-to-br from-green-100 to-emerald-100 relative">
		 <img
		   src={category.image}
		   alt={category.name}
		   className="w-full h-full object-contain p-3 transition-transform duration-700 ease-out md:group-hover:scale-110 md:group-hover:rotate-3"
		 />
		 {/* Overlay Gradient */}
		 <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 md:group-hover:opacity-100"></div>
	   </div>
	   <div className="p-2.5 md:p-3.5 lg:p-3">
		 <h3 className="text-sm md:text-base font-bold text-gray-900 mb-1 md:mb-1.5 line-clamp-1">
		   {category.name}
		 </h3>
		 <p className="text-gray-600 mb-2 md:mb-2.5 leading-relaxed text-xs line-clamp-2">{category.description}</p>
		 <span className="inline-flex items-center gap-1 md:gap-1.5 text-green-700 font-bold text-xs group-hover:gap-2 transition-all duration-300">
		   Explore Collection
		   <svg className="w-3 h-3 md:w-3.5 md:h-3.5 transition-transform duration-300 md:group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
			 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
		   </svg>
		 </span>
	   </div>
	 </Link>
   ))
 ) : (
   <div className="col-span-full text-center py-12">
     <p className="text-gray-500 text-base">No categories available yet.</p>
   </div>
 )}
 </div>
 </div>
 </section>
 );
}
