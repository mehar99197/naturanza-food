/**
 * The slices of provider state the site chrome actually consumes.
 *
 * These are deliberately *structural* and deliberately narrow. The real shapes
 * live in @/providers, which is being written in parallel; annotating the
 * destructured value against a local interface means this module compiles
 * against the contract it depends on rather than against `any`, and the day the
 * providers land any drift shows up as a type error here instead of as a
 * runtime `undefined` in the header.
 *
 * Every field the chrome reads is optional and nullable because the API shapes
 * are inconsistent by history — `profile_image`, `profileImage` and `avatar` all
 * appear on the same user object depending on which endpoint produced it.
 */

/** The user fields the header renders: avatar, initial, name and email. */
export interface NavigationUser {
  id?: string | number | null;
  name?: string | null;
  email?: string | null;
  /** Snake_case spelling from the REST API. */
  profile_image?: string | null;
  /** CamelCase spelling from the auth cache. */
  profileImage?: string | null;
  /** Third spelling, from OAuth sign-ins. */
  avatar?: string | null;
}

export interface NavigationAuth {
  user: NavigationUser | null;
  /** True while the session is being restored; the chrome shows a skeleton. */
  loading: boolean;
  logout: () => void | Promise<void>;
}

export interface NavigationCart {
  totalItems: number;
  setIsCartOpen: (open: boolean) => void;
}

export interface NavigationWishlist {
  totalItems: number;
}

/** Position and visibility of the sliding underline beneath the desktop links. */
export interface NavIndicatorState {
  left: number;
  width: number;
  opacity: number;
}
