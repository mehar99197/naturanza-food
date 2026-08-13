import { AlertTriangle, Ban, Loader2, LogOut, RefreshCw } from "lucide-react";

// Full-screen "Unauthorized" warning shown by AdminIpGate the moment a visitor
// (signed-in or not) hits any /admin/* URL from an IP that is not on the admin
// allowlist. No admin page — not even the login form — is rendered underneath.
const AdminIpBlocked = ({ currentIp = "", onRetry, onLogout, retrying = false }) => {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
          <Ban className="h-7 w-7" />
        </div>

        <h1 className="mt-5 text-center text-xl font-bold text-slate-900 sm:text-2xl">
          Unauthorized Access
        </h1>

        <p className="mt-3 text-center text-sm leading-relaxed text-slate-600 sm:text-base">
          This page is not authorized for your network. The admin panel is only accessible from IP
          addresses that a super administrator has added to the allowlist.
        </p>

        {currentIp ? (
          <div className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-700" />
            <p className="text-xs font-medium text-amber-900 sm:text-sm">
              Your detected IP:{" "}
              <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs font-semibold">
                {currentIp}
              </code>
            </p>
          </div>
        ) : null}

        <p className="mt-4 text-center text-xs text-slate-400 sm:text-sm">
          If you believe this is a mistake, contact a super administrator and ask them to add your IP
          address to the admin panel allowlist.
        </p>

        <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Try again
          </button>

          {onLogout ? (
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default AdminIpBlocked;