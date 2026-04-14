import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Leaf } from 'lucide-react';

const quickLinks = [
  { to: '/terms', label: 'Terms' },
  { to: '/privacy', label: 'Privacy' },
  { to: '/faq', label: 'FAQs' },
  { to: '/contact', label: 'Support' },
];

const AuthLayout = ({
  leftTitle,
  leftDescription,
  leftPoints,
  children,
  footerNote,
  hideLeftPanel = false,
  compact = false,
  hideBottomLinks = false,
  contentWidthClass,
}) => {
  const mainWidthClass = hideLeftPanel ? 'max-w-[520px]' : 'max-w-[640px]';
  const resolvedWidthClass = contentWidthClass || mainWidthClass;
  const cardClass = compact
    ? 'rounded-[24px] border border-[#dce8db] bg-white p-5 shadow-[0_20px_60px_rgba(13,53,30,0.14)] sm:p-6'
    : 'rounded-[26px] border border-[#dce8db] bg-white p-6 shadow-[0_22px_70px_rgba(13,53,30,0.16)] sm:p-8 lg:p-9';

  return (
    <div className="auth-premium-font relative min-h-screen overflow-hidden bg-[#edf3ea]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_12%,rgba(5,150,105,0.16),transparent_38%),radial-gradient(circle_at_90%_88%,rgba(34,197,94,0.13),transparent_36%)]" />

      <div className={`relative grid min-h-screen ${hideLeftPanel ? 'grid-cols-1' : 'lg:grid-cols-[42%_58%]'}`}>
        {!hideLeftPanel ? (
          <aside className="relative hidden overflow-hidden bg-gradient-to-b from-emerald-800 to-emerald-950 lg:flex lg:flex-col lg:justify-center lg:px-12 xl:px-16">
          <Leaf className="pointer-events-none absolute left-10 top-16 h-24 w-24 text-white/10" />
          <Leaf className="pointer-events-none absolute bottom-14 right-12 h-20 w-20 rotate-[20deg] text-white/10" />

          <img
            src="/images/logo.png"
            alt="Naturanza Food"
            className="h-12 w-auto object-contain brightness-0 invert"
          />

          <h2 className="mt-12 max-w-xl text-5xl font-bold leading-[1.04] tracking-[-0.03em] text-[#f3fbf6]">
            {leftTitle}
          </h2>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-emerald-100/90">{leftDescription}</p>

          <ul className="mt-10 space-y-4">
            {leftPoints.map((point) => (
              <li key={point} className="flex items-center gap-3.5 text-emerald-50">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/12 ring-1 ring-white/25">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <span className="text-base font-medium">{point}</span>
              </li>
            ))}
          </ul>
          </aside>
        ) : null}

        <main
          className={`flex items-center justify-center ${
            hideLeftPanel ? 'px-4 py-4 sm:px-6' : 'px-4 py-8 sm:px-8 lg:px-12'
          }`}
        >
          <div className={`w-full ${resolvedWidthClass}`}>
            <div className={`flex items-center justify-between ${compact ? 'mb-3' : 'mb-4'}`}>
              <Link
                to="/"
                aria-label="Back to home"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#d0dfcf] bg-white text-[#166534] shadow-sm transition-colors duration-200 hover:border-[#b8cfb8]"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>

              <span className="rounded-full border border-[#d4e3d4] bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4f6558]">
                Secure Access
              </span>
            </div>

            <div className={cardClass}>
              {children}
            </div>

            {footerNote ? (
              <p className="mt-4 text-center text-xs font-medium text-[#5a7063]">{footerNote}</p>
            ) : null}

            {!hideBottomLinks ? (
              <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-[#5b7164]">
                {quickLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className="font-semibold transition-colors duration-200 hover:text-[#166534]"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AuthLayout;
