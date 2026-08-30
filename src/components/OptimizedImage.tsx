'use client';

// "use client" is required: this component owns load/error state and needs the
// <img> onLoad / onError handlers to drive the fade-in and the fallback swap.

import Image from 'next/image';
import type { ImageProps } from 'next/image';
import { useState } from 'react';

export interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  wrapperClassName?: string;
  imgClassName?: string;
  width?: number;
  height?: number;
  lazy?: boolean;
  priority?: boolean;
  /** Show the grey pulsing placeholder until the image has decoded. */
  placeholder?: boolean;
  /** A different image to try once, if `src` fails to load. */
  fallbackSrc?: string;
  /**
   * Overrides the `sizes` attribute derived from `width`. Purely additive — no
   * existing call site passes it — and it exists because a `fill` image with no
   * `sizes` makes Next assume 100vw and download a far larger file than a card
   * thumbnail needs.
   */
  sizes?: string;
  onLoad?: () => void;
  onError?: () => void;
}

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
  sizes,
  onLoad,
  onError,
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [useFallbackSource, setUseFallbackSource] = useState(false);

  // Reset when the caller points at a different image. Done during render rather
  // than in an effect so the new image never paints for one frame wearing the old
  // image's loaded/errored state — see React's "adjusting state on prop change".
  const [renderedForSrc, setRenderedForSrc] = useState(src);
  if (renderedForSrc !== src) {
    setRenderedForSrc(src);
    setIsLoaded(false);
    setHasError(false);
    setUseFallbackSource(false);
  }

  const primarySrc = src.trim();
  const secondarySrc = fallbackSrc.trim();
  // An empty `src` also routes to the fallback: next/image throws on a blank src,
  // where the old plain <img> merely fired an error event and landed here anyway.
  const activeSrc = useFallbackSource || !primarySrc ? secondarySrc : primarySrc;
  const showError = hasError || !activeSrc;

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    if (!useFallbackSource && secondarySrc && secondarySrc !== primarySrc) {
      setUseFallbackSource(true);
      setIsLoaded(false);
      return;
    }

    setHasError(true);
    onError?.();
  };

  const sizesAttr = sizes ?? (width ? `(max-width: ${width}px) 100vw, ${width}px` : undefined);
  const resolvedImgClassName = imgClassName && imgClassName.trim()
    ? imgClassName
    : 'object-cover object-center';

  // next/image needs either an intrinsic width+height pair or `fill`. Callers that
  // give neither get `fill`, which the wrapper's `relative` already supports.
  const hasIntrinsicSize = typeof width === 'number' && typeof height === 'number';
  const sizingProps: Pick<ImageProps, 'fill' | 'width' | 'height'> = hasIntrinsicSize
    ? { width, height }
    : { fill: true };

  return (
    <div
      className={`relative overflow-hidden ${className} ${wrapperClassName}`}
      style={{ aspectRatio: width && height ? `${width}/${height}` : undefined }}
    >
      {placeholder && !isLoaded && !showError && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
          </svg>
        </div>
      )}

      {!showError && (
        <Image
          {...sizingProps}
          src={activeSrc}
          alt={alt}
          sizes={sizesAttr}
          // `preload` is Next 16's replacement for the deprecated `priority`. It
          // and `loading="lazy"` throw if combined, hence the guard.
          preload={priority}
          loading={priority ? undefined : lazy ? 'lazy' : 'eager'}
          decoding={priority ? 'sync' : 'async'}
          onLoad={handleLoad}
          onError={handleError}
          className={`w-full h-full transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          } ${resolvedImgClassName}`}
        />
      )}

      {showError && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
          <span className="text-gray-400 text-sm">Image unavailable</span>
        </div>
      )}
    </div>
  );
}

export function LazyImage({ src, alt, ...props }: OptimizedImageProps) {
  return <OptimizedImage src={src} alt={alt} lazy={true} {...props} />;
}

export function PriorityImage({ src, alt, ...props }: OptimizedImageProps) {
  return <OptimizedImage src={src} alt={alt} lazy={false} priority={true} placeholder={false} {...props} />;
}

export default OptimizedImage;
