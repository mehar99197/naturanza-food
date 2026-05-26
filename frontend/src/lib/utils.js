import { clsx } from"clsx"
import { twMerge } from"tailwind-merge"
import { convertFromPkr, hasExchangeRate } from"@/lib/exchangeRates"

export function cn(...inputs) {
 return twMerge(clsx(inputs))
}

// Currency formatting utility
const currencySymbols = {
 'USD': '$',
 'PKR': 'Rs.',
 'EUR': '€',
 'GBP': '£',
 'INR': '₹',
 'AED': 'د.إ',
 'SAR': '﷼',
 'CAD': 'C$',
 'AUD': 'A$',
 'JPY': '¥',
 'CNY': '¥',
 'BDT': '৳',
 'MYR': 'RM',
 'SGD': 'S$',
 'THB': '฿'
};

const normalizeCurrencyCode = (value) =>
 String(value || '').trim().toUpperCase() || 'PKR';

export function formatCurrency(amount, currency = 'PKR') {
 if (amount === null || amount === undefined) return '';

 const normalizedCurrency = normalizeCurrencyCode(currency);
 const symbol = currencySymbols[normalizedCurrency] || normalizedCurrency;
 const numericAmount = Number(amount);
 if (!Number.isFinite(numericAmount)) return '';

  // For these currencies, use whole numbers (no decimals)
  const wholeCurrencies = ['PKR', 'INR', 'JPY', 'BDT', 'THB'];
  if (wholeCurrencies.includes(normalizedCurrency)) {
  return `${symbol} ${Math.round(numericAmount).toLocaleString()}`;
  }

  // For others (USD, EUR, GBP, etc.), use 2 decimal places
  return `${symbol}${numericAmount.toFixed(2)}`;
}

export function formatPrice(amount, currency = 'PKR') {
 if (amount === null || amount === undefined) return '';

 const normalizedCurrency = normalizeCurrencyCode(currency);
 const numericAmount = Number(amount);
 if (!Number.isFinite(numericAmount)) return '';

 if (normalizedCurrency === 'PKR') {
 return formatCurrency(numericAmount, normalizedCurrency);
 }

 if (hasExchangeRate(normalizedCurrency)) {
 const convertedAmount = convertFromPkr(numericAmount, normalizedCurrency);
 return formatCurrency(convertedAmount ?? numericAmount, normalizedCurrency);
 }

 return formatCurrency(numericAmount, 'PKR');
}
