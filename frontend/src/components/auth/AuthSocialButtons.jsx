import { useRef } from 'react';
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

const iconButtonClassName =
  'mobile-icon-button-feel relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#d5e3d3] bg-white text-slate-600 shadow-sm transition-all duration-200 hover:border-[#bed2bc] disabled:cursor-not-allowed disabled:opacity-60';

const fullButtonClassName =
  'mobile-button-feel inline-flex w-full items-center justify-center gap-2.5 rounded-[11px] border border-[#d9e4d7] bg-[#f4f8f3] px-4 py-3 text-[0.92rem] font-medium text-[#2f3f35] transition-colors duration-200 hover:border-[#bfd3bd] hover:bg-[#ecf5ea] disabled:cursor-not-allowed disabled:opacity-70';

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
  const googleButtonRef = useRef(null);
  const isIconVariant = variant === 'icon';

  const justifyClass =
    align === 'left' ? 'justify-start' : align === 'right' ? 'justify-end' : 'justify-center';

  const triggerGoogleSignIn = () => {
    if (!isGoogleConfigured || googleLoading) {
      return;
    }

    const button = googleButtonRef.current?.querySelector('div[role="button"]');
    if (button instanceof HTMLElement) {
      button.click();
      return;
    }

    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        const retryButton = googleButtonRef.current?.querySelector('div[role="button"]');
        if (retryButton instanceof HTMLElement) {
          retryButton.click();
        }
      }, 100);
    }
  };

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
        {isIconVariant ? (
          <button
            type="button"
            onClick={triggerGoogleSignIn}
            disabled={!isGoogleConfigured || googleLoading}
            className={iconButtonClassName}
            aria-label={isGoogleConfigured ? 'Continue with Google' : 'Google sign-in unavailable'}
          >
            {googleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <GoogleBrandIcon className="h-[17px] w-[17px]" />
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={triggerGoogleSignIn}
            disabled={!isGoogleConfigured || googleLoading}
            className={fullButtonClassName}
          >
            {googleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <GoogleBrandIcon className="h-[17px] w-[17px]" />
            )}
            <span>{googleLoading ? 'Connecting Google...' : buttonLabel}</span>
          </button>
        )}
      </div>

      {isGoogleConfigured ? (
        <div ref={googleButtonRef} aria-hidden="true" className="absolute -left-[9999px] top-0 h-0 w-0 overflow-hidden opacity-0">
          <GoogleLogin
            onSuccess={onGoogleSuccess}
            onError={onGoogleError}
            theme="outline"
            type="icon"
            size="large"
            shape="circle"
          />
        </div>
      ) : null}
    </div>
  );
};

export default AuthSocialButtons;
