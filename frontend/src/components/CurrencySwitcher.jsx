import { useState, useRef, useEffect } from 'react';
import { useSettings } from '@/context/SettingsContext';

const CURRENCIES = [
  { code: 'PKR', label: 'PKR', name: 'Pakistani Rupee' },
  { code: 'USD', label: 'USD', name: 'US Dollar' },
  { code: 'EUR', label: 'EUR', name: 'Euro' },
  { code: 'GBP', label: 'GBP', name: 'British Pound' },
  { code: 'INR', label: 'INR', name: 'Indian Rupee' },
  { code: 'AED', label: 'AED', name: 'UAE Dirham' },
  { code: 'SAR', label: 'SAR', name: 'Saudi Riyal' },
  { code: 'CAD', label: 'CAD', name: 'Canadian Dollar' },
  { code: 'AUD', label: 'AUD', name: 'Australian Dollar' },
  { code: 'JPY', label: 'JPY', name: 'Japanese Yen' },
  { code: 'CNY', label: 'CNY', name: 'Chinese Yuan' },
  { code: 'BDT', label: 'BDT', name: 'Bangladeshi Taka' },
  { code: 'MYR', label: 'MYR', name: 'Malaysian Ringgit' },
  { code: 'SGD', label: 'SGD', name: 'Singapore Dollar' },
  { code: 'THB', label: 'THB', name: 'Thai Baht' },
];

export function CurrencySwitcher() {
  const { settings, setUserCurrency } = useSettings();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const current = CURRENCIES.find((c) => c.code === settings.currency) || CURRENCIES[0];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
      >
        <span className="font-semibold">{current.code}</span>
        <svg className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 w-44 bg-white rounded-xl shadow-2xl border border-gray-100 py-1.5 max-h-60 overflow-y-auto z-50">
          {CURRENCIES.map((cur) => (
            <button
              key={cur.code}
              onClick={() => {
                setUserCurrency(cur.code);
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2 text-xs transition-colors ${
                cur.code === current.code
                  ? 'bg-emerald-50 text-emerald-700 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="font-medium">{cur.code}</span>
              <span className="text-gray-400">{cur.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
