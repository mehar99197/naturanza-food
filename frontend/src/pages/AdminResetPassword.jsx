import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff, Lock } from "lucide-react";
import { useForm } from "react-hook-form";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const AdminResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [generalError, setGeneralError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

  const password = watch("password");

  useEffect(() => {
    if (!token) {
      setGeneralError("Invalid or missing reset token. Please request a new password reset link.");
    }
  }, [token]);

  const getResetErrorMessage = (message) => {
    const normalized = String(message || "").toLowerCase();

    if (!normalized) {
      return "";
    }

    if (normalized.includes("already been used")) {
      return "This reset link was already used. Please request a new one.";
    }

    if (normalized.includes("expired")) {
      return "This reset link has expired. Please request a new one.";
    }

    if (normalized.includes("invalid") && normalized.includes("reset")) {
      return "This reset link is invalid. Please request a new one.";
    }

    if (normalized.includes("different from your current password")) {
      return "Please choose a new password that is different from your current one.";
    }

    return message;
  };

  const onSubmit = async (values) => {
    setGeneralError("");

    if (!token) {
      setGeneralError("Invalid or missing reset token. Please request a new password reset link.");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/admin/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          password: values.password,
          confirmPassword: values.confirmPassword,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setIsSuccess(true);
        setTimeout(() => {
          navigate("/admin/login");
        }, 3000);
        return;
      }

      const friendlyError = getResetErrorMessage(data.error);
      setGeneralError(friendlyError || "Failed to reset password. Please try again.");
    } catch (error) {
      setGeneralError("Failed to reset password. Please try again.");
    }
  };

  const getPasswordStrength = (pwd) => {
    if (!pwd) return { strength: 0, label: "", color: "" };
    
    let strength = 0;
    if (pwd.length >= 8) strength += 1;
    if (pwd.length >= 12) strength += 1;
    if (/[A-Z]/.test(pwd)) strength += 1;
    if (/[0-9]/.test(pwd)) strength += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) strength += 1;

    if (strength <= 2) return { strength: 33, label: "Weak", color: "bg-red-500" };
    if (strength <= 3) return { strength: 66, label: "Medium", color: "bg-yellow-500" };
    return { strength: 100, label: "Strong", color: "bg-emerald-500" };
  };

  const passwordStrength = getPasswordStrength(password);

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
            <div className="mb-2.5 flex items-center justify-between">
              <Link
                to="/admin/login"
                aria-label="Back to admin login"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-green-100 bg-white text-emerald-600 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>

              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-800 shadow-sm">
                <span className="text-[10px]">🔒</span>
                New Password
              </span>
            </div>

            {isSuccess ? (
              <div className="text-center">
                <span className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle2 className="h-8 w-8" />
                </span>

                <h2 className="mt-5 text-[1.5rem] font-bold tracking-[-0.02em] text-slate-900">
                  Password Reset Successful!
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Your admin password has been updated successfully.
                </p>

                <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-700">
                  Redirecting to login page...
                </div>

                <div className="mt-4">
                  <Link
                    to="/admin/login"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 transition hover:text-emerald-700"
                  >
                    Go to Admin Login
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <header className="text-center">
                  <h1 className="text-[1.65rem] font-bold tracking-[-0.02em] text-slate-900 sm:text-[1.8rem]">
                    Create New Password
                  </h1>
                  <p className="mt-1.5 text-sm text-slate-600 sm:text-[0.95rem]">
                    Enter a strong password for your admin account
                  </p>
                </header>

                {generalError && (
                  <div className="mt-3 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <p>{generalError}</p>
                  </div>
                )}

                <form className="mt-4 space-y-3 sm:space-y-3.5" onSubmit={handleSubmit(onSubmit)} noValidate>
                  {/* Password Field */}
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                      New Password
                    </span>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="••••••••••••"
                        {...register("password", {
                          required: "Password is required",
                          minLength: {
                            value: 8,
                            message: "Password must be at least 8 characters",
                          },
                        })}
                        className={`w-full rounded-2xl border border-green-100 bg-white px-4 py-2.5 pl-10 pr-11 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100 ${
                          errors.password
                            ? "border-red-300 bg-red-50/50 focus:border-red-400 focus:ring-red-100"
                            : ""
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="password-toggle-btn absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center text-slate-400 transition hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="mt-1.5 text-xs font-medium text-red-600">
                        {errors.password.message}
                      </p>
                    )}
                  </label>

                  {/* Password Strength Indicator */}
                  {password && (
                    <div className="space-y-1.5">
                      <div className="h-1.5 w-full rounded-full bg-slate-200">
                        <div
                          className={`h-full rounded-full transition-all ${passwordStrength.color}`}
                          style={{ width: `${passwordStrength.strength}%` }}
                        />
                      </div>
                      <p className={`text-xs font-medium ${
                        passwordStrength.strength <= 33 ? "text-red-600" :
                        passwordStrength.strength <= 66 ? "text-yellow-600" : "text-emerald-600"
                      }`}>
                        Password strength: {passwordStrength.label}
                      </p>
                    </div>
                  )}

                  {/* Confirm Password Field */}
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Confirm Password
                    </span>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="••••••••••••"
                        {...register("confirmPassword", {
                          required: "Please confirm your password",
                          validate: (value) =>
                            value === password || "Passwords do not match",
                        })}
                        className={`w-full rounded-2xl border border-green-100 bg-white px-4 py-2.5 pl-10 pr-11 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100 ${
                          errors.confirmPassword
                            ? "border-red-300 bg-red-50/50 focus:border-red-400 focus:ring-red-100"
                            : ""
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="password-toggle-btn absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center text-slate-400 transition hover:text-slate-600"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.confirmPassword && (
                      <p className="mt-1.5 text-xs font-medium text-red-600">
                        {errors.confirmPassword.message}
                      </p>
                    )}
                  </label>

                  <button
                    type="submit"
                    disabled={isSubmitting || !token}
                    className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 to-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:from-emerald-700 hover:to-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-65 sm:py-3"
                  >
                    {isSubmitting ? "Resetting password..." : "Reset Password"}
                  </button>
                </form>

                <div className="mt-4 text-center">
                  <Link
                    to="/admin/forgot-password"
                    className="text-sm font-semibold text-slate-500 transition hover:text-emerald-600"
                  >
                    Need a new reset link?
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="mt-5 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Naturanza Foods. Admin Portal.
        </p>
      </div>
    </div>
  );
};

export default AdminResetPassword;
