import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Shield, Mail, Lock, AlertCircle, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { useAdminAuth } from "@/context/AdminAuthContext";

const REMEMBERED_EMAIL_KEY = "adminRememberedEmail";

const getPasswordStrength = (value) => {
  if (!value) {
    return { score: 0, label: "", tone: "bg-slate-200", textTone: "text-slate-500" };
  }

  let score = 0;
  if (value.length >= 8) {
    score += 1;
  }
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) {
    score += 1;
  }
  if (/\d/.test(value)) {
    score += 1;
  }
  if (/[^A-Za-z\d]/.test(value)) {
    score += 1;
  }

  if (score <= 1) {
    return { score, label: "Weak", tone: "bg-red-500", textTone: "text-red-600" };
  }

  if (score <= 2) {
    return { score, label: "Medium", tone: "bg-amber-500", textTone: "text-amber-700" };
  }

  return { score, label: "Strong", tone: "bg-green-600", textTone: "text-green-700" };
};

export function AdminLogin() {
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || "");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const { adminLogin, isAdminAuthenticated, isSuperAdmin } = useAdminAuth();
  const navigate = useNavigate();

  const passwordStrength = getPasswordStrength(password);
  const showRateLimitWarning = failedAttempts >= 3;

  useEffect(() => {
    if (location.state?.email) {
      setRememberMe(true);
      return;
    }

    const rememberedEmail = window.localStorage.getItem(REMEMBERED_EMAIL_KEY);
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    }
  }, [location.state?.email]);

  // Only auto-redirect if a SUPER-ADMIN session is active. A staff session on
  // this URL shouldn't bounce away — the user may be deliberately switching
  // to a super-admin account.
  if (isAdminAuthenticated && isSuperAdmin) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (loading) {
      return;
    }

    setError("");

    // Basic validation
    if (!email || !password) {
      setError("Please enter both email and password");
      return;
    }

    setLoading(true);

    const [result] = await Promise.all([
      adminLogin(email, password),
      new Promise((resolve) => window.setTimeout(resolve, 800)),
    ]);

    if (result.success) {
      if (rememberMe) {
        window.localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim());
      } else {
        window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      }

      setFailedAttempts(0);
      setLoading(false);
      navigate("/admin/dashboard");
      return;
    }

    setFailedAttempts((prev) => prev + 1);
    setError(result.message || "Invalid admin credentials");
    setLoading(false);
  };

  const handleEnterSubmit = (e) => {
    if (e.key !== "Enter") {
      return;
    }

    e.preventDefault();
    e.currentTarget.form?.requestSubmit();
  };

  return (
    <div className="auth-premium-font relative h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-[#f8fbf8] to-[#eef7ef] px-4 sm:px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(16,185,129,0.09),transparent_42%),radial-gradient(circle_at_84%_82%,rgba(22,163,74,0.07),transparent_42%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.05] [background-image:linear-gradient(rgba(22,101,52,0.28)_1px,transparent_1px),linear-gradient(90deg,rgba(22,101,52,0.2)_1px,transparent_1px)] [background-size:48px_48px]" />

      <div className="relative z-10 mx-auto flex h-full w-full max-w-[30rem] flex-col items-center justify-center">
        <div className="mb-3 text-center sm:mb-4">
          <img
            src="/images/logo.png"
            alt="Naturanza Food"
            className="mx-auto h-11 w-auto max-w-[150px] object-contain sm:h-12 sm:max-w-[170px]"
          />
        </div>

        <div className="relative w-full overflow-hidden rounded-3xl border border-white/85 bg-white/95 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_28px_52px_-28px_rgba(22,101,52,0.38),0_12px_24px_-16px_rgba(15,23,42,0.2)] backdrop-blur-sm sm:p-7">
          <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-emerald-100/60 blur-3xl" />
          <div className="pointer-events-none absolute -left-14 bottom-4 h-40 w-40 rounded-full bg-green-100/70 blur-2xl" />

          <div className="relative">
            <div className="mb-2.5 flex justify-end">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-800 shadow-sm">
                <span className="text-[10px]">🔒</span>
                Secure Login
              </span>
            </div>

            <header className="text-center">
              <h1 className="text-[1.65rem] font-bold tracking-[-0.02em] text-slate-900 sm:text-[1.8rem]">
                Admin Login
              </h1>
              <p className="mt-1.5 text-sm text-slate-600 sm:text-[0.95rem]">
                Enter your credentials to access the admin panel
              </p>
            </header>

            {error && (
              <div className="mt-3 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {showRateLimitWarning ? (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/85 px-4 py-2.5 text-xs font-semibold text-amber-800 sm:text-sm">
                Too many failed attempts. Try again later.
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="mt-4 space-y-3 sm:space-y-3.5">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700">Admin Email</span>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={handleEnterSubmit}
                    className="w-full rounded-2xl border border-green-100 bg-white px-4 py-2.5 pl-10 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                    placeholder="admin@example.com"
                    disabled={loading}
                    autoComplete="email"
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700">Password</span>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={handleEnterSubmit}
                    className="w-full rounded-2xl border border-green-100 bg-white px-4 py-2.5 pl-10 pr-11 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                    placeholder="Enter your password"
                    disabled={loading}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="password-toggle-btn absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center text-slate-500 transition-colors duration-150 hover:text-slate-600"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {password ? (
                  <div className="mt-2">
                    <div className="mb-1.5 flex gap-1">
                      {[1, 2, 3, 4].map((level) => (
                        <span
                          key={level}
                          className={`h-1.5 flex-1 rounded-full ${
                            level <= passwordStrength.score ? passwordStrength.tone : "bg-green-100"
                          }`}
                        />
                      ))}
                    </div>
                    <p className={`text-xs font-medium ${passwordStrength.textTone}`}>
                      Password strength: {passwordStrength.label}
                    </p>
                  </div>
                ) : null}
              </label>

              <div className="flex items-center justify-between gap-3 pt-0.5">
                <label className="inline-flex items-center gap-2.5 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-green-200 text-green-700 focus:ring-green-400"
                  />
                  <span>Remember me</span>
                </label>

                <Link
                  to="/admin/forgot-password"
                  className="text-sm font-semibold text-green-700 underline decoration-green-300 underline-offset-4 transition hover:text-green-800 hover:decoration-green-500"
                >
                  Forgot Password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 via-green-600 to-emerald-600 px-4 py-3 text-[0.95rem] font-semibold tracking-[0.01em] text-white shadow-[0_16px_34px_-14px_rgba(22,163,74,0.55)] transition-all duration-300 hover:-translate-y-0.5 hover:from-emerald-600 hover:via-green-700 hover:to-emerald-700 hover:shadow-[0_18px_34px_-12px_rgba(22,163,74,0.58)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <Shield className="h-[18px] w-[18px]" />
                    Sign In
                  </>
                )}
              </button>
            </form>

            <div className="mt-4 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-700" />
                <p className="text-xs font-medium leading-relaxed text-amber-900 sm:text-sm">
                  <span className="font-semibold">Security Notice:</span> This is a restricted area.
                  All login attempts are logged and monitored.
                </p>
              </div>
            </div>

            <div className="mt-3 border-t border-slate-100 pt-3 text-center">
              <Link
                to="/"
                className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 transition hover:text-green-700"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Main Website
              </Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
