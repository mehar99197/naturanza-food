import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { useAuth } from "@/context/AuthContext";
import { sanitizeEmail, sanitizeInput } from "@/lib/sanitize";
import LeftPanel from "@/components/auth/LeftPanel";
import AuthSocialButtons from "@/components/auth/AuthSocialButtons";

const leftPoints = [
  "100% Certified Organic Products",
  "Free Delivery on Orders Over $50",
  "Easy 30-Day Returns",
  "24/7 Customer Support",
];

const getOAuthErrorMessage = (errorCode, providerLabel) => {
  if (errorCode === "oauth_not_configured") {
    return `${providerLabel} OAuth is not configured. Please contact support.`;
  }

  if (errorCode === "auth_failed") {
    return `${providerLabel} authentication failed. Please try again.`;
  }

  if (errorCode === "server_error") {
    return "Server is not available right now. Please try again later.";
  }

  if (errorCode === "no_user") {
    return `Unable to retrieve user information from ${providerLabel}.`;
  }

  return "";
};

const labelClassName = "mb-2 block text-sm font-semibold text-slate-700";
const inputClassName =
  "w-full rounded-2xl border border-green-100 bg-white px-4 py-3 text-[15px] text-slate-800 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-green-600 focus:ring-4 focus:ring-green-100";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loginWithGoogle } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    mode: "onBlur",
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  const [generalError, setGeneralError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const from = location.state?.from?.pathname || "/";
  const isGoogleConfigured = Boolean(
    import.meta.env.VITE_GOOGLE_CLIENT_ID &&
      import.meta.env.VITE_GOOGLE_CLIENT_ID !== "YOUR_GOOGLE_CLIENT_ID_HERE",
  );

  useEffect(() => {
    if (location.state?.error) {
      setGeneralError(location.state.error);
      return;
    }

    const params = new URLSearchParams(location.search);
    const errorCode = params.get("error");
    const providerLabel = "Google";

    if (!errorCode) {
      return;
    }

    const message = getOAuthErrorMessage(errorCode, providerLabel);
    if (message) {
      setGeneralError(message);
    }
  }, [location.state, location.search]);

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
      navigate(from, { replace: true });
    } else {
      setGeneralError(result.message || "Google login failed. Please try again.");
    }

    setGoogleLoading(false);
  };

  const handleGoogleError = () => {
    setGoogleLoading(false);
    setGeneralError("Google authentication failed or was cancelled. Please try again.");
  };

  const onSubmit = async (values) => {
    setGeneralError("");

    const result = await login(
      sanitizeEmail(values.email),
      sanitizeInput(values.password),
      values.rememberMe,
    );

    if (result.success) {
      navigate(from, { replace: true });
      return;
    }

    if (result.isAdmin) {
      setGeneralError(result.message || "Admin accounts must use the admin login page.");
      setTimeout(() => {
        navigate("/admin/login", { state: { email: values.email } });
      }, 1800);
      return;
    }

    setGeneralError(result.message || "Invalid email or password.");
  };

  return (
    <div className="auth-premium-font min-h-screen bg-green-50 lg:h-screen lg:overflow-hidden">
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:block lg:w-[42%] xl:w-[44%]">
        <LeftPanel
          heading="Continue Your Wellness Journey"
          description="Sign in to access your personalized herbal recommendations and orders."
          trustPoints={leftPoints}
        />
      </div>

      <main className="min-h-screen px-4 py-8 sm:px-6 lg:ml-[42%] lg:h-screen lg:overflow-y-auto lg:px-10 xl:ml-[44%] xl:px-14">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[560px] items-center lg:min-h-full">
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
                Secure Login
              </span>
            </div>

            <div>
              <h1 className="text-[1.95rem] font-bold leading-tight tracking-[-0.02em] text-slate-900">
                Welcome back
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Sign in to continue your Naturanza wellness experience.
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

              <label className="block">
                <span className={labelClassName}>Password</span>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    {...register("password", {
                      required: "Password is required",
                      minLength: {
                        value: 6,
                        message: "Password must be at least 6 characters",
                      },
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-slate-700"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password ? (
                  <p className="mt-1.5 text-xs font-medium text-red-600">{errors.password.message}</p>
                ) : null}
              </label>

              <div className="flex items-center justify-between gap-3 pt-0.5">
                <label className="inline-flex items-center gap-2.5 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    {...register("rememberMe")}
                    className="h-4 w-4 rounded border-green-200 text-green-700 focus:ring-green-400"
                  />
                  <span>Remember me</span>
                </label>

                <Link
                  to="/forgot-password"
                  className="text-sm font-semibold text-green-700 transition hover:text-green-800"
                >
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || googleLoading}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-3.5 text-[0.95rem] font-semibold text-white shadow-[0_14px_28px_rgba(5,120,78,0.28)] transition hover:from-green-700 hover:to-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-300 disabled:cursor-not-allowed disabled:opacity-65"
              >
                {isSubmitting ? "Signing in..." : "Sign In"}
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
              Do not have an account?{" "}
              <Link to="/signup" className="font-semibold text-green-700 hover:text-green-800">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Login;
