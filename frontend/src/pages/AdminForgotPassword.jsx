import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowLeft, CheckCircle2, Mail } from "lucide-react";
import { useForm } from "react-hook-form";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const AdminForgotPassword = () => {
  const [generalError, setGeneralError] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    mode: "onBlur",
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (values) => {
    setGeneralError("");

    try {
      const response = await fetch(`${API_URL}/admin/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: values.email.trim().toLowerCase(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSubmittedEmail(values.email.trim());
        return;
      }

      setGeneralError(data.error || "Unable to send reset link. Please try again.");
    } catch (error) {
      setGeneralError("Unable to send reset link. Please try again.");
    }
  };

  const handleTryAnotherEmail = () => {
    setSubmittedEmail("");
    setGeneralError("");
    reset();
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
                Password Reset
              </span>
            </div>

            {!submittedEmail ? (
              <>
                <header className="text-center">
                  <h1 className="text-[1.65rem] font-bold tracking-[-0.02em] text-slate-900 sm:text-[1.8rem]">
                    Forgot Password?
                  </h1>
                  <p className="mt-1.5 text-sm text-slate-600 sm:text-[0.95rem]">
                    Enter the super admin email and we'll send a reset link
                  </p>
                </header>

                {generalError && (
                  <div className="mt-3 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <p>{generalError}</p>
                  </div>
                )}

                <form className="mt-4 space-y-3 sm:space-y-3.5" onSubmit={handleSubmit(onSubmit)} noValidate>
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                      Admin Email
                    </span>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="email"
                        autoComplete="email"
                        placeholder="admin@naturanzafoods.com"
                        {...register("email", {
                          required: "Email is required",
                          pattern: {
                            value: /\S+@\S+\.\S+/,
                            message: "Enter a valid email address",
                          },
                        })}
                        className={`w-full rounded-2xl border border-green-100 bg-white px-4 py-2.5 pl-10 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100 ${
                          errors.email
                            ? "border-red-300 bg-red-50/50 focus:border-red-400 focus:ring-red-100"
                            : ""
                        }`}
                      />
                    </div>
                    {errors.email && (
                      <p className="mt-1.5 text-xs font-medium text-red-600">
                        {errors.email.message}
                      </p>
                    )}
                  </label>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 to-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:from-emerald-700 hover:to-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-65 sm:py-3"
                  >
                    {isSubmitting ? "Sending reset link..." : "Send reset link"}
                  </button>
                </form>

                <div className="mt-4 text-center">
                  <Link
                    to="/admin/login"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 transition hover:text-emerald-700"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Admin Login
                  </Link>
                </div>
              </>
            ) : (
              <div className="text-center">
                <span className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <Mail className="h-8 w-8" />
                </span>

                <h2 className="mt-5 text-[1.5rem] font-bold tracking-[-0.02em] text-slate-900">
                  Check your inbox
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  We sent a password reset link to:
                </p>
                <p className="mt-2 break-all text-sm font-semibold text-emerald-600">
                  {submittedEmail}
                </p>

                <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-left text-xs text-emerald-700">
                  <p className="inline-flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    If you don't see it, check your spam folder.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleTryAnotherEmail}
                  className="mt-4 text-sm font-semibold text-emerald-600 transition hover:text-emerald-700"
                >
                  Try another email
                </button>

                <div className="mt-3">
                  <Link
                    to="/admin/login"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-emerald-600"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Admin Login
                  </Link>
                </div>
              </div>
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

export default AdminForgotPassword;
