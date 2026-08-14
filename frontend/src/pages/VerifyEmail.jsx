import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Eye, EyeOff, MailCheck, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import LeftPanel from "@/components/auth/LeftPanel";
import { NoIndexSEO } from "@/components/SEO";

const leftPoints = [
  "Only real, verified emails allowed",
  "6-digit code, expires in 15 minutes",
  "Protects your account from misuse",
  "One quick step, then you're in",
];

const RESEND_COOLDOWN = 60;

// Mirrors the server's strongPassword rule (12+, upper, lower, number, symbol).
const PASSWORD_RULE = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,128}$/;

const VerifyEmail = () => {
  const { verifyEmail, resendVerification } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const email = useMemo(
    () => String(location.state?.email || "").trim().toLowerCase(),
    [location.state],
  );

  const [code, setCode] = useState("");
  const [generalError, setGeneralError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  const timerRef = useRef(null);

  // Revealed only when the server answers PASSWORD_REQUIRED — i.e. this code
  // isn't tied to a password chosen in this browser, so the account must not
  // inherit whatever password the original signup used.
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // No email in navigation state → nothing to verify; send them to register.
  useEffect(() => {
    if (!email) {
      navigate("/register", { replace: true });
    }
  }, [email, navigate]);

  // Countdown for the resend button (a code was just sent before landing here).
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCooldown((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  const onSubmit = async (event) => {
    event.preventDefault();
    setGeneralError("");
    setInfo("");

    if (!/^\d{6}$/.test(code)) {
      setGeneralError("Please enter the 6-digit code from your email.");
      return;
    }

    if (passwordRequired) {
      if (!PASSWORD_RULE.test(password)) {
        setGeneralError(
          "Use at least 12 characters with uppercase, lowercase, number, and symbol.",
        );
        return;
      }
      if (password !== confirmPassword) {
        setGeneralError("Both passwords must match.");
        return;
      }
    }

    setSubmitting(true);
    const result = await verifyEmail(
      email,
      code,
      passwordRequired ? password : undefined,
    );
    setSubmitting(false);

    if (result.success) {
      navigate("/", { replace: true });
      return;
    }

    // The code is still redeemable — the server asked for a password before
    // consuming it. Reveal the fields and let them submit again.
    if (result.code === "PASSWORD_REQUIRED") {
      setPasswordRequired(true);
      setInfo(result.message);
      return;
    }

    setGeneralError(result.message || "Verification failed. Please try again.");
  };

  const onResend = async () => {
    if (cooldown > 0) return;
    setGeneralError("");
    setInfo("");

    const result = await resendVerification(email);
    if (result.success) {
      setInfo("A new code has been sent. Please check your inbox (and spam).");
      setCooldown(RESEND_COOLDOWN);
      // The fresh code is issued to this browser, so it may not need a password.
      // Start clean and let the server decide again.
      setPasswordRequired(false);
      setPassword("");
      setConfirmPassword("");
    } else {
      setGeneralError(result.message || "Could not resend the code.");
      if (result.retryAfterSeconds) {
        setCooldown(result.retryAfterSeconds);
      }
    }
  };

  return (
    <>
      <NoIndexSEO title="Verify Your Email" />
      <div className="auth-premium-font min-h-screen bg-green-50 overflow-y-auto lg:h-screen lg:overflow-hidden">
        <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:block lg:w-[42%] xl:w-[44%]">
          <LeftPanel
            heading="Verify Your Email to Continue"
            description="To keep Naturanza Food safe, we confirm every new account with a one-time code sent to your email."
            trustPoints={leftPoints}
          />
        </div>

        <main className="min-h-screen px-4 py-8 sm:px-6 lg:ml-[42%] lg:h-screen lg:overflow-y-auto lg:px-10 xl:ml-[44%] xl:px-14">
          <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[560px] items-center lg:min-h-full">
            <div className="w-full rounded-3xl border border-green-100 bg-white p-6 shadow-[0_24px_55px_rgba(7,43,24,0.12)] sm:p-8">
              <div className="mb-6 flex items-center justify-between">
                <Link
                  to="/register"
                  aria-label="Back to register"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-green-100 bg-white text-green-700 transition hover:border-green-200 hover:bg-green-50"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Link>
                <span className="rounded-full border border-green-100 bg-green-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-green-700">
                  Email Verification
                </span>
              </div>

              <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-700">
                <MailCheck className="h-8 w-8" />
              </span>

              <div className="text-center">
                <h1 className="text-[1.7rem] font-bold leading-tight tracking-[-0.02em] text-slate-900">
                  Enter your verification code
                </h1>
                <p className="mt-2 text-sm text-slate-600">
                  We sent a 6-digit code to
                </p>
                <p className="mt-1 break-all text-sm font-semibold text-slate-800">{email}</p>
              </div>

              {generalError ? (
                <div className="mt-5 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{generalError}</span>
                </div>
              ) : null}

              {info ? (
                <div className="mt-5 flex items-start gap-2 rounded-2xl border border-green-200 bg-green-50 px-3.5 py-3 text-sm text-green-700">
                  <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{info}</span>
                </div>
              ) : null}

              <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="● ● ● ● ● ●"
                  aria-label="6-digit verification code"
                  className="w-full rounded-2xl border border-green-100 bg-white px-4 py-4 text-center text-2xl font-bold tracking-[0.5em] text-slate-800 placeholder:tracking-[0.3em] placeholder:text-slate-300 shadow-sm outline-none transition focus:border-green-600 focus:ring-4 focus:ring-green-100"
                />

                {passwordRequired ? (
                  <div className="space-y-4 rounded-2xl border border-green-100 bg-green-50/60 p-4">
                    <div>
                      <label
                        htmlFor="verify-password"
                        className="block text-sm font-semibold text-slate-800"
                      >
                        Choose a password
                      </label>
                      <p className="mt-1 text-xs text-slate-600">
                        Use at least 12 characters with uppercase, lowercase, number, and symbol.
                      </p>
                    </div>

                    <div className="relative">
                      <input
                        id="verify-password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="New password"
                        className="w-full rounded-2xl border border-green-100 bg-white px-4 py-3 pr-12 text-sm text-slate-800 shadow-sm outline-none transition focus:border-green-600 focus:ring-4 focus:ring-green-100"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((value) => !value)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-400 transition hover:text-green-700 focus-visible:outline-none focus-visible:text-green-700"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>

                    <input
                      id="verify-confirm-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm password"
                      aria-label="Confirm password"
                      className="w-full rounded-2xl border border-green-100 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-green-600 focus:ring-4 focus:ring-green-100"
                    />
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={
                    submitting ||
                    code.length !== 6 ||
                    (passwordRequired && (!password || !confirmPassword))
                  }
                  className="inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-3.5 text-[0.95rem] font-semibold text-white shadow-[0_14px_28px_rgba(5,120,78,0.28)] transition hover:from-green-700 hover:to-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-300 disabled:cursor-not-allowed disabled:opacity-65"
                >
                  {submitting
                    ? "Verifying..."
                    : passwordRequired
                      ? "Set password & continue"
                      : "Verify & Continue"}
                </button>
              </form>

              <div className="mt-6 text-center text-sm text-slate-600">
                Didn't get the code?{" "}
                <button
                  type="button"
                  onClick={onResend}
                  disabled={cooldown > 0}
                  className="font-semibold text-green-700 transition hover:text-green-800 disabled:cursor-not-allowed disabled:text-slate-400"
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                </button>
              </div>

              <div className="mt-4 text-center">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 transition hover:text-green-700"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Sign In
                </Link>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

export default VerifyEmail;
