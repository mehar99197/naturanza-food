import { useRef, useState } from 'react';

// Disabled for performance - all elements are immediately visible
export function useScrollReveal(options = {}) {
 const ref = useRef(null);
 const [isVisible] = useState(true); // Always true - no animations

 // No IntersectionObserver - instant visibility for performance
 
 return { ref, isVisible };
}
