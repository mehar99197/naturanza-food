import { clsx } from"clsx"
import { twMerge } from"tailwind-merge"

export function cn(...inputs) {
 return twMerge(clsx(inputs))
}

// Currency formatting utility
export function formatPrice(amount, currency = 'PKR') {
 if (amount === null || amount === undefined) return '';
 
 const currencySymbols = {
 'USD': '$',
 'PKR': 'Rs.',
 'EUR': '€',
 'GBP': '£',
 'INR': '₹'
 };

 const symbol = currencySymbols[currency] || currency;
 
 // For PKR and INR, use whole numbers with commas
 if (currency === 'PKR' || currency === 'INR') {
 return `${symbol} ${Math.round(amount).toLocaleString()}`;
 }
 
 // For USD, EUR, GBP, use 2 decimal places
 return `${symbol}${parseFloat(amount).toFixed(2)}`;
}
