// Naturanza Food — branded orbiting-dots loader.
// Three brand-green dots orbit a center and pulse. Used project-wide:
//   <Loader />                         full-screen (default) — app boot, route guards, Suspense
//   <Loader fullScreen={false} />      inline section loader
//   <Loader fullScreen={false} label="Loading articles..." />
export function Loader({ fullScreen = true, label = '' }) {
  const inner = (
    <>
      <style>{`
        @keyframes nz-orbit-rot { to { transform: rotate(360deg); } }
        @keyframes nz-orbit-fade {
          0%, 100% { opacity: 0.3; scale: 0.7; }
          50%      { opacity: 1;   scale: 1.2; }
        }
        .nz-orbit {
          position: relative; width: 80px; height: 80px;
          animation: nz-orbit-rot 1.4s linear infinite;
        }
        .nz-orbit-dot {
          position: absolute; width: 14px; height: 14px; border-radius: 50%;
          top: 50%; left: 50%; margin: -7px;
        }
        .nz-orbit-dot:nth-child(1) { background: #166534; transform: rotate(0deg)   translateX(33px); animation: nz-orbit-fade 1.4s ease-in-out infinite; }
        .nz-orbit-dot:nth-child(2) { background: #22c55e; transform: rotate(120deg) translateX(33px); animation: nz-orbit-fade 1.4s ease-in-out 0.46s infinite; }
        .nz-orbit-dot:nth-child(3) { background: #86efac; transform: rotate(240deg) translateX(33px); animation: nz-orbit-fade 1.4s ease-in-out 0.93s infinite; }
        @media (prefers-reduced-motion: reduce) {
          .nz-orbit { animation-duration: 3s; }
          .nz-orbit-dot { animation: none; }
        }
      `}</style>
      <div className="flex flex-col items-center gap-4">
        <div className="nz-orbit">
          <span className="nz-orbit-dot" />
          <span className="nz-orbit-dot" />
          <span className="nz-orbit-dot" />
        </div>
        {label ? (
          <p className="text-sm font-medium text-emerald-700/75 tracking-wide">{label}</p>
        ) : (
          <p className="text-sm font-semibold text-emerald-800/60 tracking-wider">Naturanza</p>
        )}
      </div>
    </>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[#faf8f3] animate-fadeIn">
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
