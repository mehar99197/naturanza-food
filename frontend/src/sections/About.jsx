import { Link } from 'react-router-dom';
import { Leaf, Heart, Users } from 'lucide-react';

export function About() {

 return (
 <section className="py-8 sm:py-10 lg:py-14 bg-white">
 <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-10">
 <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-6 sm:gap-8 md:gap-10 lg:gap-12 xl:gap-16 items-start lg:items-center">
 {/* Image Side */}
 <div className="relative order-2 lg:order-1">
 <div className="relative h-[220px] sm:h-[320px] md:h-[390px] lg:h-[460px] rounded-2xl md:rounded-3xl overflow-hidden shadow-xl md:shadow-2xl bg-[#eef7ef]">
 <img
 src="/images/products/about-honey-process.jpg"
 alt="Hands extracting natural honey from fresh honeycomb"
 className="w-full h-full object-cover object-[center_42%] md:object-center"
 />
 <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-emerald-900/10 via-transparent to-amber-200/20" />
 </div>
 <div className="absolute -bottom-8 -right-8 w-36 h-36 md:w-52 md:h-52 bg-green-200 rounded-full opacity-45 blur-3xl -z-10"></div>
 <div className="absolute -top-8 -left-8 w-36 h-36 md:w-52 md:h-52 bg-amber-200 rounded-full opacity-45 blur-3xl -z-10"></div>
 </div>

 {/* Content Side */}
 <div className="order-1 lg:order-2 space-y-4 sm:space-y-5 md:space-y-6 min-w-0">
 <div>
 <span className="text-green-700 font-semibold text-sm md:text-sm uppercase tracking-wider">
 About Us
 </span>
 <h2 className="text-[1.75rem] sm:text-[2.1rem] md:text-[2.4rem] lg:text-[2.75rem] xl:text-[3rem] font-bold text-gray-900 mt-2 mb-3 md:mb-4 leading-[1.12] max-w-[17ch] sm:max-w-[18ch] break-words">
 Bringing Nature's Best to Your Table
 </h2>
 <p className="text-[14px] sm:text-sm md:text-base text-gray-600 max-w-[62ch] leading-relaxed">
 At Naturanza, we believe in the power of pure, organic ingredients to transform lives and promote wellness.
 </p>
 </div>

 <p className="text-[14px] sm:text-sm md:text-base text-gray-600 leading-relaxed max-w-[62ch]">
 For over a decade, we've been sourcing the finest organic products directly from sustainable farms. 
 Our commitment to quality, purity, and environmental responsibility sets us apart in the industry.
 </p>

 <div className="space-y-3 md:space-y-4">
 <div className="flex items-start gap-3 md:gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-3 py-2.5 md:border-0 md:bg-transparent md:px-0 md:py-0">
 <div className="w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
 <Leaf className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-green-700" />
 </div>
 <div>
 <h3 className="font-semibold text-gray-900 mb-1 text-[13px] sm:text-sm md:text-base">Sustainable Sourcing</h3>
 <p className="text-gray-600 text-[12px] sm:text-[13px] md:text-sm leading-relaxed">
 We partner with certified organic farms that prioritize environmental stewardship.
 </p>
 </div>
 </div>

 <div className="flex items-start gap-3 md:gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-3 py-2.5 md:border-0 md:bg-transparent md:px-0 md:py-0">
 <div className="w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
 <Heart className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-green-700" />
 </div>
 <div>
 <h3 className="font-semibold text-gray-900 mb-1 text-[13px] sm:text-sm md:text-base">Health First</h3>
 <p className="text-gray-600 text-[12px] sm:text-[13px] md:text-sm leading-relaxed">
 Every product is carefully selected to support your wellness journey.
 </p>
 </div>
 </div>

 <div className="flex items-start gap-3 md:gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-3 py-2.5 md:border-0 md:bg-transparent md:px-0 md:py-0">
 <div className="w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
 <Users className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-green-700" />
 </div>
 <div>
 <h3 className="font-semibold text-gray-900 mb-1 text-[13px] sm:text-sm md:text-base">Community Focused</h3>
 <p className="text-gray-600 text-[12px] sm:text-[13px] md:text-sm leading-relaxed">
 We support local farmers and contribute to sustainable communities.
 </p>
 </div>
 </div>
 </div>

 <Link
 to="/about"
 className="inline-flex w-full sm:w-auto items-center justify-center bg-green-700 text-white px-5 py-2.5 md:px-6 md:py-2.5 rounded-full font-semibold text-sm md:text-sm md:hover:bg-green-800 shadow-lg md:hover:shadow-xl active:scale-95"
 >
 Learn More About Us
 </Link>
 </div>
 </div>
 </div>
 </section>
 );
}
