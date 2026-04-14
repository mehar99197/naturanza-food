import { Loader2 } from 'lucide-react';

const AuthSubmitButton = ({
  children,
  loading,
  loadingText,
  disabled,
  className = '',
  ...buttonProps
}) => {
  const isDisabled = disabled || loading;

  return (
    <button
      type="submit"
      disabled={isDisabled}
      className={`mobile-button-feel inline-flex w-full items-center justify-center gap-2 rounded-[11px] border border-[#178a49] bg-gradient-to-r from-[#25b561] via-[#20a657] to-[#1b8e4b] px-4 py-3 text-[0.95rem] font-semibold text-white shadow-[0_14px_30px_rgba(30,129,69,0.3)] transition-all duration-200 hover:from-[#21a357] hover:via-[#1d954f] hover:to-[#187e44] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1ca458]/32 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-65 ${className}`}
      {...buttonProps}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{loadingText}</span>
        </>
      ) : (
        <span>{children}</span>
      )}
    </button>
  );
};

export default AuthSubmitButton;
