import { useEffect, useState } from "react";

/**
 * Debounces a value: the returned value only catches up to `value` once the
 * caller has stopped changing it for `delay` milliseconds.
 *
 * Ported from frontend/src/hooks/useDebounce.js with identical timing — the
 * timer is re-armed whenever `value` or `delay` changes, so the pending update
 * is dropped rather than fired early.
 *
 * @param value Value to debounce.
 * @param delay Delay in milliseconds (default: 500ms).
 */
export function useDebounce<T>(value: T, delay = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

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
