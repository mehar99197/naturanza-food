import { Lock, Eye, Database } from 'lucide-react';
import { BUSINESS_INFO } from '@/config/legal';

export function Privacy() {
 const sections = [
 {
 title: 'Information We Collect',
 content:
 'We collect details you provide during account creation, orders, and contact requests such as name, email, address, and phone number.',
 },
 {
 title: 'How We Use Data',
 content:
 'Your data is used to process orders, provide customer support, prevent fraud, send service updates, and improve shopping experience.',
 },
 {
 title: 'Lawful Basis and Retention',
 content:
 'We process data for order fulfillment, legitimate business operations, and legal compliance. Order records are generally retained for up to 24 months unless extended by legal requirements.',
 },
 {
 title: 'Data Security',
 content:
 'We apply technical and organizational safeguards to protect your information against unauthorized access and misuse.',
 },
 {
 title: 'Your Rights',
 content:
 'You may request access, correction, or deletion of your personal data by contacting our support team.',
 },
 ];

 return (
 <main className="pt-24 pb-16 min-h-screen bg-[#faf8f3]">
 <div className="container-custom">
 <header className="text-center mb-10">
 <span className="inline-flex items-center gap-2 text-[#3d7a3d] font-semibold text-xs uppercase tracking-wider">
 <Lock className="w-4 h-4" />
 Security
 </span>
 <h1 className="text-2xl md:text-4xl font-bold text-[#2d3a2d] mt-3">Privacy Policy</h1>
 <p className="text-sm md:text-base text-[#6b7a6b] mt-3 max-w-2xl mx-auto">
 Your privacy matters to us. This policy explains how we handle your personal information.
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
 <Eye className="w-5 h-5 text-[#3d7a3d] mt-0.5" />
 <p className="text-sm text-[#4f5f4f] leading-relaxed">
 We never sell your personal data. For privacy requests, email {BUSINESS_INFO.contacts.privacyEmail}.
 </p>
 </div>
 <div className="flex items-start gap-3 mt-3">
 <Database className="w-5 h-5 text-[#3d7a3d] mt-0.5" />
 <p className="text-sm text-[#4f5f4f] leading-relaxed">
 Local storage may be used for cart, wishlist, and personalization to improve site performance. For account-related concerns, contact {BUSINESS_INFO.contacts.supportEmail} or {BUSINESS_INFO.contacts.phone}. Office: {BUSINESS_INFO.officeAddress}.
 </p>
 </div>
 </section>
 </div>
 </main>
 );
}

export default Privacy;
