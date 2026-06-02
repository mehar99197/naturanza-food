// Modern 3D Spinning Loader
export function Loader({ fullScreen = true, size = 'md' }) {
  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-light z-50 animate-fadeIn">
        <div className="animate-slideUp">
          <span className="loader drop-shadow-lg"></span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-4">
      <span className="loader"></span>
    </div>
  );
}

// Leaf Pulse — branded page/section loader for Naturanza Food
export function LeafLoader({ fullPage = false, label = '' }) {
  const inner = (
    <>
      <style>{`
        @keyframes nz-pulse-ring {
          0%   { transform: scale(0.6); opacity: 0.8; }
          60%  { transform: scale(1.3); opacity: 0;   }
          100% { transform: scale(0.6); opacity: 0;   }
        }
        @keyframes nz-pulse-ring2 {
          0%   { transform: scale(0.6); opacity: 0.5; }
          60%  { transform: scale(1.15); opacity: 0;  }
          100% { transform: scale(0.6); opacity: 0;   }
        }
        @keyframes nz-leaf-breathe {
          0%, 100% { transform: scale(1)    rotate(-4deg); }
          50%      { transform: scale(1.15) rotate(4deg);  }
        }
        .nz-ring1 { animation: nz-pulse-ring  1.8s ease-out infinite; }
        .nz-ring2 { animation: nz-pulse-ring2 1.8s ease-out 0.35s infinite; }
        .nz-leaf  { animation: nz-leaf-breathe 1.8s ease-in-out infinite; }
      `}</style>
      <div className="flex flex-col items-center gap-3">
        <div className="relative flex h-20 w-20 items-center justify-center">
          <span className="nz-ring1 absolute inset-0 rounded-full border-2 border-emerald-500/50" />
          <span className="nz-ring2 absolute inset-2 rounded-full border-2 border-emerald-400/40" />
          <span className="nz-leaf relative z-10 text-4xl select-none">🌿</span>
        </div>
        {label ? (
          <p className="text-sm font-medium text-emerald-700/75 tracking-wide">{label}</p>
        ) : (
          <p className="text-sm font-semibold text-emerald-800/60 tracking-wider">Naturanza</p>
        )}
      </div>
    </>
  );

  if (fullPage) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#faf8f3]">
        {inner}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center py-14">
      {inner}
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
