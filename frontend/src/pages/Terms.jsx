import { FileText, Scale } from 'lucide-react';
import { BUSINESS_INFO } from '@/config/legal';
import { TermsSEO } from '@/components/SEO';
import { useSettings } from '@/context/SettingsContext';

export function Terms() {
 const { settings } = useSettings();
 const legalEmail = settings.storeEmail || BUSINESS_INFO.contacts.legalEmail;
 const supportPhone = settings.storePhone || BUSINESS_INFO.contacts.phone;
 const sections = [
 {
 title: 'Acceptance of Terms',
 content:
 `By accessing and using ${BUSINESS_INFO.brandName}, you agree to comply with these Terms of Service and all applicable laws and regulations.`,
 },
 {
 title: 'Orders and Payments',
 content:
 'All orders are subject to product availability and payment confirmation. Prices are listed in Pakistani Rupees (PKR). We accept Cash on Delivery (with a small advance shipping fee) and online payment via JazzCash, EasyPaisa, or bank transfer. Prices and promotions may change without prior notice.',
 },
 {
 title: 'Product Information',
 content:
 'We aim to provide accurate product details, but slight variations in packaging, color, weight, or description may occur due to supplier and batch updates.',
 },
 {
 title: 'Governing Law and Jurisdiction',
 content:
 `These terms are governed by the ${BUSINESS_INFO.governingLaw}. Any disputes shall be resolved under the competent courts of Lahore, Pakistan.`,
 },
 {
 title: 'Limitation of Liability',
 content:
 `${BUSINESS_INFO.brandName} is not liable for indirect or incidental damages resulting from product use, delays, third-party courier issues, or temporary website interruptions.`,
 },
 ];

return (
    <>
      <TermsSEO />
    <main className="pt-24 pb-16 min-h-screen bg-[#faf8f3]">
 <div className="container-custom">
 <header className="text-center mb-10">
 <span className="inline-flex items-center gap-2 text-[#3d7a3d] font-semibold text-xs uppercase tracking-wider">
 <Scale className="w-4 h-4" />
 Legal
 </span>
 <h1 className="text-2xl md:text-4xl font-bold text-[#2d3a2d] mt-3">Terms of Service</h1>
 <p className="text-sm md:text-base text-[#6b7a6b] mt-3 max-w-2xl mx-auto">
 Please read these terms carefully before using our website and services.
 </p>
 <p className="text-xs text-[#8a958a] mt-2">Last updated: May 31, 2026</p>
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
 <FileText className="w-5 h-5 text-[#3d7a3d] mt-0.5" />
 <p className="text-sm text-[#4f5f4f] leading-relaxed">
 For legal questions, contact {BUSINESS_INFO.legalName} at {legalEmail} or {supportPhone}. Registered office: {BUSINESS_INFO.officeAddress}. Continued use of this website indicates acceptance of these terms.
 </p>
 </div>
 </section>
</div>
  </main>
  </>
  );
}

export default Terms;
