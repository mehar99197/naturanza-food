import { useEffect, useRef, useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { Loader2 } from 'lucide-react';

const GoogleBrandIcon = ({ className = 'h-4 w-4' }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
    <path
      fill="#4285F4"
      d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.45a5.51 5.51 0 0 1-2.39 3.61v3h3.86c2.26-2.08 3.57-5.15 3.57-8.64z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.92l-3.86-3A7.14 7.14 0 0 1 12 19.3a7.2 7.2 0 0 1-6.77-4.96H1.24v3.12A12 12 0 0 0 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.23 14.34A7.2 7.2 0 0 1 4.83 12c0-.81.14-1.59.4-2.34V6.54H1.24A12 12 0 0 0 0 12c0 1.93.46 3.76 1.24 5.46l3.99-3.12z"
    />
    <path
      fill="#EA4335"
      d="M12 4.77c1.76 0 3.33.6 4.57 1.78l3.43-3.43C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.24 6.54l3.99 3.12A7.2 7.2 0 0 1 12 4.77z"
    />
  </svg>
);

// Hover is expressed with group-hover rather than hover because the visual
// layer never receives the pointer itself — Google's iframe sits on top of it.
// CSS :hover still applies to the shared ancestor, so the styling stays live.
const iconButtonClassName =
  'mobile-icon-button-feel relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#d5e3d3] bg-white text-slate-600 shadow-sm transition-all duration-200 group-hover:border-[#bed2bc]';

const fullButtonClassName =
  'mobile-button-feel inline-flex w-full items-center justify-center gap-2.5 rounded-[11px] border border-[#d9e4d7] bg-[#f4f8f3] px-4 py-3 text-[0.92rem] font-medium text-[#2f3f35] transition-colors duration-200 group-hover:border-[#bfd3bd] group-hover:bg-[#ecf5ea]';

// Google renders its button inside a cross-origin <iframe> on
// accounts.google.com. Nothing in that iframe is reachable from this document,
// so a styled button of ours cannot forward a click into it — and a synthetic
// click would carry no user activation even if it could, which the sign-in
// popup requires. The only workable arrangement is to let the real Google
// button receive the pointer event: it is stretched over our styled button at
// zero opacity, so the user sees our design and Google sees a genuine click.
//
// Layout sizes are read with a ResizeObserver rather than hard-coded because
// Google picks the iframe's dimensions and revises them (locale, font loading,
// the FedCM variant). `offsetWidth`/`offsetHeight` and ResizeObserver's
// contentRect both report pre-transform layout size, so measuring the overlay
// while it is scaled does not feed its own scale back into the next frame.
const useLayoutSize = (ref) => {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return undefined;
    }

    const read = () => {
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      setSize((previous) =>
        previous.width === width && previous.height === height
          ? previous
          : { width, height },
      );
    };

    read();

    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new ResizeObserver(read);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return size;
};

// Google clamps the rendered button to 200-400px. Asking for a width near the
// slot we have keeps the overlay's scale factor close to 1, so Google's own hit
// target stays roughly the size the user sees.
const GSI_MIN_WIDTH = 200;
const GSI_MAX_WIDTH = 400;

const AuthSocialButtons = ({
  dividerLabel = 'Or continue with',
  isGoogleConfigured,
  onGoogleSuccess,
  onGoogleError,
  googleLoading,
  showDivider = true,
  align = 'center',
  className = '',
  variant = 'full',
  buttonLabel = 'Sign in with Google',
}) => {
  const hostRef = useRef(null);
  const overlayRef = useRef(null);
  const hostSize = useLayoutSize(hostRef);
  const overlaySize = useLayoutSize(overlayRef);

  const isIconVariant = variant === 'icon';
  const isInteractive = Boolean(isGoogleConfigured) && !googleLoading;

  const justifyClass =
    align === 'left' ? 'justify-start' : align === 'right' ? 'justify-end' : 'justify-center';

  const requestedWidth = isIconVariant
    ? undefined
    : Math.round(
        Math.min(GSI_MAX_WIDTH, Math.max(GSI_MIN_WIDTH, hostSize.width || GSI_MAX_WIDTH)),
      );

  const scaleX = hostSize.width && overlaySize.width ? hostSize.width / overlaySize.width : 1;
  const scaleY = hostSize.height && overlaySize.height ? hostSize.height / overlaySize.height : 1;

  const visualContent = googleLoading ? (
    <Loader2 className="h-4 w-4 animate-spin" />
  ) : (
    <GoogleBrandIcon className="h-[17px] w-[17px]" />
  );

  return (
    <div className={`relative ${className}`}>
      {showDivider ? (
        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#dbe4d9]" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-3 text-xs font-medium text-[#7a8f82]">{dividerLabel}</span>
          </div>
        </div>
      ) : null}

      <div className={`flex items-center ${justifyClass}`}>
        <div className={`group relative ${isIconVariant ? '' : 'w-full'}`} ref={hostRef}>
          {/* Presentation only. The real control is Google's iframe below, so
              this must not take focus or swallow the pointer event. */}
          <div
            aria-hidden="true"
            className={`${isIconVariant ? iconButtonClassName : fullButtonClassName} pointer-events-none ${
              isInteractive ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
            }`}
          >
            {visualContent}
            {isIconVariant ? null : (
              <span>{googleLoading ? 'Connecting Google...' : buttonLabel}</span>
            )}
          </div>

          {isInteractive ? (
            <div className="absolute inset-0 z-10 overflow-hidden opacity-0">
              <div
                ref={overlayRef}
                className="origin-top-left"
                style={{
                  transform: `scale(${scaleX}, ${scaleY})`,
                  width: requestedWidth ? `${requestedWidth}px` : 'max-content',
                }}
              >
                <GoogleLogin
                  onSuccess={onGoogleSuccess}
                  onError={onGoogleError}
                  theme="outline"
                  type={isIconVariant ? 'icon' : 'standard'}
                  size="large"
                  shape={isIconVariant ? 'circle' : 'rectangular'}
                  text="continue_with"
                  logo_alignment="left"
                  width={requestedWidth}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default AuthSocialButtons;
