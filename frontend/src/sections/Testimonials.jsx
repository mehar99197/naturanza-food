import { Star } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { testimonials } from '@/data/products';

const getReviewText = (testimonial) => testimonial.review || testimonial.text || '';
const getMetaText = (testimonial) => testimonial.location || 'Verified Customer';

export function Testimonials() {
 const trackRef = useRef(null);
 const programmaticScrollRef = useRef(false);

 useEffect(() => {
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
 <section className="py-5 sm:py-6 md:py-7 bg-gradient-to-b from-green-50 via-white to-green-50/30 relative overflow-hidden">
 {/* Decorative Elements */}
 <div className="absolute top-0 left-0 w-64 sm:w-96 h-64 sm:h-96 bg-green-200/30 rounded-full blur-3xl"></div>
 <div className="absolute bottom-0 right-0 w-64 sm:w-96 h-64 sm:h-96 bg-emerald-200/30 rounded-full blur-3xl"></div>
 
 <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-4 relative z-10">
 <div className="text-center mb-6 sm:mb-12 md:mb-14 lg:mb-20">
 <span className="inline-block text-white font-bold text-xs uppercase tracking-wider mb-2 sm:mb-3 md:mb-4 px-3 sm:px-6 py-1 sm:py-2 bg-green-600 rounded-full shadow-md animate-fade-in-up opacity-0 [animation-fill-mode:forwards]">Testimonials</span>
 <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 sm:mb-4 md:mb-5 lg:mb-6 animate-fade-in-up opacity-0 [animation-delay:0.1s] [animation-fill-mode:forwards]">
 <span className="bg-gradient-to-r from-green-700 to-emerald-600 bg-clip-text text-transparent">What Our Customers Say</span>
 </h2>
 <p className="text-sm sm:text-base md:text-base text-gray-600 max-w-2xl mx-auto px-4 sm:px-0">
 Join thousands of satisfied customers who trust Naturanza for their organic needs
 </p>
 </div>

 {/* Mobile one-row auto-scroll */}
 <div className="md:hidden pb-4">
 <div
 ref={trackRef}
 className="flex flex-nowrap overflow-x-auto gap-0 pb-1 scrollbar-hide snap-x snap-mandatory scroll-smooth"
 style={{
 scrollbarWidth: 'none',
 msOverflowStyle: 'none',
 WebkitOverflowScrolling: 'touch',
 }}
 >
 {testimonials.map((testimonial, index) => (
 <div
 key={index}
 className="snap-center flex-shrink-0 w-full min-w-full bg-white rounded-xl p-3 shadow-lg border border-green-100/50 relative overflow-hidden"
 >
 {/* Quote Icon */}
 <div className="absolute top-3 right-3 text-green-100 text-4xl font-serif leading-none">&ldquo;</div>
 
 <div className="flex gap-1 mb-3 relative z-10">
 {[...Array(5)].map((_, i) => (
 <Star
 key={i}
 className={`w-3.5 h-3.5 ${
 i < testimonial.rating
 ? 'text-amber-400 fill-amber-400'
 : 'text-gray-300'
 }`}
 />
 ))}
 </div>
 
 <p className="text-gray-700 mb-3 leading-relaxed text-xs relative z-10 line-clamp-4">
 {getReviewText(testimonial)}
 </p>
 
 <div className="flex items-center gap-2.5 relative z-10">
 <div className="relative">
 <img
 src={testimonial.avatar}
 alt={testimonial.name}
 className="w-9 h-9 rounded-lg object-cover shadow-md"
 />
 <div className="absolute inset-0 rounded-lg ring-2 ring-green-500/20"></div>
 </div>
 <div>
 <h4 className="font-bold text-gray-900 text-xs line-clamp-1">{testimonial.name}</h4>
 <p className="text-xs text-gray-500 font-medium line-clamp-1">{getMetaText(testimonial)}</p>
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>

 {/* Desktop centered compact layout */}
 <div className="hidden md:flex md:flex-wrap md:justify-center gap-4 lg:gap-5 xl:gap-6">
 {testimonials.map((testimonial, index) => (
 <div
 key={index}
 style={{ animationDelay: `${index * 100}ms` }}
 className="w-[290px] lg:w-[325px] xl:w-[345px] bg-white rounded-2xl lg:rounded-3xl p-4 lg:p-5 shadow-md md:hover:shadow-xl border-2 border-green-100 md:hover:border-green-300 md:hover:-translate-y-2 transition-all duration-300 relative overflow-hidden group animate-fade-in-up opacity-0 [animation-fill-mode:forwards]"
 >
 {/* Quote Icon */}
 <div className="absolute top-5 right-5 text-green-100 text-5xl lg:text-6xl font-serif leading-none md:group-hover:text-green-200">&ldquo;</div>
 
 <div className="flex gap-1 mb-4 relative z-10">
 {[...Array(5)].map((_, i) => (
 <Star
 key={i}
 className={`w-[18px] h-[18px] lg:w-5 lg:h-5 ${
 i < testimonial.rating
 ? 'text-amber-400 fill-amber-400'
 : 'text-gray-300'
 }`}
 />
 ))}
 </div>
 
 <p className="text-gray-700 mb-4 leading-relaxed text-sm line-clamp-4 relative z-10">
 {getReviewText(testimonial)}
 </p>
 
 <div className="flex items-center gap-3 relative z-10">
 <div className="relative">
 <img
 src={testimonial.avatar}
 alt={testimonial.name}
 className="w-11 h-11 lg:w-12 lg:h-12 rounded-xl lg:rounded-2xl object-cover shadow-md"
 />
 <div className="absolute inset-0 rounded-xl lg:rounded-2xl ring-2 ring-green-500/20"></div>
 </div>
 <div>
 <h4 className="font-bold text-gray-900 text-[17px] lg:text-lg">{testimonial.name}</h4>
 <p className="text-sm text-gray-500 font-medium">{getMetaText(testimonial)}</p>
 </div>
 </div>
 
 {/* Hover Gradient */}
 <div className="absolute inset-0 bg-gradient-to-br from-green-50/50 to-transparent opacity-0 md:group-hover:opacity-100 pointer-events-none rounded-3xl"></div>
 </div>
 ))}
 </div>
 </div>
 </section>
 );
}
