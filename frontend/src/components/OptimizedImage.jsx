import { useState, useEffect, useRef } from 'react';

export function OptimizedImage({
  src,
  alt,
  className = '',
  wrapperClassName = '',
  imgClassName = '',
  width,
  height,
  lazy = true,
  priority = false,
  placeholder = true,
  fallbackSrc = '',
  onLoad,
  onError
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(!lazy || priority);
  const [hasError, setHasError] = useState(false);
  const [useFallbackSource, setUseFallbackSource] = useState(false);
  const imgRef = useRef(null);

  const safeSrc = typeof src === 'string' ? src.trim() : '';
  const safeFallback = typeof fallbackSrc === 'string' ? fallbackSrc.trim() : '';
  const renderedSrc = useFallbackSource ? safeFallback : (safeSrc || safeFallback);

  useEffect(() => {
    setIsLoaded(false);
    setHasError(!safeSrc && !safeFallback);
    setUseFallbackSource(false);
  }, [safeSrc, safeFallback]);

  useEffect(() => {
    if (!lazy || priority) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '50px',
        threshold: 0.1
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [lazy, priority]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    if (safeFallback && !useFallbackSource && safeFallback !== safeSrc) {
      setUseFallbackSource(true);
      setIsLoaded(false);
      return;
    }

    setHasError(true);
    onError?.();
  };

  const sizesAttr = width ? `(max-width: ${width}px) 100vw, ${width}px` : undefined;
  const resolvedImgClassName = imgClassName && imgClassName.trim()
    ? imgClassName
    : 'object-cover object-center';

  return (
    <div
      ref={imgRef}
      className={`relative overflow-hidden ${className} ${wrapperClassName}`}
      style={{ aspectRatio: width && height ? `${width}/${height}` : undefined }}
    >
      {placeholder && !isLoaded && !hasError && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
          </svg>
        </div>
      )}

      {isInView && !hasError && renderedSrc && (
        <img
          src={renderedSrc}
          alt={alt}
          width={width}
          height={height}
          sizes={sizesAttr}
          loading={priority ? 'eager' : 'lazy'}
          decoding={priority ? 'sync' : 'async'}
          onLoad={handleLoad}
          onError={handleError}
          className={`w-full h-full transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          } ${resolvedImgClassName}`}
        />
      )}

      {hasError && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
          <span className="text-gray-400 text-sm">Image unavailable</span>
        </div>
      )}
    </div>
  );
}

export function LazyImage({ src, alt, ...props }) {
  return <OptimizedImage src={src} alt={alt} lazy={true} {...props} />;
}

export function PriorityImage({ src, alt, ...props }) {
  return <OptimizedImage src={src} alt={alt} lazy={false} priority={true} placeholder={false} {...props} />;
}

export default OptimizedImage;