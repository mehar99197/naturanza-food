import { HelpCircle } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { BUSINESS_INFO, SHIPPING_POLICY, RETURNS_POLICY } from '@/config/legal';
import { FAQSEO } from '@/components/SEO';
import { useSettings } from '@/context/SettingsContext';
import { formatPrice } from '@/lib/utils';

export function FAQ() {
  const { settings } = useSettings();
  const supportEmail = settings.storeEmail || BUSINESS_INFO.contacts.supportEmail;
  const supportPhone = settings.storePhone || BUSINESS_INFO.contacts.phone;
  const parsedFreeShipping = Number(settings.shippingFree);
  const freeShippingAmount =
    Number.isFinite(parsedFreeShipping) && parsedFreeShipping > 0
      ? parsedFreeShipping
      : SHIPPING_POLICY.freeShippingThresholdAmount;
  const formattedFreeThreshold =
    formatPrice(freeShippingAmount, settings.currency || 'PKR') ||
    SHIPPING_POLICY.freeShippingThreshold;
  const faqs = [
    {
      question: 'How long does delivery take?',
      answer: `Most orders are delivered within ${SHIPPING_POLICY.standardWindow} across Pakistan after dispatch, depending on your city. Prepaid online orders (via SafePay) of ${formattedFreeThreshold} or more qualify for free shipping, while Cash on Delivery orders carry standard city-specific courier charges.`,
    },
    {
      question: 'What payment methods do you accept?',
      answer:
        'You can pay securely online via SafePay (Visa, Mastercard, Raast, and supported mobile wallets) or choose Cash on Delivery (COD) across Pakistan. All prices are in Pakistani Rupees (PKR).',
    },
    {
      question: 'Are your products 100% organic?',
      answer:
        'Yes, we source from trusted farms and prioritize pure, chemical-free organic and natural ingredients.',
    },
    {
      question: 'Can I track my order?',
      answer: 'Yes, you can track your order from your account Orders section after dispatch.',
    },
    {
      question: 'Do you offer returns and refunds?',
      answer: `Returns and replacements are accepted within ${RETURNS_POLICY.returnWindow} of delivery for damaged, defective, or incorrect items in their original sealed packaging. Approved refunds are processed within ${RETURNS_POLICY.refundWindow} to your original payment method after quality inspection (${RETURNS_POLICY.inspectionWindow}).`,
    },
    {
      question: 'How can I contact support quickly?',
      answer: `You can reach ${BUSINESS_INFO.brandName} (${BUSINESS_INFO.legalName}) at ${supportEmail} or call ${supportPhone} (${BUSINESS_INFO.supportHours}). Registered address: ${BUSINESS_INFO.officeAddress}.`,
    },
    {
      question: 'Do you deliver outside Pakistan?',
      answer:
        'At the moment, we deliver nationwide across Pakistan. International shipping availability may vary by product and destination.',
    },
    {
      question: 'How do I change or cancel an order?',
      answer:
        'Order changes or cancellations are possible before dispatch for a full refund. Contact support immediately with your order ID for assistance.',
    },
  ];
  const faqStructuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map((faq) => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };
  return (
    <>
      <FAQSEO />
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(faqStructuredData)}
        </script>
      </Helmet>
    <main className="pt-24 pb-16 min-h-screen bg-[#faf8f3]">
 <div className="container-custom">
 <header className="text-center mb-10">
 <span className="inline-flex items-center gap-2 text-[#3d7a3d] font-semibold text-xs uppercase tracking-wider">
 <HelpCircle className="w-4 h-4" />
 Support
 </span>
 <h1 className="text-2xl md:text-4xl font-bold text-[#2d3a2d] mt-3">Frequently Asked Questions</h1>
 <p className="text-sm md:text-base text-[#6b7a6b] mt-3 max-w-2xl mx-auto">
 Quick answers to common questions about orders, products, and support.
 </p>
 </header>

 <section className="max-w-4xl mx-auto grid gap-4">
 {faqs.map((item) => (
 <article key={item.question} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 md:p-6">
 <h2 className="text-base md:text-lg font-semibold text-[#2d3a2d] mb-2">{item.question}</h2>
 <p className="text-sm md:text-base text-[#5f6d5f] leading-relaxed">{item.answer}</p>
 </article>
 ))}
 </section>

 <section className="max-w-4xl mx-auto mt-6 bg-green-50 border border-green-100 rounded-2xl p-5 md:p-6">
 <p className="text-sm text-[#4f5f4f] leading-relaxed">
 Need more help? Contact our support desk at {supportEmail} or {supportPhone}.
 </p>
</section>
  </div>
  </main>
  </>
  );
}

export default FAQ;
