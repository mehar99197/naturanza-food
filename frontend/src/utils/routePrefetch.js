// Route-chunk prefetching.
//
// Every page except Home is a lazy() chunk, so the first visit to a route costs
// a network round-trip before React can render anything. Fetching that chunk
// while the user is still *deciding* — hovering, tabbing to, or touching a link
// — means the module is already in memory by the time they click, and the
// Suspense boundary in App.jsx is never reached.
//
// import() caches its own promise, so calling a loader twice is free. The
// `fired` set exists to skip repeat map lookups and, more importantly, to let a
// failed prefetch be retried later instead of being remembered as done.

const fired = new Set();

export function runPrefetch(key, loader) {
  if (!loader || fired.has(key)) return;
  fired.add(key);
  // Swallow rejections — a prefetch is an optimisation and must never be able
  // to affect, or throw into, a real navigation.
  loader().catch(() => fired.delete(key));
}

const EXACT_ROUTES = {
  "/shop": () => import("@/pages/Shop"),
  "/about": () => import("@/pages/About"),
  "/contact": () => import("@/pages/Contact"),
  "/faq": () => import("@/pages/FAQ"),
  "/shipping": () => import("@/pages/Shipping"),
  "/returns": () => import("@/pages/Returns"),
  "/terms": () => import("@/pages/Terms"),
  "/privacy": () => import("@/pages/Privacy"),
  "/cookies": () => import("@/pages/Cookies"),
  "/blog": () => import("@/pages/Blog"),
  "/login": () => import("@/pages/Login"),
  "/register": () => import("@/pages/Register"),
  "/checkout": () => import("@/pages/Checkout"),
};

// Routes with a dynamic segment — the prefix alone determines the chunk, so
// every product link warms the same ProductDetail module.
const PREFIX_ROUTES = [
  ["/product/", () => import("@/pages/ProductDetail")],
  ["/shop/", () => import("@/pages/Shop")],
  ["/blog/", () => import("@/pages/BlogPost")],
];

const resolveLoader = (rawPath) => {
  const path = String(rawPath || "").split(/[?#]/)[0];
  if (EXACT_ROUTES[path]) {
    return [path, EXACT_ROUTES[path]];
  }
  for (const [prefix, loader] of PREFIX_ROUTES) {
    if (path.startsWith(prefix)) {
      return [prefix, loader];
    }
  }
  return [null, null];
};

export function prefetchRoute(path) {
  const [key, loader] = resolveLoader(path);
  runPrefetch(key, loader);
}

// Delegated at the document so a single listener covers every internal link on
// the site — nav, footer, product cards, and anything added later — instead of
// each component having to remember to opt in.
//
// pointerover fires often, but after the first hit per route this is a Set
// lookup, and the listeners are passive so they never delay scrolling.
export function attachLinkPrefetch() {
  const onIntent = (event) => {
    const anchor = event.target?.closest?.("a[href]");
    if (!anchor) return;
    const href = anchor.getAttribute("href");
    // Internal paths only: "//evil.com" is protocol-relative and external.
    if (!href || !href.startsWith("/") || href.startsWith("//")) return;
    prefetchRoute(href);
  };

  document.addEventListener("pointerover", onIntent, { passive: true });
  document.addEventListener("focusin", onIntent, { passive: true });
  document.addEventListener("touchstart", onIntent, { passive: true });

  return () => {
    document.removeEventListener("pointerover", onIntent);
    document.removeEventListener("focusin", onIntent);
    document.removeEventListener("touchstart", onIntent);
  };
}

// Hover does not exist on touch devices, so the two routes a visitor is most
// likely to open next are warmed once the browser is idle. Both are small and
// would otherwise be the very chunks that stall the first tap.
export function warmLikelyRoutes() {
  const warm = () => {
    prefetchRoute("/shop");
    prefetchRoute("/product/");
  };

  if (typeof window === "undefined") return;
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(warm, { timeout: 3000 });
  } else {
    window.setTimeout(warm, 1500);
  }
}
