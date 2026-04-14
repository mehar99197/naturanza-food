const baseInputClassName =
  'mobile-input-feel w-full rounded-[12px] border bg-[#f4f7f2] px-4 py-3.5 text-[0.95rem] text-[#29362e] placeholder:text-[#9ca9a0] outline-none transition-all duration-200 focus:border-[#15803d] focus:bg-white focus:ring-2 focus:ring-[#15803d]/20';

const AuthTextField = ({
  label,
  error,
  registration,
  className = '',
  ...inputProps
}) => {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[#3e5146]">{label}</span>
      <input
        {...registration}
        {...inputProps}
        className={`${baseInputClassName} ${
          error ? 'border-red-300 bg-red-50/70 focus:border-red-400 focus:ring-red-200/70' : 'border-[#dbe4d8]'
        } ${className}`}
      />
      {error ? <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p> : null}
    </label>
  );
};

export default AuthTextField;
