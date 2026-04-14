import { Link } from 'react-router-dom';
import { Leaf, Heart, Users } from 'lucide-react';

export function About() {

 return (
 <section className="py-5 sm:py-6 md:py-7 bg-white">
 <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-4">
 <div className="grid lg:grid-cols-[42%_58%] gap-6 md:gap-8 lg:gap-12 items-center">
 {/* Image Side */}
 <div className="relative">
 <div className="relative rounded-2xl md:rounded-3xl overflow-hidden shadow-xl md:shadow-2xl max-h-[300px] md:max-h-[400px] bg-gradient-to-br from-green-50 to-emerald-50">
 <img
 src="/images/products/oil.webp"
 alt="About Naturanza"
 className="w-full h-full object-contain p-6 md:p-8"
 />
 </div>
 <div className="absolute -bottom-6 -right-6 w-32 h-32 md:w-48 md:h-48 bg-green-200 rounded-full opacity-50 blur-3xl -z-10"></div>
 <div className="absolute -top-6 -left-6 w-32 h-32 md:w-48 md:h-48 bg-amber-200 rounded-full opacity-50 blur-3xl -z-10"></div>
 </div>

 {/* Content Side */}
 <div className="space-y-4 md:space-y-6">
 <div>
 <span className="text-green-700 font-semibold text-sm md:text-sm uppercase tracking-wider">
 About Us
 </span>
 <h2 className="text-2xl md:text-3xl lg:text-5xl font-bold text-gray-900 mt-2 mb-3 md:mb-4 leading-tight">
 Bringing Nature's Best to Your Table
 </h2>
 <p className="text-sm md:text-base text-gray-600">
 At Naturanza, we believe in the power of pure, organic ingredients to transform lives and promote wellness.
 </p>
 </div>

 <p className="text-sm md:text-base text-gray-600 leading-relaxed">
 For over a decade, we've been sourcing the finest organic products directly from sustainable farms. 
 Our commitment to quality, purity, and environmental responsibility sets us apart in the industry.
 </p>

 <div className="space-y-3 md:space-y-4">
 <div className="flex items-start gap-3 md:gap-4">
 <div className="w-10 h-10 md:w-12 md:h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
 <Leaf className="w-5 h-5 md:w-6 md:h-6 text-green-700" />
 </div>
 <div>
 <h3 className="font-semibold text-gray-900 mb-1 text-sm md:text-base">Sustainable Sourcing</h3>
 <p className="text-gray-600 text-xs md:text-sm">
 We partner with certified organic farms that prioritize environmental stewardship.
 </p>
 </div>
 </div>

 <div className="flex items-start gap-3 md:gap-4">
 <div className="w-10 h-10 md:w-12 md:h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
 <Heart className="w-5 h-5 md:w-6 md:h-6 text-green-700" />
 </div>
 <div>
 <h3 className="font-semibold text-gray-900 mb-1 text-sm md:text-base">Health First</h3>
 <p className="text-gray-600 text-xs md:text-sm">
 Every product is carefully selected to support your wellness journey.
 </p>
 </div>
 </div>

 <div className="flex items-start gap-3 md:gap-4">
 <div className="w-10 h-10 md:w-12 md:h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
 <Users className="w-5 h-5 md:w-6 md:h-6 text-green-700" />
 </div>
 <div>
 <h3 className="font-semibold text-gray-900 mb-1 text-sm md:text-base">Community Focused</h3>
 <p className="text-gray-600 text-xs md:text-sm">
 We support local farmers and contribute to sustainable communities.
 </p>
 </div>
 </div>
 </div>

 <Link
 to="/about" target='_blank' 
 className="inline-block bg-green-700 text-white px-5 py-2 md:px-6 md:py-2.5 rounded-full font-semibold text-sm md:text-sm md:hover:bg-green-800 shadow-lg md:hover:shadow-xl active:scale-95"
 >
 Learn More About Us
 </Link>
 </div>
 </div>
 </div>
 </section>
 );
}
