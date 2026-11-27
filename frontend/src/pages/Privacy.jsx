import { Link } from 'react-router-dom';
import { Lock, Eye, Database, Mail, Phone, MapPin } from 'lucide-react';
import { BUSINESS_INFO } from '@/config/legal';
import { PrivacySEO } from '@/components/SEO';
import { useSettings } from '@/context/SettingsContext';

const normalizePhoneLink = (value) => String(value || '').replace(/[^\d+]/g, '');

export function Privacy() {
  const { settings } = useSettings();
  const storeName = settings.storeName || BUSINESS_INFO.brandName;
  const officeAddress = settings.address || BUSINESS_INFO.officeAddress;
  const supportEmail = settings.storeEmail || BUSINESS_INFO.contacts.supportEmail;
  const supportPhone = settings.storePhone || BUSINESS_INFO.contacts.phone;
  const privacyEmail = settings.storeEmail || BUSINESS_INFO.contacts.privacyEmail;
  const phoneLink = normalizePhoneLink(supportPhone);

  const sections = [
    {
      title: 'Who We Are',
      content: `This Privacy Policy explains how ${storeName} (Legal Name: ${BUSINESS_INFO.legalName}), located at ${officeAddress}, collects, uses, and protects your personal information when you browse or place orders on ${BUSINESS_INFO.websiteUrl}.`,
    },
    {
      title: 'Information We Collect',
      content:
        'We collect information you provide during account registration, checkout, order fulfillment, and customer support inquiries — including your full name, email address, delivery address, city, and phone number. If you choose to sign in with Google, we receive your basic Google profile details (name and email address).',
    },
    {
      title: 'Payment Information & Third-Party Processing',
      content:
        'Online payments are processed securely through SafePay using encrypted payment channels. We do not collect, access, or store your debit/credit card numbers, CVV codes, or banking PINs on our servers. We only retain payment transaction references, amounts, and verification statuses required for order confirmation, invoicing, and refund processing.',
    },
    {
      title: 'How We Use & Share Your Information',
      content:
        'We use your data to process and deliver orders across Pakistan, verify payments via SafePay, communicate shipping and order updates, resolve support or return requests, prevent fraud, and comply with Pakistani legal and tax obligations. We share only the necessary delivery details with our courier partners and never sell or rent your personal data to third parties.',
    },
    {
      title: 'Data Retention & Security',
      content:
        'We apply technical and organizational security safeguards — including HTTPS/TLS encryption, hashed passwords, and restricted administrative access — to protect your personal data. Order and transaction records are retained for up to 24 months or as required under applicable tax and commercial regulations.',
    },
    {
      title: 'Your Privacy Rights & Cookies',
      content:
        'You may request access to, correction of, or deletion of your personal account information at any time by contacting our support team. Essential cookies and local storage are used to maintain login sessions, shopping cart contents, and wishlist preferences.',
    },
  ];

  return (
    <>
      <PrivacySEO />
      <main className="pt-24 pb-16 min-h-screen bg-[#faf8f3]">
        <div className="container-custom">
          <header className="text-center mb-10">
            <span className="inline-flex items-center gap-2 text-[#3d7a3d] font-semibold text-xs uppercase tracking-wider">
              <Lock className="w-4 h-4" />
              Privacy &amp; Data Protection
            </span>
            <h1 className="text-2xl md:text-4xl font-bold text-[#2d3a2d] mt-3">Privacy Policy</h1>
            <p className="text-sm md:text-base text-[#6b7a6b] mt-3 max-w-2xl mx-auto">
              Your privacy matters to us. Learn how {storeName} (Legal Name:{' '}
              {BUSINESS_INFO.legalName}) handles and protects your personal information.
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
              <Eye className="w-5 h-5 text-[#3d7a3d] mt-0.5 flex-shrink-0" />
              <p className="text-sm text-[#4f5f4f] leading-relaxed">
                We never sell your personal data. For data access, correction, or deletion requests,
                email{' '}
                <a href={`mailto:${privacyEmail}`} className="font-semibold text-[#2f6f2f] underline">
                  {privacyEmail}
                </a>
                .
              </p>
            </div>
            <div className="flex items-start gap-3">
              <Database className="w-5 h-5 text-[#3d7a3d] mt-0.5 flex-shrink-0" />
              <p className="text-sm text-[#4f5f4f] leading-relaxed">
                For more details on browser storage and site preferences, view our{' '}
                <Link to="/cookies" className="font-semibold text-[#2f6f2f] underline hover:text-[#1f4f1f]">
                  Cookie Policy
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

export default Privacy;
