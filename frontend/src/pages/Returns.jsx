import { Link } from 'react-router-dom';
import { RefreshCw, ShieldAlert, BadgeCheck, Mail, Phone, MapPin } from 'lucide-react';
import { BUSINESS_INFO, RETURNS_POLICY } from '@/config/legal';
import { ReturnsSEO } from '@/components/SEO';
import { ReturnPolicyStructuredData } from '@/components/StructuredData';
import { useSettings } from '@/context/SettingsContext';

const normalizePhoneLink = (value) => String(value || '').replace(/[^\d+]/g, '');

export function Returns() {
  const { settings } = useSettings();
  const supportEmail = settings.storeEmail || BUSINESS_INFO.contacts.returnsEmail;
  const supportPhone = settings.storePhone || BUSINESS_INFO.contacts.phone;
  const phoneLink = normalizePhoneLink(supportPhone);

  const sections = [
    {
      title: 'Return Eligibility Window',
      content: `${BUSINESS_INFO.brandName} (Legal Name: ${BUSINESS_INFO.legalName}) offers a ${RETURNS_POLICY.returnWindow} return and replacement window from the date of delivery for items that arrive damaged, defective, leaked, expired, or incorrect.`,
    },
    {
      title: 'Conditions for Eligible Returns',
      content:
        'To qualify for a return or replacement, the item must be unused, unopened, and in its original sealed packaging with intact batch labels, accompanied by your order ID and clear photo/video evidence of the issue.',
    },
    {
      title: 'How to Request a Return or Order Cancellation',
      content: `To initiate a return within ${RETURNS_POLICY.returnWindow} of delivery, contact our customer support team at ${supportEmail} or ${supportPhone} (or submit a return request via your account Orders page) with your order number and photos of the parcel. Orders may also be cancelled prior to dispatch for a full refund.`,
    },
    {
      title: 'Quality Inspection & Refund Processing Timeline',
      content: `Once your returned parcel or claim evidence is received, our team completes a quality inspection within ${RETURNS_POLICY.inspectionWindow}. Approved refunds are processed within ${RETURNS_POLICY.refundWindow} back to your original payment method (card/wallet/bank reversal for SafePay online payments, or bank transfer/mobile wallet for Cash on Delivery orders).`,
    },
    {
      title: 'Return Shipping Costs',
      content:
        'If your order arrived damaged, defective, or incorrect due to a fulfillment or courier issue, return pickup or replacement shipping is covered at no additional cost to you.',
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
              Returns &amp; Refunds
            </span>
            <h1 className="text-2xl md:text-4xl font-bold text-[#2d3a2d] mt-3">
              Returns &amp; Refund Policy
            </h1>
            <p className="text-sm md:text-base text-[#6b7a6b] mt-3 max-w-2xl mx-auto">
              Our return, replacement, and refund process at {BUSINESS_INFO.brandName} (Legal Name:{' '}
              {BUSINESS_INFO.legalName}) is transparent, fair, and customer-focused.
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
              <ShieldAlert className="w-5 h-5 text-[#3d7a3d] mt-0.5 flex-shrink-0" />
              <p className="text-sm text-[#4f5f4f] leading-relaxed">
                For food safety and hygiene reasons, opened or partially consumed food, honey,
                ispaghol, or organic spice packages and change-of-mind returns cannot be accepted
                unless the product was defective or incorrect upon arrival.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <BadgeCheck className="w-5 h-5 text-[#3d7a3d] mt-0.5 flex-shrink-0" />
              <p className="text-sm text-[#4f5f4f] leading-relaxed">
                Need help with a return or refund? Contact our support desk with your Order ID, or
                see our{' '}
                <Link to="/shipping" className="font-semibold text-[#2f6f2f] underline hover:text-[#1f4f1f]">
                  Shipping Policy
                </Link>{' '}
                and{' '}
                <Link to="/terms" className="font-semibold text-[#2f6f2f] underline hover:text-[#1f4f1f]">
                  Terms of Service
                </Link>
                .
              </p>
            </div>
            <div className="pt-3 border-t border-green-200/70 grid sm:grid-cols-3 gap-3 text-xs sm:text-sm text-[#3f4f3f]">
              <div className="flex items-start gap-2">
                <Mail className="w-4 h-4 text-[#3d7a3d] mt-0.5 flex-shrink-0" />
                <a href={`mailto:${supportEmail}`} className="hover:text-[#2f6f2f] underline break-all">
                  {supportEmail}
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

export default Returns;
