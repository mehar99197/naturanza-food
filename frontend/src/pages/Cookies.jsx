import { Cookie, Settings, Shield, Mail, Phone, MapPin } from 'lucide-react';
import { BUSINESS_INFO } from '@/config/legal';
import { CookiesSEO } from '@/components/SEO';
import { useSettings } from '@/context/SettingsContext';

const normalizePhoneLink = (value) => String(value || '').replace(/[^\d+]/g, '');

export function Cookies() {
  const { settings } = useSettings();
  const supportEmail = settings.storeEmail || BUSINESS_INFO.contacts.supportEmail;
  const supportPhone = settings.storePhone || BUSINESS_INFO.contacts.phone;
  const phoneLink = normalizePhoneLink(supportPhone);

  const sections = [
    {
      title: 'What Are Cookies',
      content:
        'Cookies are small text files stored on your device to improve functionality, remember preferences, and support website security and analytics.',
    },
    {
      title: 'How We Use Cookies',
      content:
        'We use cookies and browser storage for essential store operations, login session continuity, shopping cart persistence, secure checkout via SafePay, and performance improvements.',
    },
    {
      title: 'Managing Cookies',
      content:
        'You can manage or disable cookies through your browser settings at any time, though disabling essential cookies may affect cart and checkout functionality.',
    },
    {
      title: 'Cookie Consent',
      content: `By continuing to browse ${BUSINESS_INFO.websiteDomain}, operated by ${BUSINESS_INFO.brandName} (Legal Name: ${BUSINESS_INFO.legalName}), you consent to necessary cookies required for core storefront operations.`,
    },
  ];

  return (
    <>
      <CookiesSEO />
      <main className="pt-24 pb-16 min-h-screen bg-[#faf8f3]">
        <div className="container-custom">
          <header className="text-center mb-10">
            <span className="inline-flex items-center gap-2 text-[#3d7a3d] font-semibold text-xs uppercase tracking-wider">
              <Cookie className="w-4 h-4" />
              Preferences
            </span>
            <h1 className="text-2xl md:text-4xl font-bold text-[#2d3a2d] mt-3">Cookie Policy</h1>
            <p className="text-sm md:text-base text-[#6b7a6b] mt-3 max-w-2xl mx-auto">
              This page explains how cookies and similar technologies are used on{' '}
              {BUSINESS_INFO.brandName} (Legal Name: {BUSINESS_INFO.legalName}).
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
              <Settings className="w-5 h-5 text-[#3d7a3d] mt-0.5 flex-shrink-0" />
              <p className="text-sm text-[#4f5f4f] leading-relaxed">
                Adjust your browser cookie settings at any time to control tracking and stored
                preferences.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-[#3d7a3d] mt-0.5 flex-shrink-0" />
              <p className="text-sm text-[#4f5f4f] leading-relaxed">
                Essential cookies are required for core operations such as cart, login state, and
                secure checkout.
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

export default Cookies;
