import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Leaf,
  Heart,
  Users,
  Globe,
  Shield,
  Award,
  Sparkles,
  Sprout,
  Sun,
  Droplet,
  Recycle,
  HandHeart,
  BadgeCheck,
} from 'lucide-react';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import { useSettings } from '@/context/SettingsContext';
import { aboutAPI } from '@/services/api';
import { getAbsoluteImageUrl } from '@/lib/imageUtils';

const VALUE_ICON_MAP = {
  Leaf,
  Heart,
  Users,
  Globe,
  Shield,
  Award,
  Sparkles,
  Sprout,
  Sun,
  Droplet,
  Recycle,
  HandHeart,
  BadgeCheck,
};

const DEFAULT_HOME_IMAGE = '/images/products/about-honey-process.jpg';

const DEFAULT_HIGHLIGHTS = [
  {
    icon: 'Leaf',
    title: 'Sustainable Sourcing',
    description: 'We partner with certified organic farms that prioritize environmental stewardship.',
  },
  {
    icon: 'Heart',
    title: 'Health First',
    description: 'Every product is carefully selected to support your wellness journey.',
  },
  {
    icon: 'Users',
    title: 'Community Focused',
    description: 'We support local farmers and contribute to sustainable communities.',
  },
];

const resolveHomeStoryImage = (img) => {
  const value = String(img || '').trim();
  if (!value || value === '/images/about-herbs.jpg') return DEFAULT_HOME_IMAGE;
  if (/^https?:\/\//i.test(value)) return value;
  return getAbsoluteImageUrl(value, { defaultFolder: 'blog' });
};

export function About() {
 const { settings } = useSettings();
 const storeName = settings.storeName || 'Naturanza Food';
 const [aboutContent, setAboutContent] = useState(null);
 const { ref: imageRef, isVisible: imageVisible } = useScrollReveal();
 const { ref: contentRef, isVisible: contentVisible } = useScrollReveal({ threshold: 0.2 });

 useEffect(() => {
  let cancelled = false;
  aboutAPI
   .getContent()
   .then((data) => {
    if (!cancelled && data && typeof data === 'object') {
     setAboutContent(data);
    }
   })
   .catch(() => {});
  return () => {
   cancelled = true;
  };
 }, []);

 const eyebrow = aboutContent?.hero?.eyebrow || 'About Us';
 const heading = aboutContent?.story?.heading || "Bringing Nature's Best to Your Table";
 const leadText =
  aboutContent?.hero?.subtitle ||
  `At ${storeName}, we believe in the power of pure, organic ingredients to transform lives and promote wellness.`;
 const storyParagraph =
  (Array.isArray(aboutContent?.story?.paragraphs) && aboutContent.story.paragraphs[0]) ||
  'We source the finest pure organic products directly from trusted local farms across Pakistan. Our commitment to quality, purity, and environmental responsibility sets us apart.';
 const storyImage = resolveHomeStoryImage(aboutContent?.story?.image);
 const highlights =
  Array.isArray(aboutContent?.values?.items) && aboutContent.values.items.length > 0
   ? aboutContent.values.items.slice(0, 3)
   : DEFAULT_HIGHLIGHTS;
 const stats =
  Array.isArray(aboutContent?.stats) && aboutContent.stats.length > 0
   ? aboutContent.stats.slice(0, 4)
   : [];

 return (
 <section className="py-8 sm:py-10 lg:py-14 bg-white">
 <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-10">
 <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-6 sm:gap-8 md:gap-10 lg:gap-12 xl:gap-16 items-start lg:items-center">
 {/* Image Side */}
 <div
 className={`relative order-2 lg:order-1 reveal reveal-left ${
  imageVisible ? 'active' : ''
 }`}
 ref={imageRef}
 >
 <div className="relative h-[220px] sm:h-[320px] md:h-[390px] lg:h-[460px] rounded-2xl md:rounded-3xl overflow-hidden shadow-xl md:shadow-2xl bg-[#eef7ef]">
 <img
 src={storyImage}
 alt={`Natural organic sourcing at ${storeName}`}
 onError={(event) => {
  event.currentTarget.onerror = null;
  event.currentTarget.src = DEFAULT_HOME_IMAGE;
 }}
 className="w-full h-full object-cover object-[center_42%] md:object-center"
 />
 <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-emerald-900/10 via-transparent to-amber-200/20" />
 </div>
 {stats.length > 0 && (
  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
   {stats.map((stat, idx) => (
    <div
     key={`${stat.label || 'stat'}-${idx}`}
     className="rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2.5 text-center"
    >
     <p className="font-display text-lg sm:text-xl font-bold text-green-800 leading-tight">
      {stat.value}
      {stat.suffix || ''}
     </p>
     <p className="text-[11px] font-medium text-gray-600 mt-0.5 truncate">{stat.label}</p>
    </div>
   ))}
  </div>
 )}
 <div className="absolute -bottom-8 -right-8 w-36 h-36 md:w-52 md:h-52 bg-green-200 rounded-full opacity-45 blur-3xl -z-10"></div>
 <div className="absolute -top-8 -left-8 w-36 h-36 md:w-52 md:h-52 bg-amber-200 rounded-full opacity-45 blur-3xl -z-10"></div>
 </div>

 {/* Content Side */}
 <div
 className={`order-1 lg:order-2 space-y-4 sm:space-y-5 md:space-y-6 min-w-0 reveal reveal-right ${
  contentVisible ? 'active' : ''
 }`}
 ref={contentRef}
 >
 <div>
 <span className="text-green-700 font-semibold text-sm md:text-sm uppercase tracking-wider">
 {eyebrow}
 </span>
 <h2 className="text-[1.75rem] sm:text-[2.1rem] md:text-[2.4rem] lg:text-[2.75rem] xl:text-[3rem] font-bold text-gray-900 mt-2 mb-3 md:mb-4 leading-[1.12] max-w-[17ch] sm:max-w-[18ch] break-words">
 {heading}
 </h2>
 <p className="text-[14px] sm:text-sm md:text-base text-gray-600 max-w-[62ch] leading-relaxed">
 {leadText}
 </p>
 </div>

 <p className="text-[14px] sm:text-sm md:text-base text-gray-600 leading-relaxed max-w-[62ch]">
 {storyParagraph}
 </p>

 <div className="space-y-3 md:space-y-4">
 {highlights.map((item, idx) => {
  const Icon = VALUE_ICON_MAP[item.icon] || Leaf;
  return (
   <div
    key={`${item.title || 'value'}-${idx}`}
    className="flex items-start gap-3 md:gap-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-3 py-2.5 md:border-0 md:bg-transparent md:px-0 md:py-0"
   >
    <div className="w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
     <Icon className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-green-700" />
    </div>
    <div>
     <h3 className="font-semibold text-gray-900 mb-1 text-[13px] sm:text-sm md:text-base">{item.title}</h3>
     <p className="text-gray-600 text-[12px] sm:text-[13px] md:text-sm leading-relaxed">
      {item.description}
     </p>
    </div>
   </div>
  );
 })}
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
