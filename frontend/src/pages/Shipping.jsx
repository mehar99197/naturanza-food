import { Truck, Clock3, PackageCheck } from 'lucide-react';
import { BUSINESS_INFO, SHIPPING_POLICY } from '@/config/legal';
import { ShippingSEO } from '@/components/SEO';
import { ShippingPolicyStructuredData } from '@/components/StructuredData';
import { useSettings } from '@/context/SettingsContext';

export function Shipping() {
 const { settings } = useSettings();
 const shippingEmail = settings.storeEmail || BUSINESS_INFO.contacts.shippingEmail;
 const sections = [
 {
 title: 'Processing Time',
 content: `Orders are typically processed within 24 hours on business days from our ${SHIPPING_POLICY.dispatchCity} fulfillment center.`,
 },
 {
 title: 'Delivery Window',
 content: `Standard delivery usually takes ${SHIPPING_POLICY.standardWindow} after dispatch. Express shipping, where available, takes ${SHIPPING_POLICY.expressWindow}.`,
 },
 {
 title: 'Delivery Areas & Charges',
 content: `We deliver across Pakistan. The delivery fee for your city is shown at checkout, and shipping is free on orders above ${SHIPPING_POLICY.freeShippingThreshold}.`,
 },
 {
 title: 'Payment Options',
 content: 'Pay by Cash on Delivery (with a small advance shipping fee) or online via JazzCash, EasyPaisa, or bank transfer. All charges are in Pakistani Rupees (PKR).',
 },
 {
 title: 'Tracking Information',
 content: 'A tracking update is shared once your order is dispatched.',
 },
 ];

return (
    <>
      <ShippingSEO />
      <ShippingPolicyStructuredData />
    <main className="pt-24 pb-16 min-h-screen bg-[#faf8f3]">
 <div className="container-custom">
 <header className="text-center mb-10">
 <span className="inline-flex items-center gap-2 text-[#3d7a3d] font-semibold text-xs uppercase tracking-wider">
 <Truck className="w-4 h-4" />
 Support
 </span>
 <h1 className="text-2xl md:text-4xl font-bold text-[#2d3a2d] mt-3">Shipping Information</h1>
 <p className="text-sm md:text-base text-[#6b7a6b] mt-3 max-w-2xl mx-auto">
 Clear and transparent shipping details for a smooth delivery experience.
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
 <Clock3 className="w-5 h-5 text-[#3d7a3d] mt-0.5" />
 <p className="text-sm text-[#4f5f4f] leading-relaxed">
 Delivery timelines may vary during holidays, weather disruptions, or high-demand periods. For updates, contact {shippingEmail}.
 </p>
 </div>
 <div className="flex items-start gap-3 mt-3">
 <PackageCheck className="w-5 h-5 text-[#3d7a3d] mt-0.5" />
 <p className="text-sm text-[#4f5f4f] leading-relaxed">
 Please inspect your package upon delivery and report any issue within 48 hours.
 </p>
 </div>
 </section>
</div>
  </main>
  </>
  );
}

export default Shipping;
