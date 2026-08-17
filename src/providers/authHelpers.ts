/**
 * Pure helpers and types behind AuthProvider, ported from
 * `frontend/src/context/AuthContext.jsx`.
 *
 * Nothing in here touches React or holds state, so it is safe to import from a
 * Server Component. It is *also* free of `window` and `localStorage` at module
 * scope — see the note on {@link normalizeProfileImageUrl}, which is where the
 * original reached for `window.location` while the module was being evaluated.
 */

import { getApiBaseUrl as getAssetOrigin } from "@/lib/imageUtils";
import { safeLocalStorage } from "@/lib/storage";

import { asText } from "./apiErrors";

/**
 * The user record as the storefront holds it.
 *
 * Declared fields are the ones the provider and the ported pages actually read;
 * the index signature carries every other column `/auth/profile` returns
 * through untouched, which is what the source's object spreads did.
 */
export interface AuthUser {
  id?: string | number;
  email?: string;
  name?: string;
  role?: string;
  profile_image?: string | null;
  profileImage?: string | null;
  avatar?: string | null;
  password_set_by_user?: boolean;
  signup_provider?: string;
  [key: string]: unknown;
}

/** The fields the provider reads off an `/auth/*` response body. */
export interface AuthResponseBody {
  accessToken?: string | null;
  token?: string | null;
  requiresVerification?: boolean;
  email?: string;
  error?: string;
  message?: string;
  code?: string;
  user?: unknown;
  profile?: unknown;
}

/** What every auth action resolves to. Matches the source's return objects. */
export interface AuthActionResult {
  success: boolean;
  message?: string;
  /** Server error discriminator, e.g. `PASSWORD_REQUIRED`. */
  code?: string;
  requiresVerification?: boolean;
  email?: string;
  isAdmin?: boolean;
  redirect?: string | null;
  retryAfterSeconds?: number;
  user?: AuthUser | null;
}

export interface RegisterPayload {
  email: string;
  name?: string;
  password?: string;
  [key: string]: unknown;
}

export type ProfileUpdates = Record<string, unknown>;

/** localStorage key holding the last known user. Unchanged from the Vite app. */
export const USER_DATA_STORAGE_KEY = "userData";

/** localStorage key holding the resolved avatar URL. Unchanged. */
export const PROFILE_IMAGE_STORAGE_KEY = "profileImage";

/** 401 and 403 are the two statuses that mean "this session is over". */
export const isAuthFailureStatus = (statusCode: number): boolean =>
  statusCode === 401 || statusCode === 403;

/** `payload?.user || payload?.profile || payload`, narrowed. */
export const resolveUserFromPayload = (payload: unknown): unknown => {
  if (!payload || typeof payload !== "object") {
    return payload;
  }
  const record = payload as Record<string, unknown>;
  if (record.user) return record.user;
  if (record.profile) return record.profile;
  return payload;
};

/**
 * Turns whatever the API stored for an avatar into a loadable URL.
 *
 * The shaping rules are unchanged. The origin is not: the Vite app resolved
 * `VITE_API_URL` (or `window.location` + `VITE_API_PORT`) *at module load* and
 * stripped the `/api` suffix. That would crash server rendering, and caching a
 * server-side fallback would leave the browser pointing at localhost. Next
 * serves pages and `/images` from one Express origin, so the ported
 * `getApiBaseUrl` in @/lib/imageUtils returns "" and these become root-relative
 * paths — identical in the browser, and stable across server and client, so the
 * markup hydrates cleanly. It reads only `process.env`, never `window`, which
 * is why it can be called during render.
 */
export const normalizeProfileImageUrl = (imageUrl: unknown): string | null => {
  if (!imageUrl || typeof imageUrl !== "string") {
    return null;
  }

  const normalizedPath = imageUrl.trim().replace(/\\/g, "/");

  if (
    normalizedPath.startsWith("data:") ||
    normalizedPath.startsWith("blob:") ||
    /^https?:\/\//i.test(normalizedPath)
  ) {
    return normalizedPath;
  }

  const origin = getAssetOrigin();

  if (normalizedPath.startsWith("/")) {
    return `${origin}${normalizedPath}`;
  }

  if (/^(images|uploads)\//i.test(normalizedPath)) {
    return `${origin}/${normalizedPath}`;
  }

  return normalizedPath;
};

/** A payload only counts as a user if it carries an id, an email or a name. */
export const isValidUserObject = (
  candidate: unknown,
): candidate is Record<string, unknown> => {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return false;
  }

  const record = candidate as Record<string, unknown>;

  return (
    Object.prototype.hasOwnProperty.call(record, "id") ||
    typeof record.email === "string" ||
    typeof record.name === "string"
  );
};

/**
 * Normalises an API user payload, or returns null if it isn't one.
 *
 * Built as a plain record and cast once on the way out: the input is untyped
 * JSON whose `password_set_by_user` arrives as MySQL's 0/1 and whose avatar
 * lives under three different keys, so the conversion *is* the boundary. One
 * documented cast at the boundary beats loosening `AuthUser` for every reader.
 */
export const normalizeUserObject = (candidate: unknown): AuthUser | null => {
  if (!isValidUserObject(candidate)) {
    return null;
  }

  const normalized: Record<string, unknown> = { ...candidate };
  const profileImage = normalizeProfileImageUrl(
    normalized.profile_image || normalized.profileImage || normalized.avatar || null,
  );

  if (Object.prototype.hasOwnProperty.call(normalized, "password_set_by_user")) {
    normalized.password_set_by_user = Boolean(
      Number(normalized.password_set_by_user),
    );
  }

  if (normalized.signup_provider) {
    normalized.signup_provider = asText(normalized.signup_provider)
      .trim()
      .toLowerCase();
  }

  if (profileImage) {
    normalized.profile_image = profileImage;
    normalized.profileImage = profileImage;
    normalized.avatar = normalized.avatar || profileImage;
  }

  return normalized as AuthUser;
};

/**
 * Reads the cached user out of localStorage, dropping it if it won't parse.
 *
 * SSR: `safeLocalStorage` returns null when there is no `window`, so this is
 * safe to call anywhere — but the provider still only calls it from an effect,
 * because a value that exists in the browser and not on the server would make
 * the two renders disagree.
 */
export const getCachedUserData = (): AuthUser | null => {
  const raw = safeLocalStorage.getItem(USER_DATA_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return normalizeUserObject(JSON.parse(raw));
  } catch {
    safeLocalStorage.removeItem(USER_DATA_STORAGE_KEY);
    return null;
  }
};

/** Mirrors the user (or its absence) into localStorage. */
export const writeCachedUserData = (user: AuthUser | null): void => {
  if (user) {
    safeLocalStorage.setItem(USER_DATA_STORAGE_KEY, JSON.stringify(user));
    if (user.profile_image) {
      safeLocalStorage.setItem(
        PROFILE_IMAGE_STORAGE_KEY,
        String(user.profile_image),
      );
    } else {
      safeLocalStorage.removeItem(PROFILE_IMAGE_STORAGE_KEY);
    }
    return;
  }

  safeLocalStorage.removeItem(USER_DATA_STORAGE_KEY);
  safeLocalStorage.removeItem(PROFILE_IMAGE_STORAGE_KEY);
};
