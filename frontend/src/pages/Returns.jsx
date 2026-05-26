import { RefreshCw, ShieldAlert, BadgeCheck } from 'lucide-react';
import { BUSINESS_INFO, RETURNS_POLICY } from '@/config/legal';
import { ReturnsSEO } from '@/components/SEO';
import { ReturnPolicyStructuredData } from '@/components/StructuredData';
import { useSettings } from '@/context/SettingsContext';

export function Returns() {
 const { settings } = useSettings();
 const returnsEmail = settings.storeEmail || BUSINESS_INFO.contacts.returnsEmail;
 const sections = [
 {
 title: 'Return Window',
 content: `You may request a return within ${RETURNS_POLICY.returnWindow} of receiving your order.`,
 },
 {
 title: 'Eligible Items',
 content:
 'Items must be unused, sealed, and in original packaging to qualify for return approval.',
 },
 {
 title: 'Refund Process',
 content:
 `After a quality check (usually within ${RETURNS_POLICY.inspectionWindow}), approved returns are refunded to the original payment method within ${RETURNS_POLICY.refundWindow}.`,
 },
 {
 title: 'Damaged or Incorrect Orders',
 content:
 'If your order arrives damaged or incorrect, contact support immediately with photos for priority resolution.',
 },
 ];

return (
    <>
      <ReturnsSEO />
      <ReturnPolicyStructuredData />
    <main className="pt-24 pb-16 min-h-screen bg-[#faf8f3]">
 <div className="container-custom">
 <header className="text-center mb-10">
 <span className="inline-flex items-center gap-2 text-[#3d7a3d] font-semibold text-xs uppercase tracking-wider">
 <RefreshCw className="w-4 h-4" />
 Support
 </span>
 <h1 className="text-2xl md:text-4xl font-bold text-[#2d3a2d] mt-3">Returns and Refunds</h1>
 <p className="text-sm md:text-base text-[#6b7a6b] mt-3 max-w-2xl mx-auto">
 Our return process is designed to be transparent, fair, and easy to follow.
 </p>
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
 <ShieldAlert className="w-5 h-5 text-[#3d7a3d] mt-0.5" />
 <p className="text-sm text-[#4f5f4f] leading-relaxed">
 Some products may be non-returnable for hygiene and safety reasons, including opened consumables and temperature-sensitive items.
 </p>
 </div>
 <div className="flex items-start gap-3 mt-3">
 <BadgeCheck className="w-5 h-5 text-[#3d7a3d] mt-0.5" />
 <p className="text-sm text-[#4f5f4f] leading-relaxed">
 For return assistance, contact {returnsEmail} with your order ID and issue details.
 </p>
 </div>
 </section>
</div>
  </main>
  </>
  );
}

export default Returns;
