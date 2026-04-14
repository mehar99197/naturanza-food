import { LazyLoadImage } from 'react-lazy-load-image-component';
import 'react-lazy-load-image-component/src/effects/blur.css';

export function OptimizedImage({ 
  src, 
  alt, 
  className = '', 
  wrapperClassName = '',
  width, 
  height,
  placeholder = '/images/products/powder.webp',
  effect = 'blur',
  threshold = 100,
  ...props
}) {
  // Fallback to placeholder if src is missing
  const imageSrc = src || placeholder;

  return (
    <LazyLoadImage
      src={imageSrc}
      alt={alt}
      effect={effect}
      className={className}
      wrapperClassName={wrapperClassName}
      width={width}
      height={height}
      placeholderSrc={placeholder}
      threshold={threshold}
      onError={(e) => {
        // Prevent infinite loop if placeholder also fails
        if (e.target.src !== placeholder && !e.target.dataset.fallbackApplied) {
          e.target.dataset.fallbackApplied = 'true';
          e.target.src = placeholder;
        }
      }}
      {...props}
    />
  );
}

// Prebuilt variant for product images
export function ProductImage({ 
  src, 
  alt, 
  size = 'medium',
  className = '',
  ...props 
}) {
  const sizes = {
    thumbnail: { width: 200, height: 200 },
    small: { width: 400, height: 400 },
    medium: { width: 800, height: 800 },
    large: { width: 1200, height: 1200 }
  };

  const dimensions = sizes[size] || sizes.medium;

  return (
    <OptimizedImage
      src={src}
      alt={alt}
      className={className}
      width={dimensions.width}
      height={dimensions.height}
      {...props}
    />
  );
}

// Background image with lazy loading
export function BackgroundImage({ 
  src, 
  alt = '', 
  className = '', 
  children,
  placeholder = '/images/hero-bg.jpg'
}) {
  return (
    <div className={`relative ${className}`}>
      <OptimizedImage
        src={src}
        alt={alt}
        className="absolute inset-0 w-full h-full object-cover"
        placeholder={placeholder}
      />
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
