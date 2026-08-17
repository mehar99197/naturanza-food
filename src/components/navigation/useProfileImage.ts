"use client";

/**
 * Keeps the header avatar in step with the user object, localStorage, other
 * browser tabs, and same-tab profile edits.
 *
 * localStorage is used as a cache so the avatar paints before the session
 * request resolves; the effect below is what stops that cache going stale — it
 * writes through when the user object has an image, and clears the cache when a
 * known user has none (i.e. the avatar was deleted).
 */

import { useEffect, useState } from "react";

import { safeLocalStorage } from "@/lib/storage";

import type { NavigationUser } from "./types";

const STORAGE_KEY = "profileImage";

/** The three spellings the API has used for the same field, in priority order. */
export const resolveUserImage = (
  user: NavigationUser | null | undefined,
  fallbackImage: string | null | undefined,
): string | null => {
  return (
    user?.profile_image ||
    user?.profileImage ||
    user?.avatar ||
    fallbackImage ||
    null
  );
};

/** Detail payload of the same-tab `profileImageUpdated` event. */
interface ProfileImageUpdatedDetail {
  profileImage?: string | null;
}

export interface ProfileImageController {
  profileImage: string | null;
  /** Call from the `<img onError>` so a broken URL falls back to the initial. */
  markImageFailed: () => void;
  /** Clears both the cached image and the failure flag; used on logout. */
  reset: () => void;
  imageLoadFailed: boolean;
}

export function useProfileImage(
  user: NavigationUser | null,
): ProfileImageController {
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);

  useEffect(() => {
    const syncProfileImage = (forcedImage?: string | null) => {
      if (typeof forcedImage !== "undefined") {
        if (forcedImage) {
          safeLocalStorage.setItem(STORAGE_KEY, forcedImage);
        } else {
          safeLocalStorage.removeItem(STORAGE_KEY);
        }

        setProfileImage(forcedImage || null);
        setImageLoadFailed(false);
        return;
      }

      const savedImage = safeLocalStorage.getItem(STORAGE_KEY);
      const userImage = resolveUserImage(user, null);
      const hasUser = Boolean(user && typeof user === "object");

      if (userImage && userImage !== savedImage) {
        safeLocalStorage.setItem(STORAGE_KEY, userImage);
      }

      if (!userImage && hasUser && savedImage) {
        safeLocalStorage.removeItem(STORAGE_KEY);
      }

      // With no user resolved yet the cached value is still the best guess; once
      // a user *is* known, its own (possibly absent) image is authoritative.
      const nextImage = userImage || (hasUser ? null : savedImage || null);

      setProfileImage(nextImage);
      setImageLoadFailed(false);
    };

    // Load on mount / user change
    syncProfileImage();

    // Listen for storage changes (from other tabs)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setProfileImage(e.newValue);
      }
    };

    // Listen for custom event for same-tab updates
    const handleProfileUpdate = (event: Event) => {
      const detail = (event as CustomEvent<ProfileImageUpdatedDetail>).detail;
      if (
        Object.prototype.hasOwnProperty.call(detail || {}, "profileImage")
      ) {
        syncProfileImage(detail.profileImage);
        return;
      }

      syncProfileImage();
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("profileImageUpdated", handleProfileUpdate);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("profileImageUpdated", handleProfileUpdate);
    };
  }, [user]);

  return {
    profileImage,
    imageLoadFailed,
    markImageFailed: () => setImageLoadFailed(true),
    reset: () => {
      setProfileImage(null);
      setImageLoadFailed(false);
      safeLocalStorage.removeItem(STORAGE_KEY);
    },
  };
}
