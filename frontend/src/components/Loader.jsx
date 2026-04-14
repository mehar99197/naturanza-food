// Modern 3D Spinning Loader
export function Loader({ fullScreen = true, size = 'md' }) {
  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-light z-50 animate-fadeIn">
        <div className="animate-slideUp">
          {/* 3D Spinning Loader - No Text */}
          <span className="loader drop-shadow-lg"></span>
        </div>
      </div>
    );
  }

  // Inline loader
  return (
    <div className="flex items-center justify-center p-4">
      <span className="loader"></span>
    </div>
  );
}

// Simple spinner
export function Spinner({ className = '' }) {
  return (
    <div className={`inline-block ${className}`}>
      <div className="w-8 h-8 border-4 border-gray-200 border-t-green-600 rounded-full"></div>
    </div>
  );
}

// Skeleton loader
export function SkeletonLoader({ className = '' }) {
  return <div className={`bg-gray-200 rounded-lg ${className}`}></div>;
}
