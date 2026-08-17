"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * "Copy link", shared by the header row and the sidebar card.
 *
 * The reset timer lives in an effect rather than in the click handler, where
 * BlogPost.jsx had it: an unmounted component whose timer is still pending would
 * otherwise call setState on nothing.
 */
export function useCopyLink(): { copied: boolean; copy: () => void } {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = useCallback(() => {
    // Clipboard access is denied on insecure origins and when the document is
    // not focused; the original swallowed that, and so does this.
    navigator.clipboard.writeText(window.location.href).then(
      () => setCopied(true),
      () => undefined,
    );
  }, []);

  return { copied, copy };
}
