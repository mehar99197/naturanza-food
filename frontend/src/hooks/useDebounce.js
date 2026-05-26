import { useState, useEffect } from 'react';

/**
 * Custom hook that debounces a value
 * @param {any} value - The value to debounce
 * @param {number} delay - Delay in milliseconds (default: 500ms)
 * @returns {any} The debounced value
 */
export function useDebounce(value, delay = 500) {
 const [debouncedValue, setDebouncedValue] = useState(value);

 useEffect(() => {
 // Set up a timer to update the debounced value after the delay
 const timer = setTimeout(() => {
 setDebouncedValue(value);
 }, delay);

 // Clean up the timer if value changes before delay completes
 return () => {
 clearTimeout(timer);
 };
 }, [value, delay]);

 return debouncedValue;
}
