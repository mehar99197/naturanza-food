import { useEffect, useRef, useState } from 'react';
import { Leaf, Heart, Globe, Shield, Award } from 'lucide-react';
import { useScrollReveal } from '@/hooks/useScrollReveal';

const values = [
 {
 icon: Leaf,
 title: 'Purity First',
 description: 'We never compromise on the purity of our products. Every item is tested for quality and authenticity.'
 },
 {
 icon: Heart,
 title: 'Customer Care',
 description: 'Your health and satisfaction are our top priorities. We are here to support your wellness journey.'
 },
 {
 icon: Globe,
 title: 'Sustainability',
 description: 'We are committed to eco-friendly practices, from sourcing to packaging, to protect our planet.'
 },
 {
 icon: Shield,
 title: 'Transparency',
 description: 'Full disclosure of ingredients and sourcing. Know exactly what you are putting in your body.'
 }
];

const stats = [
 { target: 14, suffix: '+', label: 'Years Experience' },
 { target: 50, suffix: 'K+', label: 'Happy Customers' },
 { target: 100, suffix: '+', label: 'Organic Products' },
 { target: 25, suffix: '+', label: 'Partner Farms' }
];

export function About() {
 const { ref: heroRef, isVisible: heroVisible } = useScrollReveal();
 const { ref: storyRef, isVisible: storyVisible } = useScrollReveal();
 const { ref: valuesRef, isVisible: valuesVisible } = useScrollReveal();
 const valuesTrackRef = useRef(null);
 const valuesProgrammaticScrollRef = useRef(false);
 const teamTrackRef = useRef(null);
 const teamProgrammaticScrollRef = useRef(false);
 const statsSectionRef = useRef(null);
 const [animatedStats, setAnimatedStats] = useState(() => stats.map(() => 0));
 const [statsAnimationStarted, setStatsAnimationStarted] = useState(false);

 const teamMembers = [
 { name: 'Dr. Sarah Chen', role: 'Founder & CEO', image: '/images/avatars/avatar1.jpg' },
 { name: 'Michael Roberts', role: 'Head of Operations', image: '/images/avatars/avatar2.jpg' },
 { name: 'Emma Wilson', role: 'Product Specialist', image: '/images/avatars/avatar3.jpg' }
 ];

 useEffect(() => {
 // Keep auto-scroll behavior mobile-only.
 if (typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches) {
 return;
 }

 const track = valuesTrackRef.current;
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

 valuesProgrammaticScrollRef.current = true;
 track.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });

 if (programmaticResetTimer) clearTimeout(programmaticResetTimer);
 programmaticResetTimer = setTimeout(() => {
 valuesProgrammaticScrollRef.current = false;
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

 useEffect(() => {
 const section = statsSectionRef.current;
 if (!section || statsAnimationStarted) return;

 const observer = new IntersectionObserver(
 ([entry]) => {
 if (entry.isIntersecting) {
 setStatsAnimationStarted(true);
 observer.disconnect();
 }
 },
 { threshold: 0.3 }
 );

 observer.observe(section);

 return () => observer.disconnect();
 }, [statsAnimationStarted]);

 useEffect(() => {
 if (!statsAnimationStarted) return;

 let animationFrameId;
 const startTime = performance.now();
 const durationMs = 4200;
 const staggerMs = 220;

 const animate = (now) => {
 const nextValues = stats.map((stat, index) => {
 const elapsed = now - startTime - index * staggerMs;

 if (elapsed <= 0) return 0;

 const progress = Math.min(1, elapsed / durationMs);
 // Cinematic ease-out: noticeably slows before reaching final value.
 const easedProgress = 1 - Math.pow(1 - progress, 5);

 return Math.round(stat.target * easedProgress);
 });

 setAnimatedStats(nextValues);

 const isComplete = stats.every(
 (_, index) => now - startTime - index * staggerMs >= durationMs
 );

 if (!isComplete) {
 animationFrameId = requestAnimationFrame(animate);
 }
 };

 animationFrameId = requestAnimationFrame(animate);

 return () => {
 if (animationFrameId) {
 cancelAnimationFrame(animationFrameId);
 }
 };
 }, [statsAnimationStarted]);

 useEffect(() => {
 // Keep auto-scroll behavior mobile-only.
 if (typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches) {
 return;
 }

 const track = teamTrackRef.current;
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

 teamProgrammaticScrollRef.current = true;
 track.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' });

 if (programmaticResetTimer) clearTimeout(programmaticResetTimer);
 programmaticResetTimer = setTimeout(() => {
 teamProgrammaticScrollRef.current = false;
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
 <main className="pt-14 sm:pt-20 pb-14 sm:pb-16 lg:pb-20 overflow-x-hidden">
 {/* Hero */}
 <section className="section-padding pt-0 bg-gradient-to-br from-[#e8f0e8] to-[#faf8f3]" ref={heroRef}>
 <div className="container-custom text-center">
 <span className="inline-block mt-4 sm:mt-5 text-[#3d7a3d] font-medium text-[10px] sm:text-sm uppercase tracking-wider">
 About Naturanza
 </span>
 <h1 className={`font-display text-[2rem] leading-tight sm:text-3xl md:text-[2.25rem] lg:text-4xl xl:text-5xl font-bold text-[#2d3a2d] mt-3 md:mt-4 mb-4 md:mb-6 ${
 heroVisible ? '' : 'opacity-100 md:opacity-0'
 }`}>
 Our Journey Towards
 <br />
 <span className="text-[#3d7a3d]">Natural Wellness</span>
 </h1>
 <p className={`text-[13px] sm:text-sm md:text-base text-[#6b7a6b] max-w-2xl mx-auto px-4 ${
 heroVisible ? '' : 'opacity-100 md:opacity-0'
 }`} style={{ animationDelay: '0.2s' }}>
 Since 2010, we have been on a mission to bring the healing power of nature 
 to every home, one organic product at a time.
 </p>
 </div>
 </section>

 {/* Story */}
 <section className="section-padding bg-white" ref={storyRef}>
 <div className="container-custom">
 <div className="grid md:grid-cols-2 gap-5 sm:gap-8 md:gap-10 lg:gap-12 items-center">
 <div className={`${storyVisible ? '' : 'opacity-100 md:opacity-0'}`}>
 <img
 src="/images/about-herbs.jpg"
 alt="Our story"
 className="rounded-3xl shadow-2xl w-full h-[260px] sm:h-[320px] md:h-[420px] lg:h-[440px] xl:h-[500px] object-cover"
 />
 </div>
 <div className={`${storyVisible ? '' : 'opacity-100 md:opacity-0'} mt-1 sm:mt-2 lg:mt-0`} style={{ animationDelay: '0.2s' }}>
 <h2 className="font-display text-xl md:text-2xl font-bold text-[#2d3a2d] mb-4 md:mb-6">
 From Farm to Family
 </h2>
 <div className="max-w-xl space-y-3 md:space-y-4 text-[#6b7a6b] text-[13px] sm:text-sm md:text-base lg:text-[17px] leading-6 sm:leading-7 md:leading-relaxed lg:leading-8">
 <p>
 Naturanza Food was born from a simple belief: that nature provides everything we need 
 to live healthy, vibrant lives. Our founder, after experiencing the transformative 
 power of herbal remedies firsthand, set out to create a brand that would make 
 these natural solutions accessible to everyone.
 </p>
 <p>
 We started small, working directly with local organic farmers who shared our 
 passion for purity and sustainability. Today, we have grown into a trusted 
 name in natural wellness, but our core values remain unchanged.
 </p>
 <p>
 Every product in our collection is a testament to our commitment to quality. 
 From the moment a seed is planted to the final product reaching your doorstep, 
 we ensure that every step meets our rigorous standards.
 </p>
 </div>
 </div>
 </div>
 </div>
 </section>

 {/* Stats */}
 <section ref={statsSectionRef} className="py-10 sm:py-12 md:py-16 bg-[#3d7a3d]">
 <div className="container-custom">
 <div className="grid grid-cols-2 md:grid-cols-4 gap-5 sm:gap-6 md:gap-8">
 {stats.map((stat, index) => (
 <div
 key={stat.label}
 className="text-center"
 style={{ animationDelay: `${index * 0.1}s` }}
 >
 <div className="font-display text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-2">
 {`${animatedStats[index]}${stat.suffix}`}
 </div>
 <div className="text-white/80 text-xs sm:text-sm md:text-base">{stat.label}</div>
 </div>
 ))}
 </div>
 </div>
 </section>

 {/* Values */}
 <section className="section-padding bg-[#faf8f3] relative" ref={valuesRef}>
 <div className="container-custom">
 <div className="text-center mb-8 sm:mb-12 md:mb-16">
 <span className="text-[#3d7a3d] font-medium text-sm uppercase tracking-wider">
 Our Values
 </span>
 <h2 className="font-display text-2xl md:text-3xl font-bold text-[#2d3a2d] mt-2 mb-3">
 What We Stand For
 </h2>
 </div>

 <div
 ref={valuesTrackRef}
 className="flex flex-nowrap overflow-x-auto gap-0 md:grid md:grid-cols-2 lg:grid-cols-4 md:gap-8 pb-2 sm:pb-4 md:pb-4 scrollbar-hide snap-x snap-mandatory scroll-smooth md:overflow-visible md:snap-none"
 style={{
 scrollbarWidth: 'none',
 msOverflowStyle: 'none',
 WebkitOverflowScrolling: 'touch',
 }}
 >
 {values.map((value, index) => (
 <div
 key={value.title}
 className={`bg-white rounded-2xl p-5 sm:p-6 md:p-8 text-center shadow-lg hover:shadow-2xl [1.02] border border-gray-100 hover:border-green-200 relative ${
 valuesVisible ? '' : 'opacity-100 md:opacity-0'
 } snap-center flex-shrink-0 w-full min-w-full md:w-auto md:min-w-0 md:max-w-none`}
 style={{ animationDelay: `${index * 0.1}s` }}
 >
 <div className="w-11 h-11 sm:w-12 sm:h-12 md:w-16 md:h-16 bg-[#3d7a3d]/10 rounded-2xl flex items-center justify-center mx-auto mb-3 md:mb-6">
 <value.icon className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-[#3d7a3d]" />
 </div>
 <h3 className="font-display text-base md:text-xl font-semibold text-[#2d3a2d] mb-2.5 md:mb-4">
 {value.title}
 </h3>
 <p className="text-[#6b7a6b] text-sm md:text-base lg:text-[17px] leading-7 md:leading-relaxed lg:leading-8">
 {value.description}
 </p>
 </div>
 ))}
 </div>
 </div>
 </section>

 {/* Team */}
 <section className="section-padding bg-white relative z-10">
 <div className="container-custom">
 <div className="text-center mb-8 sm:mb-12 md:mb-16">
 <span className="text-[#3d7a3d] font-medium text-sm uppercase tracking-wider">
 Our Team
 </span>
 <h2 className="font-display text-2xl md:text-3xl font-bold text-[#2d3a2d] mt-2 mb-3">
 Meet the People Behind Naturanza
 </h2>
 </div>

 <div
 ref={teamTrackRef}
 className="flex flex-nowrap items-stretch overflow-x-auto gap-0 md:px-0 md:grid md:grid-cols-3 md:gap-10 max-w-4xl lg:max-w-5xl xl:max-w-6xl mx-auto scrollbar-hide snap-x snap-mandatory scroll-smooth md:overflow-visible md:snap-none"
 style={{
 scrollbarWidth: 'none',
 msOverflowStyle: 'none',
 WebkitOverflowScrolling: 'touch',
 }}
 >
 {teamMembers.map((member, index) => (
 <div
 key={member.name}
 className="text-center snap-center flex-shrink-0 w-full min-w-full md:w-auto md:min-w-0 md:max-w-none min-h-[200px] sm:min-h-[220px] md:min-h-0 flex flex-col items-center"
 style={{ animationDelay: `${index * 0.1}s` }}
 >
 <img
 src={member.image}
 alt={member.name}
 className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full mx-auto mb-3 sm:mb-4 object-cover shadow-lg"
 />
 <h3 className="font-display font-semibold text-[15px] sm:text-base md:text-lg mb-1 min-h-[42px] sm:min-h-[48px] flex items-end justify-center">{member.name}</h3>
 <p className="text-[#6b7a6b] text-sm min-h-[20px]">{member.role}</p>
 </div>
 ))}
 </div>
 </div>
 </section>

 {/* Certifications */}
 <section className="section-padding bg-[#faf8f3]">
 <div className="container-custom">
 <div className="text-center mb-7 sm:mb-10 md:mb-12">
 <h2 className="font-display text-xl md:text-2xl font-bold text-[#2d3a2d] mb-2">
 Our Certifications
 </h2>
 <p className="text-[#6b7a6b] text-sm md:text-base">
 Trusted and certified for your peace of mind
 </p>
 </div>

 <div className="grid grid-cols-2 sm:flex sm:flex-wrap justify-center gap-2.5 sm:gap-3 md:gap-6 lg:gap-8">
 {['USDA Organic', 'Non-GMO Project', 'Fair Trade', 'GMP Certified'].map((cert) => (
 <div
 key={cert}
 className="min-h-[44px] flex items-center justify-center gap-2 md:gap-3 bg-white px-2.5 sm:px-4 md:px-6 py-2.5 md:py-4 rounded-xl shadow-md hover:shadow-xl"
 >
 <Award className="w-5 h-5 md:w-6 md:h-6 text-[#3d7a3d] flex-shrink-0" />
 <span className="font-medium text-[#2d3a2d] text-[12px] leading-5 text-center sm:text-sm md:text-base">{cert}</span>
 </div>
 ))}
 </div>
 </div>
 </section>
 </main>
 );
}
