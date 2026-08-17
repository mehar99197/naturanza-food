/**
 * Shared Framer Motion variants, ported from frontend/src/lib/animations.js.
 *
 * Every value is byte-for-byte the original. What is new is the typing: these
 * were untyped object literals, and `ease: "easeOut"` widens to `string`
 * without help, which then fails to satisfy Framer's `Easing` union at the use
 * site. The interfaces below give the literals somewhere to be checked.
 *
 * They are deliberately *structural stand-ins* rather than re-exports of
 * Framer's own types: `framer-motion` is a dependency of the Vite app only and
 * is not installed at the Next root, so importing from it here would not
 * compile. They are a strict subset of Framer's shapes, so these objects stay
 * assignable to `Variants`/`MotionProps` once it is added — swap the aliases
 * for the real imports then, and nothing below needs to change.
 */

/** Named easing curves, matching Framer's string easings. */
export type Easing =
  | "linear"
  | "easeIn"
  | "easeOut"
  | "easeInOut"
  | "circIn"
  | "circOut"
  | "circInOut"
  | "backIn"
  | "backOut"
  | "backInOut"
  | "anticipate";

export type TransitionType = "spring" | "tween" | "keyframes" | "inertia";

export type RepeatType = "loop" | "reverse" | "mirror";

export interface Transition {
  duration?: number;
  delay?: number;
  ease?: Easing;
  type?: TransitionType;
  stiffness?: number;
  damping?: number;
  mass?: number;
  repeat?: number;
  repeatType?: RepeatType;
  repeatDelay?: number;
  /** Seconds between each child's animation, on a parent variant. */
  staggerChildren?: number;
  /** Seconds to wait before the first child animates. */
  delayChildren?: number;
}

/** One animation target. An array value is a keyframe sequence. */
export interface AnimationTarget {
  opacity?: number | number[];
  x?: number | string | Array<number | string>;
  y?: number | string | Array<number | string>;
  scale?: number | number[];
  rotate?: number | string | Array<number | string>;
  backgroundPosition?: string | string[];
  transition?: Transition;
}

/** A named set of targets, driven by `variants` + `initial`/`animate`. */
export type Variants = Record<string, AnimationTarget>;

/** Motion props meant to be spread onto an element, not used as variants. */
export interface MotionAnimationProps {
  initial?: AnimationTarget;
  animate?: AnimationTarget;
  exit?: AnimationTarget;
  whileHover?: AnimationTarget;
  whileTap?: AnimationTarget;
  transition?: Transition;
}

// Fade in animation
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

// Slide up animation
export const slideUp: Variants = {
  hidden: { opacity: 0, y: 50 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

// Slide down animation
export const slideDown: Variants = {
  hidden: { opacity: 0, y: -30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

// Scale in animation
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

/**
 * Stagger container - animates children with delay.
 *
 * Only meaningful on a parent whose children also declare variants using the
 * same "hidden"/"visible" names; the timing is inherited, not applied here.
 */
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

/** Page transition props. Spread onto the element — not a variants map. */
export const pageTransition: MotionAnimationProps = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 },
  transition: { duration: 0.3, ease: "easeInOut" },
};

/**
 * Card hover animation.
 *
 * Note the transition mixes `type: "spring"` with `duration`/`ease`, which are
 * tween settings — Framer resolves the spring and the ease is inert. Preserved
 * as written rather than cleaned up, so the two apps animate identically.
 */
export const cardHover: Variants = {
  rest: { scale: 1, y: 0 },
  hover: {
    scale: 1.02,
    y: -5,
    transition: {
      duration: 0.3,
      ease: "easeInOut",
      type: "spring",
      stiffness: 300,
    },
  },
};

/** Button tap props. Spread onto the element — not a variants map. */
export const buttonTap: MotionAnimationProps = {
  whileTap: { scale: 0.95 },
};

// Slide from left
export const slideFromLeft: Variants = {
  hidden: { opacity: 0, x: -50 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

// Slide from right
export const slideFromRight: Variants = {
  hidden: { opacity: 0, x: 50 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

/** Pop in animation. Mixes spring and tween settings, same as `cardHover`. */
export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.5 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.5,
      ease: "easeOut",
      type: "spring",
      stiffness: 200,
    },
  },
};

// Rotate in animation
export const rotateIn: Variants = {
  hidden: { opacity: 0, rotate: -10 },
  visible: {
    opacity: 1,
    rotate: 0,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

/**
 * Bounce animation.
 *
 * ⚠ Runs forever (`repeat: Infinity`). An indefinite animation keeps the
 * compositor busy and ignores prefers-reduced-motion unless the caller gates
 * it. Preserved, but gate it at the use site.
 */
export const bounce: Variants = {
  animate: {
    y: [0, -10, 0],
    transition: {
      duration: 0.6,
      repeat: Infinity,
      repeatType: "reverse",
    },
  },
};

/** Pulse animation. Runs forever — same caveat as `bounce`. */
export const pulse: Variants = {
  animate: {
    scale: [1, 1.05, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      repeatType: "reverse",
    },
  },
};

/**
 * Shimmer effect for loading. Runs forever — same caveat as `bounce`.
 *
 * Needs a gradient `background-image` and a background-size wider than the
 * element for the position sweep to be visible; the CSS lives at the use site.
 */
export const shimmer: Variants = {
  animate: {
    backgroundPosition: ["200% 0", "-200% 0"],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "linear",
    },
  },
};
