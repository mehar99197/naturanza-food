import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { useAuth } from "@/context/AuthContext";
import { sanitizeInput } from "@/lib/sanitize";
import LeftPanel from "@/components/auth/LeftPanel";

const leftPoints = [
  "At least 12 characters required",
  "Use letters, numbers, and symbols",
  "Reset links are single-use for safety",
  "Protected with end-to-end encryption",
];

const getStrength = (password) => {
  let score = 0;
  if (password.length >= 12) {
    score += 1;
  }
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) {
    score += 1;
  }
  if (/\d/.test(password)) {
    score += 1;
  }
  if (/[^A-Za-z\d]/.test(password)) {
    score += 1;
  }
  return score;
};

const strengthLabels = ["", "Weak", "Fair", "Good", "Strong"];
const strengthColors = [
  "",
  "bg-red-500",
  "bg-orange-500",
  "bg-yellow-500",
  "bg-green-600",
];

const labelClassName = "mb-2 block text-sm font-semibold text-slate-700";
const inputClassName =
  "w-full rounded-2xl border border-green-100 bg-white px-4 py-3 pl-10 text-[15px] text-slate-800 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-green-600 focus:ring-4 focus:ring-green-100";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const { resetPassword } = useAuth();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    mode: "onBlur",
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [generalError, setGeneralError] = useState("");
  const [success, setSuccess] = useState(false);

  const passwordValue = watch("password", "");
  const confirmPasswordValue = watch("confirmPassword", "");
  const strength = getStrength(passwordValue);

  useEffect(() => {
    if (!success) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      navigate("/login");
    }, 2800);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [navigate, success]);

  const onSubmit = async (values) => {
    if (!token) {
      setGeneralError("Invalid or missing reset token. Please request a new link.");
      return;
    }

    setGeneralError("");

    const result = await resetPassword(token, sanitizeInput(values.password));
    if (result.success) {
      setSuccess(true);
      return;
    }

    setGeneralError(result.message || "Failed to reset password. The link may have expired.");
  };

  return (
    <div className="auth-premium-font min-h-screen bg-green-50 lg:h-screen lg:overflow-hidden">
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:block lg:w-[42%] xl:w-[44%]">
        <LeftPanel
          heading="Set a Fresh Secure Password"
          description="Choose a strong password to keep your account protected and continue your wellness journey."
          trustPoints={leftPoints}
        />
      </div>

      <main className="min-h-screen px-4 py-8 sm:px-6 lg:ml-[42%] lg:h-screen lg:overflow-y-auto lg:px-10 xl:ml-[44%] xl:px-14">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[560px] items-center lg:min-h-full">
          <div className="w-full rounded-3xl border border-green-100 bg-white p-6 shadow-[0_24px_55px_rgba(7,43,24,0.12)] sm:p-8">
            <div className="mb-6 flex items-center justify-between">
              <Link
                to="/login"
                aria-label="Back to sign in"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-green-100 bg-white text-green-700 transition hover:border-green-200 hover:bg-green-50"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>

              <span className="rounded-full border border-green-100 bg-green-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-green-700">
                New Password
              </span>
            </div>

            {!success ? (
              <>
                <div>
                  <h1 className="text-[1.95rem] font-bold leading-tight tracking-[-0.02em] text-slate-900">
                    Create new password
                  </h1>
                  <p className="mt-2 text-sm text-slate-600">
                    Use at least 12 characters with uppercase, lowercase, number, and symbol.
                  </p>
                </div>

                {!token ? (
                  <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-800">
                    No reset token found. Please use the email link or{" "}
                    <Link to="/forgot-password" className="font-semibold underline">
                      request a new one
                    </Link>
                    .
                  </div>
                ) : null}

                {generalError ? (
                  <div className="mt-5 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>{generalError}</span>
                  </div>
                ) : null}

                <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
                  <label className="block">
                    <span className={labelClassName}>New password</span>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="Minimum 12 characters"
                        {...register("password", {
                          required: "Password is required",
                          minLength: {
                            value: 12,
                            message: "Password must be at least 12 characters",
                          },
                          validate: (value) =>
                            /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])/.test(value) ||
                            "Use uppercase, lowercase, number, and special character",
                        })}
                        className={`${inputClassName} pr-11 ${
                          errors.password
                            ? "border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-100"
                            : ""
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="password-toggle-btn absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center text-slate-500 transition hover:text-slate-700"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {errors.password ? (
                      <p className="mt-1.5 text-xs font-medium text-red-600">{errors.password.message}</p>
                    ) : null}

                    {passwordValue ? (
                      <div className="mt-2.5">
                        <div className="mb-1.5 flex gap-1">
                          {[1, 2, 3, 4].map((level) => (
                            <span
                              key={level}
                              className={`h-1.5 flex-1 rounded-full ${
                                level <= strength ? strengthColors[strength] : "bg-green-100"
                              }`}
                            />
                          ))}
                        </div>
                        <p className="text-xs font-medium text-slate-600">
                          {strengthLabels[strength]} password
                        </p>
                      </div>
                    ) : null}
                  </label>

                  <label className="block">
                    <span className={labelClassName}>Confirm new password</span>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="Re-enter your password"
                        {...register("confirmPassword", {
                          required: "Please confirm your password",
                          validate: (value) =>
                            value === passwordValue || "Passwords do not match",
                        })}
                        className={`${inputClassName} pr-11 ${
                          errors.confirmPassword
                            ? "border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-100"
                            : ""
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        className="password-toggle-btn absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center text-slate-500 transition hover:text-slate-700"
                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {errors.confirmPassword ? (
                      <p className="mt-1.5 text-xs font-medium text-red-600">
                        {errors.confirmPassword.message}
                      </p>
                    ) : null}
                    {!errors.confirmPassword &&
                    confirmPasswordValue &&
                    confirmPasswordValue === passwordValue ? (
                      <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-green-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Passwords match
                      </p>
                    ) : null}
                  </label>

                  <button
                    type="submit"
                    disabled={isSubmitting || !token}
                    className="inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-3.5 text-[0.95rem] font-semibold text-white shadow-[0_14px_28px_rgba(5,120,78,0.28)] transition hover:from-green-700 hover:to-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-300 disabled:cursor-not-allowed disabled:opacity-65"
                  >
                    {isSubmitting ? "Resetting password..." : "Reset Password"}
                  </button>
                </form>

                <div className="mt-6 text-center">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 transition hover:text-green-700"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Sign In
                  </Link>
                </div>
              </>
            ) : (
              <div className="py-2 text-center">
                <span className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-700">
                  <CheckCircle2 className="h-8 w-8" />
                </span>
                <h2 className="mt-5 text-2xl font-bold tracking-[-0.02em] text-slate-900">Password reset!</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Your password was updated successfully. Redirecting to sign in...
                </p>

                <Link
                  to="/login"
                  className="mt-6 inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(5,120,78,0.25)] transition hover:from-green-700 hover:to-emerald-700"
                >
                  Sign In Now
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ResetPassword;
