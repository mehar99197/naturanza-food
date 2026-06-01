import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { useAuth } from "@/context/AuthContext";
import { sanitizeEmail, sanitizeInput } from "@/lib/sanitize";
import LeftPanel from "@/components/auth/LeftPanel";
import AuthSocialButtons from "@/components/auth/AuthSocialButtons";
import { NoIndexSEO } from "@/components/SEO";

const leftPoints = [
  "Exclusive Member Discounts",
  "Personalized Product Recommendations",
  "Order Tracking & History",
  "Priority Customer Support",
];

const getPasswordStrength = (password) => {
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

const strengthLabels = ["Very weak", "Weak", "Fair", "Good", "Strong"];
const strengthColors = [
  "bg-red-500",
  "bg-orange-500",
  "bg-yellow-500",
  "bg-sky-500",
  "bg-green-600",
];

const labelClassName = "mb-2 block text-sm font-semibold text-slate-700";
const inputClassName =
  "w-full rounded-2xl border border-green-100 bg-white px-4 py-3 text-[15px] text-slate-800 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-green-600 focus:ring-4 focus:ring-green-100";

const Register = () => {
  const navigate = useNavigate();
  const { register: registerUser, loginWithGoogle } = useAuth();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    mode: "onBlur",
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
      acceptedTerms: false,
    },
  });

  const [generalError, setGeneralError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordValue = watch("password", "");
  const confirmPasswordValue = watch("confirmPassword", "");
  const strengthScore = getPasswordStrength(passwordValue);

  const allowDevGoogle =
    String(import.meta.env.VITE_GOOGLE_ALLOW_DEV || "")
      .trim()
      .toLowerCase() === "true";
  const isGoogleConfigured = Boolean(
    import.meta.env.VITE_GOOGLE_CLIENT_ID &&
      import.meta.env.VITE_GOOGLE_CLIENT_ID !== "YOUR_GOOGLE_CLIENT_ID_HERE" &&
      (!import.meta.env.DEV || allowDevGoogle),
  );

  const handleGoogleSuccess = async (credentialResponse) => {
    const idToken = credentialResponse?.credential;
    if (!idToken) {
      setGeneralError("Google authentication did not return a valid token.");
      return;
    }

    setGeneralError("");
    setGoogleLoading(true);

    const result = await loginWithGoogle(idToken);
    if (result.success) {
      navigate("/", { replace: true });
    } else {
      setGeneralError(result.message || "Google signup failed. Please try again.");
    }

    setGoogleLoading(false);
  };

  const handleGoogleError = () => {
    setGoogleLoading(false);
    setGeneralError("Google authentication failed or was cancelled. Please try again.");
  };

  const onSubmit = async (values) => {
    setGeneralError("");

    const payload = {
      name: sanitizeInput(values.fullName.trim()),
      email: sanitizeEmail(values.email),
      password: values.password,
    };

    const result = await registerUser(payload);
    if (result.success) {
      // New accounts must confirm a 6-digit code emailed to them before they're active.
      if (result.requiresVerification) {
        navigate("/verify-email", { state: { email: result.email || payload.email } });
        return;
      }
      navigate("/");
      return;
    }

    setGeneralError(result.message || "Registration failed. Please try again.");
  };

  return (
    <>
      <NoIndexSEO title="Create Account" />
    <div className="auth-premium-font min-h-screen bg-green-50 overflow-y-auto lg:h-screen lg:overflow-hidden">
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:block lg:w-[42%] xl:w-[44%]">
        <LeftPanel
          heading="Start Your Natural Wellness Journey"
          description="Join thousands who trust Naturanza for pure organic herbal products."
          trustPoints={leftPoints}
        />
      </div>

      <main className="min-h-screen px-4 py-8 sm:px-6 lg:ml-[42%] lg:h-screen lg:overflow-y-auto lg:px-10 xl:ml-[44%] xl:px-14">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[580px] items-center lg:min-h-full">
          <div className="w-full rounded-3xl border border-green-100 bg-white p-6 shadow-[0_24px_55px_rgba(7,43,24,0.12)] sm:p-8">
            <div className="mb-6 flex items-center justify-between">
              <Link
                to="/"
                aria-label="Back to home"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-green-100 bg-white text-green-700 transition hover:border-green-200 hover:bg-green-50"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>

              <span className="rounded-full border border-green-100 bg-green-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-green-700">
                New Account
              </span>
            </div>

            <div>
              <h1 className="text-[1.95rem] font-bold leading-tight tracking-[-0.02em] text-slate-900">
                Create your account
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Build your profile and unlock personalized herbal recommendations.
              </p>
            </div>

            {generalError ? (
              <div className="mt-5 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{generalError}</span>
              </div>
            ) : null}

            <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate>
              <label htmlFor="fullName" className="block">
                <span className={labelClassName}>Full name</span>
                <input
                  id="fullName"
                  type="text"
                  autoComplete="name"
                  placeholder="John Doe"
                  {...register("fullName", {
                    required: "Full name is required",
                    minLength: {
                      value: 2,
                      message: "Name must be at least 2 characters",
                    },
                  })}
                  className={`${inputClassName} ${
                    errors.fullName
                      ? "border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-100"
                      : ""
                  }`}
                />
                {errors.fullName ? (
                  <p className="mt-1.5 text-xs font-medium text-red-600">{errors.fullName.message}</p>
                ) : null}
              </label>

              <label htmlFor="email" className="block">
                <span className={labelClassName}>Email address</span>
                <input
                  id="email"
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

              <label htmlFor="password" className="block">
                <span className={labelClassName}>Password</span>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="At least 12 characters"
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
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password ? (
                  <p className="mt-1.5 text-xs font-medium text-red-600">{errors.password.message}</p>
                ) : null}

                {passwordValue ? (
                  <div className="mt-2.5">
                    <div className="mb-1.5 flex gap-1">
                      {[0, 1, 2, 3].map((index) => (
                        <span
                          key={index}
                          className={`h-1.5 flex-1 rounded-full ${
                            index <= strengthScore - 1 ? strengthColors[strengthScore] : "bg-green-100"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-xs font-medium text-slate-600">
                      {strengthLabels[strengthScore]} password
                    </p>
                  </div>
                ) : null}
              </label>

              <label htmlFor="confirmPassword" className="block">
                <span className={labelClassName}>Confirm password</span>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Re-enter password"
                    {...register("confirmPassword", {
                      required: "Please confirm your password",
                      validate: (value) => value === passwordValue || "Passwords do not match",
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
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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

              <div>
                <label className="inline-flex items-start gap-2.5 text-sm leading-relaxed text-slate-600">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-green-200 text-green-700 focus:ring-green-400"
                    {...register("acceptedTerms", {
                      required: "You must accept the terms to continue",
                    })}
                  />
                  <span>
                    I agree to the{" "}
                    <Link to="/terms" className="font-semibold text-green-700 hover:text-green-800">
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link to="/privacy" className="font-semibold text-green-700 hover:text-green-800">
                      Privacy Policy
                    </Link>
                  </span>
                </label>
                {errors.acceptedTerms ? (
                  <p className="mt-1.5 text-xs font-medium text-red-600">
                    {errors.acceptedTerms.message}
                  </p>
                ) : null}
              </div>

              <button
                type="submit"
                disabled={isSubmitting || googleLoading}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-3.5 text-[0.95rem] font-semibold text-white shadow-[0_14px_28px_rgba(5,120,78,0.28)] transition hover:from-green-700 hover:to-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-300 disabled:cursor-not-allowed disabled:opacity-65"
              >
                {isSubmitting ? "Creating account..." : "Sign Up"}
              </button>

              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-green-100" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-3 text-xs font-medium text-slate-500">or</span>
                </div>
              </div>

              <AuthSocialButtons
                showDivider={false}
                isGoogleConfigured={isGoogleConfigured}
                onGoogleSuccess={handleGoogleSuccess}
                onGoogleError={handleGoogleError}
                googleLoading={googleLoading}
                buttonLabel="Continue with Google"
              />
            </form>

            <p className="mt-6 text-center text-sm text-slate-600">
              Already have an account?{" "}
              <Link to="/login" className="font-semibold text-green-700 hover:text-green-800">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
    </>
  );
};

export default Register;
