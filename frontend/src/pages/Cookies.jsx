import { Cookie, Settings, Shield } from 'lucide-react';
import { BUSINESS_INFO } from '@/config/legal';

export function Cookies() {
 const sections = [
 {
 title: 'What Are Cookies',
 content:
 'Cookies are small text files stored on your device to improve functionality, remember preferences, and support analytics.',
 },
 {
 title: 'How We Use Cookies',
 content:
 'We use cookies for essential site operations, session continuity, cart persistence, performance analytics, and user experience improvements.',
 },
 {
 title: 'Managing Cookies',
 content:
 'You can disable cookies via browser settings, though some features may not function correctly.',
 },
 {
 title: 'Cookie Consent',
 content:
 `By continuing to browse ${BUSINESS_INFO.websiteDomain}, you consent to necessary cookies. Optional cookies can be controlled through browser or device settings.`,
 },
 ];

 return (
 <main className="pt-24 pb-16 min-h-screen bg-[#faf8f3]">
 <div className="container-custom">
 <header className="text-center mb-10">
 <span className="inline-flex items-center gap-2 text-[#3d7a3d] font-semibold text-xs uppercase tracking-wider">
 <Cookie className="w-4 h-4" />
 Preferences
 </span>
 <h1 className="text-2xl md:text-4xl font-bold text-[#2d3a2d] mt-3">Cookie Policy</h1>
 <p className="text-sm md:text-base text-[#6b7a6b] mt-3 max-w-2xl mx-auto">
 This page explains how cookies and similar technologies are used on Naturanza Food.
 </p>
 <p className="text-xs text-[#8a958a] mt-2">Last updated: March 15, 2026</p>
 </header>

 <section className="grid gap-4 md:gap-5 max-w-4xl mx-auto">
 {sections.map((section) => (
 <article key={section.title} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 md:p-6">
 <h2 className="text-lg font-semibold text-[#2d3a2d] mb-2">{section.title}</h2>
 <p className="text-sm md:text-base text-[#5f6d5f] leading-relaxed">{section.content}</p>
 </article>
 ))}
 </section>

 <section className="max-w-4xl mx-auto mt-6 bg-green-50 border border-green-100 rounded-2xl p-5 md:p-6">
 <div className="flex items-start gap-3">
 <Settings className="w-5 h-5 text-[#3d7a3d] mt-0.5" />
 <p className="text-sm text-[#4f5f4f] leading-relaxed">
 Adjust your browser cookie settings at any time to control tracking and stored preferences. For help, email {BUSINESS_INFO.contacts.supportEmail}.
 </p>
 </div>
 <div className="flex items-start gap-3 mt-3">
 <Shield className="w-5 h-5 text-[#3d7a3d] mt-0.5" />
 <p className="text-sm text-[#4f5f4f] leading-relaxed">
 Essential cookies are required for core operations such as cart, login state, and secure checkout. For policy requests, contact {BUSINESS_INFO.contacts.privacyEmail}.
 </p>
 </div>
 </section>
 </div>
 </main>
 );
}

export default Cookies;
