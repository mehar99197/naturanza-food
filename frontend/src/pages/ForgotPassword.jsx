import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowLeft, CheckCircle2, Mail } from "lucide-react";
import { useForm } from "react-hook-form";
import { useAuth } from "@/context/AuthContext";
import LeftPanel from "@/components/auth/LeftPanel";

const leftPoints = [
  "Secure password recovery",
  "Reset link expires in 1 hour",
  "24/7 Support available",
  "Protected account access",
];

const labelClassName = "mb-2 block text-sm font-semibold text-slate-700";
const inputClassName =
  "w-full rounded-2xl border border-green-100 bg-white px-4 py-3 text-[15px] text-slate-800 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-green-600 focus:ring-4 focus:ring-green-100";

const ForgotPassword = () => {
  const { forgotPassword } = useAuth();

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

    const response = await forgotPassword(values.email.trim().toLowerCase());
    if (response.success) {
      setSubmittedEmail(values.email.trim());
      return;
    }

    setGeneralError(response.message || "Unable to send reset link. Please try again.");
  };

  const handleTryAnotherEmail = () => {
    setSubmittedEmail("");
    setGeneralError("");
    reset();
  };

  return (
    <div className="auth-premium-font min-h-screen bg-green-50 lg:h-screen lg:overflow-hidden">
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:block lg:w-[42%] xl:w-[44%]">
        <LeftPanel
          heading="Recover Your Account Securely"
          description="We will send a secure reset link to your email so you can safely access your account again."
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
                Password Reset
              </span>
            </div>

            {!submittedEmail ? (
              <>
                <div>
                  <h1 className="text-[1.95rem] font-bold leading-tight tracking-[-0.02em] text-slate-900">
                    Forgot your password?
                  </h1>
                  <p className="mt-2 text-sm text-slate-600">
                    Enter your email and we will send a secure reset link.
                  </p>
                </div>

                {generalError ? (
                  <div className="mt-5 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>{generalError}</span>
                  </div>
                ) : null}

                <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
                  <label className="block">
                    <span className={labelClassName}>Email address</span>
                    <input
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      {...register("email", {
                        required: "Email is required",
                        pattern: {
                          value: /\S+@\S+\.\S+/,
                          message: "Enter a valid email address",
                        },
                      })}
                      className={`${inputClassName} ${
                        errors.email
                          ? "border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-100"
                          : ""
                      }`}
                    />
                    {errors.email ? (
                      <p className="mt-1.5 text-xs font-medium text-red-600">{errors.email.message}</p>
                    ) : null}
                  </label>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-3.5 text-[0.95rem] font-semibold text-white shadow-[0_14px_28px_rgba(5,120,78,0.28)] transition hover:from-green-700 hover:to-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-300 disabled:cursor-not-allowed disabled:opacity-65"
                  >
                    {isSubmitting ? "Sending reset link..." : "Send reset link"}
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
              <div className="text-center">
                <span className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-700">
                  <Mail className="h-8 w-8" />
                </span>

                <h2 className="mt-5 text-2xl font-bold tracking-[-0.02em] text-slate-900">Check your inbox</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">We sent a password reset link to:</p>
                <p className="mt-2 break-all text-sm font-semibold text-slate-800">{submittedEmail}</p>

                <div className="mt-6 rounded-2xl border border-green-100 bg-green-50 px-4 py-3 text-left text-xs text-green-800">
                  <p className="inline-flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    If you do not see it, check your spam folder.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleTryAnotherEmail}
                  className="mt-5 text-sm font-semibold text-green-700 transition hover:text-green-800"
                >
                  Try another email
                </button>

                <div className="mt-4">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 transition hover:text-green-700"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Sign In
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ForgotPassword;
