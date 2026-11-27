import { Link } from 'react-router-dom';
import { Truck, Clock3, PackageCheck, MapPin, Mail, Phone } from 'lucide-react';
import { BUSINESS_INFO, SHIPPING_POLICY } from '@/config/legal';
import { ShippingSEO } from '@/components/SEO';
import { ShippingPolicyStructuredData } from '@/components/StructuredData';
import { useSettings } from '@/context/SettingsContext';
import { formatPrice } from '@/lib/utils';

const normalizePhoneLink = (value) => String(value || '').replace(/[^\d+]/g, '');

export function Shipping() {
  const { settings } = useSettings();
  const storeName = settings.storeName || BUSINESS_INFO.brandName;
  const officeAddress = settings.address || BUSINESS_INFO.officeAddress;
  const supportEmail = settings.storeEmail || BUSINESS_INFO.contacts.shippingEmail;
  const supportPhone = settings.storePhone || BUSINESS_INFO.contacts.phone;
  const phoneLink = normalizePhoneLink(supportPhone);
  const currency = settings.currency || 'PKR';
  const parsedFreeShipping = Number(settings.shippingFree);
  const freeShippingAmount =
    settings.shippingFree !== '' &&
    settings.shippingFree != null &&
    Number.isFinite(parsedFreeShipping) &&
    parsedFreeShipping >= 0
      ? parsedFreeShipping
      : SHIPPING_POLICY.freeShippingThresholdAmount;
  const hasFlatShipping =
    settings.shippingFlat !== '' &&
    settings.shippingFlat !== null &&
    settings.shippingFlat !== undefined;
  const parsedFlatShipping = Number(settings.shippingFlat);
  const flatShippingAmount =
    hasFlatShipping && Number.isFinite(parsedFlatShipping) && parsedFlatShipping >= 0
      ? parsedFlatShipping
      : SHIPPING_POLICY.defaultShippingFlatAmount;
  const formattedFreeThreshold = formatPrice(freeShippingAmount, currency) || SHIPPING_POLICY.freeShippingThreshold;
  const formattedFlatRate = formatPrice(flatShippingAmount, currency) || 'Rs. 250';

  const sections = [
    {
      title: 'Order Processing & Dispatch',
      content: `Orders placed on ${storeName} (operated by ${BUSINESS_INFO.legalName}) are verified and processed within ${SHIPPING_POLICY.processingWindow} (Monday to Saturday) from our fulfillment facility in ${SHIPPING_POLICY.dispatchCity}. Orders placed on Sundays or public holidays are dispatched on the next working day.`,
    },
    {
      title: 'Delivery Timeline Across Pakistan',
      content: `Standard nationwide delivery takes ${SHIPPING_POLICY.standardWindow} across Pakistan after dispatch. Deliveries to major cities generally arrive within 2–4 working days, while remote or out-of-service-area locations may take up to 5 working days.`,
    },
    {
      title: 'Shipping Charges & Free Delivery Threshold',
      content: `We deliver nationwide across Pakistan. Standard shipping charges (typically ${formattedFlatRate}, or the city-specific courier rate) are calculated and displayed transparently at checkout before you pay. ${
        freeShippingAmount === 0
          ? 'Prepaid online orders (via SafePay) qualify for Free Shipping anywhere in Pakistan.'
          : `Prepaid online orders (via SafePay) of ${formattedFreeThreshold} or more qualify for Free Shipping anywhere in Pakistan.`
      } Cash on Delivery (COD) orders carry the applicable city-specific courier fee (where advance delivery-fee confirmation applies, the delivery fee is paid via SafePay and the remaining product total is paid in cash upon delivery).`,
    },
    {
      title: 'Accepted Payment Methods',
      content:
        'We accept secure online payments via SafePay (Visa, Mastercard, Raast, and supported mobile wallets) as well as Cash on Delivery (COD) where available. All product prices and shipping fees are billed in Pakistani Rupees (PKR).',
    },
    {
      title: 'Order Tracking & Delivery Inspection',
      content:
        'Once your parcel is handed over to our courier partner, tracking details are updated in your account Orders section and shared via email/notification. Please inspect your package upon arrival and notify our support team promptly if any item is damaged, leaked, or missing.',
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
              Shipping Policy
            </span>
            <h1 className="text-2xl md:text-4xl font-bold text-[#2d3a2d] mt-3">
              Shipping &amp; Delivery Policy
            </h1>
            <p className="text-sm md:text-base text-[#6b7a6b] mt-3 max-w-2xl mx-auto">
              Clear and transparent shipping timelines, rates, and delivery terms for orders placed
              with {storeName} (Legal Name: {BUSINESS_INFO.legalName}).
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
              <Clock3 className="w-5 h-5 text-[#3d7a3d] mt-0.5 flex-shrink-0" />
              <p className="text-sm text-[#4f5f4f] leading-relaxed">
                Delivery windows ({SHIPPING_POLICY.standardWindow}) may occasionally vary during
                public holidays, severe weather, or courier disruptions. If your order is delayed,
                reach out to us and we will coordinate directly with the courier.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <PackageCheck className="w-5 h-5 text-[#3d7a3d] mt-0.5 flex-shrink-0" />
              <p className="text-sm text-[#4f5f4f] leading-relaxed">
                Received a damaged or incorrect shipment? Review our{' '}
                <Link to="/returns" className="font-semibold text-[#2f6f2f] underline hover:text-[#1f4f1f]">
                  Returns &amp; Refund Policy
                </Link>{' '}
                for full eligibility and refund timelines.
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
                  {storeName} ({BUSINESS_INFO.legalName}), {officeAddress}
                </span>
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

export default Shipping;
