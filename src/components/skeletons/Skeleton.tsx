import { Fragment } from 'react';
import type { CSSProperties } from 'react';

/**
 * A local, dependency-free stand-in for `react-loading-skeleton`.
 *
 * The Vite app gets the shimmer from the `react-loading-skeleton` package plus
 * its `dist/skeleton.css`. That package is a dependency of `frontend/`, not of
 * the Next app at the repo root, and adding it would mean editing the root
 * package.json — out of bounds for this migration. So the primitive lives here
 * instead, reproducing the upstream DOM exactly:
 *
 *   <span aria-live="polite" aria-busy="true">
 *     <span class="react-loading-skeleton" style="…">&zwnj;</span><br/>
 *     …one pair per `count`…
 *   </span>
 *
 * Same element names, same class name, same zero-width non-joiner, same inline
 * custom properties, and the CSS below is `react-loading-skeleton/dist/skeleton.css`
 * verbatim — so a skeleton renders pixel-for-pixel the way it does in the SPA.
 *
 * Not reproduced: `SkeletonTheme` (nothing in the app renders one, and it is the
 * only piece of the upstream component that needs React Context, which would have
 * forced a "use client" boundary), the `wrapper`/`inline`/`direction`/`duration`
 * options, and fractional `count` values. No call site uses any of them.
 */

const SKELETON_CSS = `
@keyframes react-loading-skeleton {
  100% {
    transform: translateX(100%);
  }
}

.react-loading-skeleton {
  --base-color: #ebebeb;
  --highlight-color: #f5f5f5;
  --animation-duration: 1.5s;
  --animation-direction: normal;
  --pseudo-element-display: block; /* Enable animation */

  background-color: var(--base-color);

  width: 100%;
  border-radius: 0.25rem;
  display: inline-flex;
  line-height: 1;

  position: relative;
  user-select: none;
  overflow: hidden;
}

.react-loading-skeleton::after {
  content: ' ';
  display: var(--pseudo-element-display);
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 100%;
  background-repeat: no-repeat;
  background-image: var(
    --custom-highlight-background,
    linear-gradient(
      90deg,
      var(--base-color) 0%,
      var(--highlight-color) 50%,
      var(--base-color) 100%
    )
  );
  transform: translateX(-100%);

  animation-name: react-loading-skeleton;
  animation-direction: var(--animation-direction);
  animation-duration: var(--animation-duration);
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
}

@media (prefers-reduced-motion) {
  .react-loading-skeleton {
    --pseudo-element-display: none; /* Disable animation */
  }
}
`;

/**
 * The stylesheet the shimmer needs, as a <style> element.
 *
 * Rendered once per skeleton screen rather than per skeleton bar. A <style> tag
 * is `display: none` per the UA stylesheet, so it generates no box and cannot
 * become a stray grid or flex item where a skeleton list is spread into a
 * container.
 */
export function SkeletonStyles() {
  return <style>{SKELETON_CSS}</style>;
}

/** CSSProperties widened to carry the two custom properties upstream sets inline. */
type SkeletonStyleProperties = CSSProperties & {
  '--base-color'?: string;
  '--highlight-color'?: string;
};

export interface SkeletonProps {
  count?: number;
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  circle?: boolean;
  baseColor?: string;
  highlightColor?: string;
}

export function Skeleton({
  count = 1,
  width,
  height,
  borderRadius,
  circle = false,
  baseColor,
  highlightColor,
}: SkeletonProps) {
  // Built in the upstream order so the emitted `style` attribute matches.
  const style: SkeletonStyleProperties = {};
  if (width !== undefined) style.width = width;
  if (height !== undefined) style.height = height;
  if (borderRadius !== undefined) style.borderRadius = borderRadius;
  if (circle) style.borderRadius = '50%';
  if (baseColor !== undefined) style['--base-color'] = baseColor;
  if (highlightColor !== undefined) style['--highlight-color'] = highlightColor;

  return (
    <span aria-live="polite" aria-busy={true}>
      {Array.from({ length: Math.ceil(count) }, (_, index) => (
        // Without the <br />, skeleton lines run together when `width` is set.
        <Fragment key={index}>
          <span className="react-loading-skeleton" style={style}>
            {'\u200C'}
          </span>
          <br />
        </Fragment>
      ))}
    </span>
  );
}

export default Skeleton;
