import { useEffect, useState } from "react";

/**
 * Password-reset links carry the token in the URL fragment (#token=...).
 * Browsers never send the fragment to the server, so the token stays out of
 * server/proxy access logs and Referer headers. The `?token=` query form is
 * still accepted so links emailed before this change keep working until they
 * expire (30 minutes).
 */
const readResetToken = () => {
  if (typeof window === "undefined") {
    return "";
  }
  const hashToken = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("token");
  const queryToken = new URLSearchParams(window.location.search).get("token");
  return String(hashToken || queryToken || "").trim();
};

/**
 * Reads the reset token once, then removes it from the address bar so it is
 * not left in browser history, bookmarks or screenshots.
 */
export const useResetToken = () => {
  const [token] = useState(readResetToken);

  useEffect(() => {
    if (!token || typeof window === "undefined") {
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("token");
    url.hash = "";
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
  }, [token]);

  return token;
};
