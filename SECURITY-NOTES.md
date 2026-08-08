# Security notes

## Accepted dependency advisory

### `react-router` / `react-router-dom` — GHSA-qwww-vcr4-c8h2 (high)

> React Router: RSC Mode CSRF Bypass Allows Action Execution Before 400 Response
> Affected range: `>=7.12.0 <=8.2.0`

**Status: not applicable to this app — deliberately not "fixed".**

`npm audit fix --force` resolves this by downgrading `react-router-dom` to **7.11.0**,
seven minor versions behind the installed **7.18.2**. That trade is not worth taking here:

- The advisory only affects **RSC (React Server Components) mode**. This app does not use it:
  - `frontend/src/App.jsx` renders `BrowserRouter` — the plain client router.
  - There is no `createBrowserRouter` / `RouterProvider` data router, no `@react-router/dev`,
    no `routes.ts`, and no import from `react-router/rsc`.
  - `frontend/components.json` records `"rsc": false`.
- There is no patched release in the 7.x line yet, and no 8.x has been published.

**Re-evaluate this note when:**
- a fixed `react-router-dom` release ships (then upgrade and delete this section), or
- the app ever adopts RSC mode / a framework-mode data router — at which point the
  advisory becomes live and the upgrade is mandatory before shipping.

Verify the assumption still holds with:

```bash
cd frontend
grep -rn "createBrowserRouter\|RouterProvider\|react-router/rsc\|@react-router/dev" src/
npm audit
```

## Backend

`npm audit --omit=dev` in `backend/` reports **0 vulnerabilities**.

### Resolved: `ip-address` — GHSA-mwp4-54f8-5fhr / -4xrf-jv44-h6hh / -22jq-vg5j-6vgg (high)

Pulled in transitively as `express-rate-limit@8.x → ip-address`. The three advisories all
describe parsing quirks (leading-zero octets decoded as decimal, a CIDR suffix suppressing
special-use classification, IPv4-mapped/NAT64 misclassification) that can bypass SSRF and
trust-boundary checks.

**Fixed** by bumping the transitive to **`ip-address` 10.4.0** (`npm audit fix` in `backend/`).
This is *not* a breaking change — `express-rate-limit` declares `^10.2.0`, so the patched
release satisfies the existing range and only `backend/package-lock.json` changed.

Exposure here was limited but real: the app's own IP handling never feeds `ip-address`
(`backend/utils/clientIp.js` and `routes/geolocation.js` validate with their own regexes),
but `express-rate-limit` uses it to derive the rate-limit key, so a crafted
`X-Forwarded-For` could have been normalised inconsistently and split/evade a limiter bucket.
Re-verify with:

```bash
cd backend && npm audit --omit=dev   # expect: found 0 vulnerabilities
```


## Hostinger vulnerability scanner — frontend build-tooling advisories

The hPanel scanner (Security → Vulnerabilities) has flagged, on the **deployed** server:
`postcss`, `esbuild`, `js-yaml`, and `brace-expansion` (e.g. CVE-2026-14257,
GHSA-r28c-9q8g-f849, CVE-2026-59869, and the withdrawn esbuild GHSA-gv7w-rqvm-qjhr).

**Status: not runtime-exploitable.** Every one of these is a **dev/build-only** dependency —
`postcss`/`esbuild` via Vite, `js-yaml` via eslint, `brace-expansion` via
`eslint-plugin-react → minimatch`. `npm ls --omit=dev` shows **none** of them in the production
dependency tree. The live app runs `node backend/index.js` (backend `npm audit` = 0) and serves the
pre-built static `frontend/dist`; it never loads any of these packages at runtime.

Why the scanner still sees them: the deploy installs devDependencies to run `vite build`, and the
tooling was previously left in `frontend/node_modules` on the server afterwards. The repo lockfile
already pins patched `postcss` 8.5.25 / `esbuild` 0.28.1 / `js-yaml` 4.3.1; a stale scan predates
that deploy. `brace-expansion`'s "fixed" line (5.x) would require a cross-major override of an
eslint transitive — avoided, because it is not shipped at runtime.

### Root cause of the 8 reported findings: a stale directory, not outdated packages (resolved)

The scanner was reading `~/domains/naturanzafood.com/nodejs/` — an abandoned **21 Jun checkout
(`bc4503f`)** that is **not served**. It contained precisely the flagged versions
(`postcss` 8.5.14, `esbuild` 0.27.7, `js-yaml` 4.2.0, `brace-expansion` 1.1.14, plus glob's nested
`brace-expansion` 2.1.1). The **live** build at `.builds/current/nodejs`, and all five
`.builds/versions/*`, already carried the **patched** releases (`postcss` 8.5.25, `esbuild` 0.28.1,
`js-yaml` 4.3.1, `brace-expansion` 1.1.18 / 2.1.4).

**So upgrading packages could never have cleared these findings** — nothing that the app actually
runs was vulnerable. The directory just had to go.

**Resolved:** `~/domains/naturanzafood.com/nodejs/` was **deleted** (renamed to `nodejs.bak` first,
site verified, then removed), reclaiming **828 MB** (domain total 4.8G → 4.0G). Verified before
deleting that `public_html/.htaccess` still pointed at `.builds/current/nodejs` and that the live
tree was intact; verified after that `/`, `/shop`, `/api/products`, `/api/categories` all return
**200** with live DB data, Passenger workers never restarted, and `stderr.log` stayed empty.
**Re-run the hPanel scan** — the 8 findings should now be gone.

⚠️ Don't recreate a checkout at `~/domains/naturanzafood.com/nodejs/`: it is never served, but the
scanner reads it, so it produces phantom advisories. Deploy only through `.builds/`.

### Hardening so build tooling stops shipping at all

**Fix applied:** the root `postinstall` now deletes `frontend/node_modules` **after** the build
(`… && npm --prefix frontend run build && rm -rf frontend/node_modules`), so the deployed server
carries only `frontend/dist` + `backend/node_modules` — the build/lint tooling the scanner flags is
gone. ⚠️ This assumes the frontend is built **only** by `postinstall` (the documented flow). If a
**separate Build Command** is configured in the hPanel Node app (`npm run build`) to run *after*
install, remove it — otherwise it would run after the prune and fail with `vite: not found`.
Re-run the scan after the next deploy to confirm the advisories clear.

> ✅ **Now applied on the server (2026-08-04).** The running build (`5a50122`) predates the prune, so
> rather than wait for a redeploy the prune was performed manually against **all five**
> `.builds/versions/*/nodejs`: `frontend/node_modules` removed wherever a built
> `frontend/dist/index.html` was present. Domain usage went **4.0G → 1.8G**.
>
> Afterwards, an account-wide sweep for the flagged packages returns **only** `brace-expansion`
> **2.1.4** (patched, via `backend/node_modules/glob`) — no `postcss`, `esbuild`, or `js-yaml` copies
> remain anywhere. Site verified: `/`, `/shop`, `/api/products`, `/api/categories` → **200**, the
> hashed JS bundle serves **200**, and `stderr.log` is empty.
>
> Re-verify at any time with:
>
> ```bash
> ssh -p 65002 u941499432@145.79.30.42 \
>   'ls ~/domains/naturanzafood.com/.builds/current/nodejs/frontend/node_modules 2>/dev/null | wc -l'
> # expect: 0  (directory gone)
> ```
>
> Future deploys keep this property automatically via `postinstall` — **provided** no hPanel Build
> Command is set (see `DEPLOYMENT.md` §2).

## Deployed-vs-repo drift (found during a server audit)

Two things worth knowing about how this app is deployed on Hostinger:

- **The live app root is `.builds/current/nodejs`**, symlinked from `.builds/versions/<uuid>`, and
  started by Passenger (`public_html/.htaccess` → `PassengerStartupFile backend/index.js`,
  `PassengerNodejs …alt-nodejs24`). An older copy used to sit in
  `~/domains/naturanzafood.com/nodejs/`, **stale and not served** — it has since been **deleted**
  (see "Root cause of the 8 reported findings" above). Never audit or patch a directory outside
  `.builds/current/nodejs` and assume you changed production.
- **Auditing must target the live build**, since a stale release can carry weaker settings than the
  repo. Example caught this way: the deployed `helmet` CSP still allowed
  `script-src 'unsafe-inline' https:`, whereas the repo has since tightened it to an allow-list
  (`'self'` + specific Google hosts) and added `frameAncestors`/`baseUri`/`formAction`.

Secrets are handled correctly: the real `.env` lives in `.builds/config/.env` (mode `600`, outside
the web root); only `.env.example` / `.env.production` are inside the app tree, and
`/.env`, `/.git/config`, `/backend/.env` all return 403/404 over HTTPS.

### Open item: effective CSP is weaker than the app's

Regardless of the app's `helmet` policy, the response served for both `/` and `/api/*` is only:

```
content-security-policy: upgrade-insecure-requests
```

This was reproduced **against the origin directly** (bypassing the `hcdn` CDN via
`curl --resolve naturanzafood.com:443:145.79.30.42`), which still returned `server: LiteSpeed`
with the same single directive — while other helmet headers (`origin-agent-cluster`,
`x-dns-prefetch-control`, `referrer-policy`) do pass through. So the CSP specifically is being
replaced in front of Node, most likely by LiteSpeed/hPanel. Deploying the repo's stricter policy
is necessary but may not be sufficient — after the next deploy, re-check with:

```bash
curl -sI https://naturanzafood.com/api/products | grep -i content-security-policy
```

If it is still the single directive, the override is server-side: disable any hPanel
"security headers"/CSP feature for this domain, or set the policy explicitly in `.htaccess`
(`Header always unset Content-Security-Policy` then `Header always set …`) so the app's
policy is what actually reaches browsers. Until then, treat XSS defence-in-depth as absent
and rely on output encoding.
