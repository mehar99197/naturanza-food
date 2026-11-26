import { Link } from 'react-router-dom';
import { FileText, Scale, Mail, Phone, MapPin } from 'lucide-react';
import { BUSINESS_INFO, SHIPPING_POLICY, RETURNS_POLICY } from '@/config/legal';
import { TermsSEO } from '@/components/SEO';
import { useSettings } from '@/context/SettingsContext';
import { formatPrice } from '@/lib/utils';

const normalizePhoneLink = (value) => String(value || '').replace(/[^\d+]/g, '');

export function Terms() {
  const { settings } = useSettings();
  const legalEmail = settings.storeEmail || BUSINESS_INFO.contacts.legalEmail;
  const supportPhone = settings.storePhone || BUSINESS_INFO.contacts.phone;
  const phoneLink = normalizePhoneLink(supportPhone);
  const currency = settings.currency || 'PKR';
  const parsedFreeShipping = Number(settings.shippingFree);
  const freeShippingAmount =
    Number.isFinite(parsedFreeShipping) && parsedFreeShipping > 0
      ? parsedFreeShipping
      : SHIPPING_POLICY.freeShippingThresholdAmount;
  const formattedFreeThreshold = formatPrice(freeShippingAmount, currency) || SHIPPING_POLICY.freeShippingThreshold;

  const sections = [
    {
      title: 'Acceptance of Terms & Merchant Identity',
      content: `By accessing or purchasing from ${BUSINESS_INFO.websiteUrl}, you agree to be bound by these Terms of Service. This online store operates under the brand name ${BUSINESS_INFO.brandName} (Legal Name: ${BUSINESS_INFO.legalName}), registered at ${BUSINESS_INFO.officeAddress}.`,
    },
    {
      title: 'Orders, Pricing & Payments',
      content:
        'All orders are subject to product availability and payment verification. Prices are displayed and billed in Pakistani Rupees (PKR). We accept secure online payments processed via SafePay (Visa, Mastercard, Raast, and supported digital wallets) as well as Cash on Delivery (COD) where available. Prices, discounts, and stock availability may be updated without prior notice prior to order confirmation.',
    },
    {
      title: 'Shipping & Delivery',
      content: `Confirmed orders are typically dispatched within ${SHIPPING_POLICY.processingWindow} and delivered within ${SHIPPING_POLICY.standardWindow} across Pakistan. Prepaid online orders (SafePay) of ${formattedFreeThreshold} or more qualify for free shipping across Pakistan, while Cash on Delivery (COD) orders carry standard city-specific courier fees displayed at checkout. Full shipping rates and timelines are outlined in our Shipping Policy.`,
    },
    {
      title: 'Returns, Cancellations & Refunds',
      content: `Customers may cancel an order before dispatch or request a return within ${RETURNS_POLICY.returnWindow} of delivery for damaged, defective, or incorrect items in their original sealed packaging. Approved refunds are processed within ${RETURNS_POLICY.refundWindow} to the original payment method following quality inspection (${RETURNS_POLICY.inspectionWindow}). Full details are available in our Returns & Refund Policy.`,
    },
    {
      title: 'Product Information',
      content:
        'We strive to ensure all product descriptions, weights, pricing, and images are accurate and consistent across the storefront. Natural organic products such as raw honey, psyllium husk, and pure spices may exhibit slight natural variations in color or texture between seasonal harvests.',
    },
    {
      title: 'Limitation of Liability',
      content: `${BUSINESS_INFO.brandName} (${BUSINESS_INFO.legalName}) shall not be liable for indirect, incidental, or consequential damages arising from improper product storage/use, third-party courier force majeure delays, or temporary service interruptions, to the fullest extent permitted by applicable law.`,
    },
    {
      title: 'Governing Law & Jurisdiction',
      content: `These Terms of Service are governed by and construed in accordance with the ${BUSINESS_INFO.governingLaw}. Any disputes arising out of or relating to these terms or purchases made on our website shall be subject to the exclusive jurisdiction of the ${BUSINESS_INFO.jurisdiction}.`,
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
              Please read these Terms of Service carefully before using {BUSINESS_INFO.brandName}{' '}
              (Legal Name: {BUSINESS_INFO.legalName}).
            </p>
            <p className="text-xs text-[#8a958a] mt-2">
              Last updated: {BUSINESS_INFO.lastUpdated}
            </p>
          </header>

          <section className="grid gap-4 md:gap-5 max-w-4xl mx-auto">
            {sections.map((section) => (
              <article
                key={section.title}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 md:p-6"
              >
                <h2 className="text-lg font-semibold text-[#2d3a2d] mb-2">{section.title}</h2>
                <p className="text-sm md:text-base text-[#5f6d5f] leading-relaxed">
                  {section.content}
                </p>
              </article>
            ))}
          </section>

          <section className="max-w-4xl mx-auto mt-6 bg-green-50 border border-green-100 rounded-2xl p-5 md:p-6 space-y-3">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-[#3d7a3d] mt-0.5 flex-shrink-0" />
              <p className="text-sm text-[#4f5f4f] leading-relaxed">
                Continued use of this website indicates your acceptance of these terms alongside our{' '}
                <Link to="/shipping" className="font-semibold text-[#2f6f2f] underline hover:text-[#1f4f1f]">
                  Shipping Policy
                </Link>
                ,{' '}
                <Link to="/returns" className="font-semibold text-[#2f6f2f] underline hover:text-[#1f4f1f]">
                  Returns &amp; Refund Policy
                </Link>
                , and{' '}
                <Link to="/privacy" className="font-semibold text-[#2f6f2f] underline hover:text-[#1f4f1f]">
                  Privacy Policy
                </Link>
                .
              </p>
            </div>
            <div className="pt-3 border-t border-green-200/70 grid sm:grid-cols-3 gap-3 text-xs sm:text-sm text-[#3f4f3f]">
              <div className="flex items-start gap-2">
                <Mail className="w-4 h-4 text-[#3d7a3d] mt-0.5 flex-shrink-0" />
                <a href={`mailto:${legalEmail}`} className="hover:text-[#2f6f2f] underline break-all">
                  {legalEmail}
                </a>
              </div>
              <div className="flex items-start gap-2">
                <Phone className="w-4 h-4 text-[#3d7a3d] mt-0.5 flex-shrink-0" />
                <a href={`tel:${phoneLink}`} className="hover:text-[#2f6f2f] underline">
                  {supportPhone}
                </a>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-[#3d7a3d] mt-0.5 flex-shrink-0" />
                <span>
                  {BUSINESS_INFO.brandName} ({BUSINESS_INFO.legalName}), {BUSINESS_INFO.officeAddress}
                </span>
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

export default Terms;
