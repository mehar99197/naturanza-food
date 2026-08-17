// Naturanza Food — branded orbiting-dots loader.
// Three brand-green dots orbit a center and pulse. Used project-wide:
//   <Loader />                         full-screen (default) — app boot, route guards, Suspense
//   <Loader fullScreen={false} />      inline section loader
//   <Loader fullScreen={false} label="Loading articles..." />
//
// Server Component: this renders static markup and a <style> block, with no
// hooks, no event handlers and no browser APIs, so it ships zero client JS.
// The animation is pure CSS and runs without React being involved at all.

export interface LoaderProps {
  fullScreen?: boolean;
  label?: string;
}

export function Loader({ fullScreen = true, label = '' }: LoaderProps) {
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

// Route-transition fallback.
//
// The full-screen <Loader /> is position:fixed, so it reserves NO layout height,
// and it fades in over 0.5s. A route change unmounts the previous page first,
// so <main> collapsed to almost nothing while an overlay that was still at
// opacity 0 failed to hide it — the footer rode up into the viewport for a few
// hundred milliseconds before the next page pushed it back down.
//
// This fallback is in-flow instead: it holds a FULL viewport height (the nav is
// fixed, so <main> starts at y=0 and anything less leaves the footer poking in
// at the bottom) so the footer
// physically cannot move up, and the spinner is delayed so a fast navigation
// shows nothing at all rather than a pointless flash.
//
// Under the App Router this is what a route-segment loading.tsx renders.
export function RouteFallback() {
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      aria-busy="true"
      aria-live="polite"
    >
      <style>{`
        @keyframes nz-fallback-in { to { opacity: 1; } }
        .nz-route-fallback {
          opacity: 0;
          animation: nz-fallback-in 0.2s ease-out 0.25s forwards;
        }
        @media (prefers-reduced-motion: reduce) {
          .nz-route-fallback { animation-delay: 0.25s; animation-duration: 0.01s; }
        }
      `}</style>
      <div className="nz-route-fallback">
        <Loader fullScreen={false} />
      </div>
    </div>
  );
}
