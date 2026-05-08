import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Shield,
  Smartphone,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { profileSecurityAPI } from "@/services/api";

const buildPasswordChecks = (password) => {
  const value = String(password || "");

  return {
    length: value.length >= 12,
    uppercase: /[A-Z]/.test(value),
    lowercase: /[a-z]/.test(value),
    number: /[0-9]/.test(value),
    special: /[^A-Za-z0-9]/.test(value),
  };
};

const formatDateTime = (value) => {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

const statusBadgeClasses = {
  success: "bg-green-100 text-green-700 border-green-200",
  failed: "bg-red-100 text-red-700 border-red-200",
};

export default function SecuritySettings() {
  const { user, refreshProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileSecuritySection, setMobileSecuritySection] = useState("password");
  const [showAllMobileHistory, setShowAllMobileHistory] = useState(false);
  const [showAllMobileSessions, setShowAllMobileSessions] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });
  const [showPassword, setShowPassword] = useState({
    currentPassword: false,
    newPassword: false,
    confirmNewPassword: false,
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState({
    type: "",
    message: "",
  });

  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [loginHistory, setLoginHistory] = useState([]);

  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState("");
  const [activeSessions, setActiveSessions] = useState([]);
  const [sessionActionLoading, setSessionActionLoading] = useState("");
  const [sessionFeedback, setSessionFeedback] = useState({
    type: "",
    message: "",
  });
  const [deleteForm, setDeleteForm] = useState({
    confirmationText: "",
    currentPassword: "",
  });
  const [deleteFeedback, setDeleteFeedback] = useState({
    type: "",
    message: "",
  });
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeletePassword, setShowDeletePassword] = useState(false);

  const passwordChecks = useMemo(
    () => buildPasswordChecks(passwordForm.newPassword),
    [passwordForm.newPassword],
  );

  const currentSessionProvider = useMemo(() => {
    const currentSession = activeSessions.find((session) => session.isCurrent);
    return String(currentSession?.browser || "").trim().toLowerCase();
  }, [activeSessions]);

  const isCurrentSessionSocial = currentSessionProvider === "google";

  const hasUserSetPassword = user?.password_set_by_user !== false;
  const requiresCurrentPassword = hasUserSetPassword && !isCurrentSessionSocial;
  const isFirstTimePasswordSetup = user?.password_set_by_user === false;

  const passwordIsStrong = useMemo(
    () => Object.values(passwordChecks).every(Boolean),
    [passwordChecks],
  );

  const logoutOtherDevicesCount = useMemo(
    () => activeSessions.filter((session) => !session.isCurrent).length,
    [activeSessions],
  );

  const mobileHistoryRows = useMemo(
    () => (showAllMobileHistory ? loginHistory : loginHistory.slice(0, 4)),
    [loginHistory, showAllMobileHistory],
  );

  const mobileSessionRows = useMemo(
    () => (showAllMobileSessions ? activeSessions : activeSessions.slice(0, 2)),
    [activeSessions, showAllMobileSessions],
  );

  const mobileSecurityTabs = [
    { key: "password", label: "Password", icon: Lock },
    { key: "history", label: "History", icon: CheckCircle2 },
    { key: "sessions", label: "Sessions", icon: Smartphone },
    { key: "delete", label: "Delete", icon: Trash2 },
  ];

  const loadLoginHistory = async () => {
    try {
      setHistoryLoading(true);
      setHistoryError("");
      const response = await profileSecurityAPI.getLoginHistory();
      setLoginHistory(Array.isArray(response?.items) ? response.items : []);
    } catch (error) {
      setHistoryError(
        error.response?.data?.error || "Could not load login history.",
      );
      setLoginHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadActiveSessions = async () => {
    try {
      setSessionsLoading(true);
      setSessionsError("");
      const response = await profileSecurityAPI.getActiveSessions();
      setActiveSessions(Array.isArray(response?.items) ? response.items : []);
    } catch (error) {
      setSessionsError(
        error.response?.data?.error || "Could not load active sessions.",
      );
      setActiveSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  };

  useEffect(() => {
    void Promise.all([loadLoginHistory(), loadActiveSessions()]);
  }, []);

  const handlePasswordFieldChange = (event) => {
    const { name, value } = event.target;
    setPasswordForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const togglePasswordVisibility = (fieldName) => {
    setShowPassword((prev) => ({
      ...prev,
      [fieldName]: !prev[fieldName],
    }));
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setPasswordFeedback({ type: "", message: "" });

    if (requiresCurrentPassword && !passwordForm.currentPassword) {
      setPasswordFeedback({
        type: "error",
        message: "Current password is required.",
      });
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      setPasswordFeedback({
        type: "error",
        message: "New password and confirm password must match.",
      });
      return;
    }

    if (!passwordIsStrong) {
      setPasswordFeedback({
        type: "error",
        message: "Please use a stronger password that meets all requirements.",
      });
      return;
    }

    try {
      setPasswordLoading(true);
      const payload = {
        newPassword: passwordForm.newPassword,
        confirmNewPassword: passwordForm.confirmNewPassword,
      };

      if (requiresCurrentPassword) {
        payload.currentPassword = passwordForm.currentPassword;
      }

      const response = await profileSecurityAPI.changePassword(payload);
      setPasswordFeedback({
        type: "success",
        message: response?.message || "Password updated successfully.",
      });
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmNewPassword: "",
      });
      setShowPassword({
        currentPassword: false,
        newPassword: false,
        confirmNewPassword: false,
      });
      await refreshProfile();
    } catch (error) {
      const details = error.response?.data?.details;
      const detailedMessage = Array.isArray(details)
        ? details.join(" ")
        : null;

      setPasswordFeedback({
        type: "error",
        message:
          detailedMessage ||
          error.response?.data?.error ||
          "Could not update password.",
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleLogoutDevice = async (sessionId) => {
    try {
      setSessionActionLoading(`device-${sessionId}`);
      setSessionFeedback({ type: "", message: "" });
      const response = await profileSecurityAPI.logoutDevice(sessionId);
      setSessionFeedback({
        type: "success",
        message: response?.message || "Device logged out successfully.",
      });
      await loadActiveSessions();
    } catch (error) {
      setSessionFeedback({
        type: "error",
        message: error.response?.data?.error || "Could not logout device.",
      });
    } finally {
      setSessionActionLoading("");
    }
  };

  const handleLogoutAllOtherDevices = async () => {
    try {
      setSessionActionLoading("all");
      setSessionFeedback({ type: "", message: "" });
      const response = await profileSecurityAPI.logoutAllOtherDevices();
      setSessionFeedback({
        type: "success",
        message:
          response?.message || "Logged out from all other devices successfully.",
      });
      await loadActiveSessions();
    } catch (error) {
      setSessionFeedback({
        type: "error",
        message:
          error.response?.data?.error ||
          "Could not logout all other devices.",
      });
    } finally {
      setSessionActionLoading("");
    }
  };

  const handleDeleteFieldChange = (event) => {
    const { name, value } = event.target;
    setDeleteForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleDeleteAccount = async (event) => {
    event.preventDefault();
    setDeleteFeedback({ type: "", message: "" });

    if (deleteForm.confirmationText.trim().toUpperCase() !== "DELETE") {
      setDeleteFeedback({
        type: "error",
        message: "Please type DELETE to confirm account deletion.",
      });
      return;
    }

    if (!deleteForm.currentPassword) {
      setDeleteFeedback({
        type: "error",
        message: "Current password is required.",
      });
      return;
    }

    const accepted = window.confirm(
      "This will permanently delete your account and all related data. This action cannot be undone. Continue?",
    );

    if (!accepted) {
      return;
    }

    try {
      setDeleteLoading(true);
      await profileSecurityAPI.deleteAccount({
        confirmationText: deleteForm.confirmationText,
        currentPassword: deleteForm.currentPassword,
      });

      await logout();
      navigate("/", {
        replace: true,
        state: { accountDeleted: true },
      });
    } catch (error) {
      setDeleteFeedback({
        type: "error",
        message:
          error.response?.data?.error ||
          "Could not delete account. Please try again.",
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  const renderPasswordInput = (fieldName, label, placeholder) => {
    const isVisible = showPassword[fieldName];

    return (
      <div>
        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
          {label}
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-2.5 sm:pl-3 flex items-center pointer-events-none">
            <Lock className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
          </div>
          <input
            type={isVisible ? "text" : "password"}
            name={fieldName}
            value={passwordForm[fieldName]}
            onChange={handlePasswordFieldChange}
            placeholder={placeholder}
            className="block w-full pl-8 sm:pl-10 pr-10 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          <button
            type="button"
            onClick={() => togglePasswordVisibility(fieldName)}
            className="password-toggle-btn absolute right-2.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center text-gray-400 transition hover:text-green-600 sm:right-3 sm:h-9 sm:w-9"
            aria-label={isVisible ? "Hide password" : "Show password"}
          >
            {isVisible ? (
              <EyeOff className="h-4 w-4 sm:h-5 sm:w-5" />
            ) : (
              <Eye className="h-4 w-4 sm:h-5 sm:w-5" />
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3 sm:space-y-6">
      <section className="md:hidden">
        <div className="scrollbar-hide flex items-center gap-1.5 overflow-x-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-sm">
          {mobileSecurityTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = mobileSecuritySection === tab.key;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setMobileSecuritySection(tab.key)}
                className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  isActive
                    ? tab.key === "delete"
                      ? "bg-red-50 text-red-700"
                      : "bg-green-50 text-green-700"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className={`${mobileSecuritySection !== "password" ? "hidden md:block" : "block"} bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-8 border border-gray-100`}>
        <div className="mb-5 sm:mb-6">
          <h3 className="text-lg sm:text-2xl font-bold text-gray-900">
            Change Password
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {isFirstTimePasswordSetup
              ? "Set a password for your social account so you can login with email too"
              : "Keep your account secure by regularly updating your password"}
          </p>
        </div>

        {!requiresCurrentPassword && (
          <div className="mb-4 sm:mb-6 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg text-xs sm:text-sm border bg-blue-50 border-blue-200 text-blue-700">
            You are signed in using a social account. You can set or update your
            password without entering a current password.
          </div>
        )}

        {passwordFeedback.message && (
          <div
            className={`mb-4 sm:mb-6 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg text-xs sm:text-sm border ${
              passwordFeedback.type === "error"
                ? "bg-red-50 border-red-200 text-red-700"
                : "bg-green-50 border-green-200 text-green-700"
            }`}
          >
            {passwordFeedback.message}
          </div>
        )}

        <form onSubmit={handlePasswordSubmit} className="space-y-4 sm:space-y-5">
          {requiresCurrentPassword &&
            renderPasswordInput(
              "currentPassword",
              "Current Password",
              "Enter your current password",
            )}
          {renderPasswordInput(
            "newPassword",
            "New Password",
            "Enter your new password",
          )}
          {renderPasswordInput(
            "confirmNewPassword",
            "Confirm New Password",
            "Re-enter your new password",
          )}

          <div
            className={`rounded-lg border px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm ${
              passwordIsStrong
                ? "bg-green-50 border-green-200 text-green-700"
                : "bg-amber-50 border-amber-200 text-amber-800"
            }`}
          >
            <p className="font-medium">
              {passwordIsStrong
                ? "Strong password. Your new password meets all security requirements."
                : "Strong password required: use at least 12 characters with uppercase, lowercase, number, and special character."}
            </p>
          </div>

          <div className="pt-1 sm:pt-2">
            <button
              type="submit"
              disabled={passwordLoading}
              className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {passwordLoading ? (
                <>
                  <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                  {isFirstTimePasswordSetup ? "Setting..." : "Updating..."}
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4 sm:h-5 sm:w-5" />
                  {isFirstTimePasswordSetup
                    ? "Set Password"
                    : "Update Password"}
                </>
              )}
            </button>
          </div>
        </form>
      </section>

      <section className={`${mobileSecuritySection !== "history" ? "hidden md:block" : "block"} bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-8 border border-gray-100`}>
        <div className="mb-5 sm:mb-6">
          <h3 className="text-lg sm:text-2xl font-bold text-gray-900">
            Recent Login History
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Last 10 successful and failed login attempts
          </p>
        </div>

        {historyError && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg text-xs sm:text-sm">
            {historyError}
          </div>
        )}

        {historyLoading ? (
          <div className="py-10 flex items-center justify-center text-green-700 font-medium text-sm sm:text-base">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading login history...
          </div>
        ) : loginHistory.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-500">
            No login activity found yet.
          </div>
        ) : (
          <div>
            <div className="space-y-2.5 md:hidden">
              {mobileHistoryRows.map((entry) => (
                <article
                  key={entry.id}
                  className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5"
                >
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-gray-900">
                      {formatDateTime(entry.dateTime)}
                    </p>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                        statusBadgeClasses[entry.status] || statusBadgeClasses.failed
                      }`}
                    >
                      {entry.status === "success" ? "Success" : "Failed"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    {entry.device || "Unknown Device"}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    IP: {entry.ipAddress || "Unknown"} · {entry.location || "Unknown"}
                  </p>
                </article>
              ))}

              {loginHistory.length > 4 ? (
                <button
                  type="button"
                  onClick={() => setShowAllMobileHistory((prev) => !prev)}
                  className="inline-flex min-h-[36px] items-center rounded-lg border border-gray-200 px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  {showAllMobileHistory
                    ? "Show fewer history records"
                    : `Show all ${loginHistory.length} records`}
                </button>
              ) : null}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className="text-left text-xs sm:text-sm font-semibold text-gray-700 py-2.5 sm:py-3 border-b border-gray-200">
                      Date & Time
                    </th>
                    <th className="text-left text-xs sm:text-sm font-semibold text-gray-700 py-2.5 sm:py-3 border-b border-gray-200">
                      Device
                    </th>
                    <th className="text-left text-xs sm:text-sm font-semibold text-gray-700 py-2.5 sm:py-3 border-b border-gray-200">
                      IP Address
                    </th>
                    <th className="text-left text-xs sm:text-sm font-semibold text-gray-700 py-2.5 sm:py-3 border-b border-gray-200">
                      Location
                    </th>
                    <th className="text-left text-xs sm:text-sm font-semibold text-gray-700 py-2.5 sm:py-3 border-b border-gray-200">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loginHistory.map((entry) => (
                    <tr key={entry.id}>
                      <td className="py-2.5 sm:py-3 text-xs sm:text-sm text-gray-700 border-b border-gray-100">
                        {formatDateTime(entry.dateTime)}
                      </td>
                      <td className="py-2.5 sm:py-3 text-xs sm:text-sm text-gray-700 border-b border-gray-100">
                        {entry.device || "Unknown Device"}
                      </td>
                      <td className="py-2.5 sm:py-3 text-xs sm:text-sm text-gray-700 border-b border-gray-100">
                        {entry.ipAddress || "Unknown"}
                      </td>
                      <td className="py-2.5 sm:py-3 text-xs sm:text-sm text-gray-700 border-b border-gray-100">
                        {entry.location || "Unknown"}
                      </td>
                      <td className="py-2.5 sm:py-3 text-xs sm:text-sm border-b border-gray-100">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-semibold ${
                            statusBadgeClasses[entry.status] || statusBadgeClasses.failed
                          }`}
                        >
                          {entry.status === "success" ? "Success" : "Failed"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section className={`${mobileSecuritySection !== "sessions" ? "hidden md:block" : "block"} bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-8 border border-gray-100`}>
        <div className="mb-5 sm:mb-6">
          <h3 className="text-lg sm:text-2xl font-bold text-gray-900">
            Active Devices & Sessions
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Manage your active login sessions
          </p>
        </div>

        {sessionFeedback.message && (
          <div
            className={`mb-4 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg text-xs sm:text-sm border ${
              sessionFeedback.type === "error"
                ? "bg-red-50 border-red-200 text-red-700"
                : "bg-green-50 border-green-200 text-green-700"
            }`}
          >
            {sessionFeedback.message}
          </div>
        )}

        {sessionsError && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg text-xs sm:text-sm">
            {sessionsError}
          </div>
        )}

        {sessionsLoading ? (
          <div className="py-10 flex items-center justify-center text-green-700 font-medium text-sm sm:text-base">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading active sessions...
          </div>
        ) : activeSessions.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-500">
            No active sessions found.
          </div>
        ) : (
          <div>
            <div className="space-y-2.5 md:hidden">
              {mobileSessionRows.map((session) => (
                <article
                  key={session.id}
                  className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {session.device || "Unknown Device"}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {session.browser || "password"} · {session.ipAddress || "Unknown"}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Last active: {formatDateTime(session.lastActive)}
                      </p>
                    </div>

                    {session.isCurrent ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                        <CheckCircle2 className="h-3 w-3" />
                        Current
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleLogoutDevice(session.id)}
                        disabled={sessionActionLoading === `device-${session.id}`}
                        className="inline-flex shrink-0 items-center justify-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                      >
                        {sessionActionLoading === `device-${session.id}` ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <AlertCircle className="h-3.5 w-3.5" />
                        )}
                        Logout
                      </button>
                    )}
                  </div>
                </article>
              ))}

              {activeSessions.length > 2 ? (
                <button
                  type="button"
                  onClick={() => setShowAllMobileSessions((prev) => !prev)}
                  className="inline-flex min-h-[36px] items-center rounded-lg border border-gray-200 px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  {showAllMobileSessions
                    ? "Show fewer sessions"
                    : `Show all ${activeSessions.length} sessions`}
                </button>
              ) : null}

              <div className="pt-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleLogoutAllOtherDevices}
                  disabled={
                    sessionActionLoading === "all" || logoutOtherDevicesCount === 0
                  }
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {sessionActionLoading === "all" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  Logout from All Other Devices
                </button>
              </div>
            </div>

            <div className="hidden space-y-4 md:block">
              {activeSessions.map((session) => (
                <div
                  key={session.id}
                  className="border border-gray-100 rounded-xl p-3 sm:p-4 bg-white"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div className="space-y-1.5 sm:space-y-2">
                      <div className="flex items-center gap-2">
                        <Smartphone className="h-4 w-4 text-gray-500" />
                        <p className="text-sm sm:text-base font-semibold text-gray-900">
                          {session.device || "Unknown Device"}
                        </p>
                        {session.isCurrent && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
                            <CheckCircle2 className="h-3 w-3" />
                            Current Device
                          </span>
                        )}
                      </div>

                      <div className="text-xs sm:text-sm text-gray-600 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                        <p>
                          <span className="font-medium text-gray-700">IP Address:</span>{" "}
                          {session.ipAddress || "Unknown"}
                        </p>
                        <p>
                          <span className="font-medium text-gray-700">Login Time:</span>{" "}
                          {formatDateTime(session.loginTime)}
                        </p>
                        <p>
                          <span className="font-medium text-gray-700">Last Active:</span>{" "}
                          {formatDateTime(session.lastActive)}
                        </p>
                        <p>
                          <span className="font-medium text-gray-700">Provider:</span>{" "}
                          {session.browser || "password"}
                        </p>
                      </div>
                    </div>

                    {!session.isCurrent && (
                      <button
                        type="button"
                        onClick={() => handleLogoutDevice(session.id)}
                        disabled={sessionActionLoading === `device-${session.id}`}
                        className="inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {sessionActionLoading === `device-${session.id}` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <AlertCircle className="h-4 w-4" />
                        )}
                        Logout
                      </button>
                    )}
                  </div>
                </div>
              ))}

              <div className="pt-2 sm:pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleLogoutAllOtherDevices}
                  disabled={
                    sessionActionLoading === "all" || logoutOtherDevicesCount === 0
                  }
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {sessionActionLoading === "all" ? (
                    <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                  ) : (
                    <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                  )}
                  Logout from All Other Devices
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className={`${mobileSecuritySection !== "delete" ? "hidden md:block" : "block"} bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-8 border border-red-200`}>
        <div className="mb-5 sm:mb-6">
          <h3 className="text-lg sm:text-2xl font-bold text-red-700">
            Delete Account
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Permanently remove your account and all related data from the database.
          </p>
        </div>

        <div className="rounded-lg border border-red-200 bg-red-50 px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm text-red-700">
          <p className="font-semibold">Before you continue:</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4">
            <li>Your profile, sessions, wishlist, and related records will be removed.</li>
            <li>This action is permanent and cannot be undone.</li>
          </ul>
        </div>

        {deleteFeedback.message && (
          <div
            className={`mt-4 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg text-xs sm:text-sm border ${
              deleteFeedback.type === "error"
                ? "bg-red-50 border-red-200 text-red-700"
                : "bg-green-50 border-green-200 text-green-700"
            }`}
          >
            {deleteFeedback.message}
          </div>
        )}

        <form onSubmit={handleDeleteAccount} className="mt-4 sm:mt-5 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                Type DELETE to confirm
              </label>
              <input
                type="text"
                name="confirmationText"
                value={deleteForm.confirmationText}
                onChange={handleDeleteFieldChange}
                placeholder="DELETE"
                autoComplete="off"
                className="block w-full px-3 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                Current Password (required)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-2.5 sm:pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
                </div>
                <input
                  type={showDeletePassword ? "text" : "password"}
                  name="currentPassword"
                  value={deleteForm.currentPassword}
                  onChange={handleDeleteFieldChange}
                  placeholder="Enter current password"
                  className="block w-full pl-8 sm:pl-10 pr-10 py-2.5 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowDeletePassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 pr-2.5 sm:pr-3 flex items-center text-gray-400 hover:text-red-600"
                  aria-label={showDeletePassword ? "Hide password" : "Show password"}
                >
                  {showDeletePassword ? (
                    <EyeOff className="h-4 w-4 sm:h-5 sm:w-5" />
                  ) : (
                    <Eye className="h-4 w-4 sm:h-5 sm:w-5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={deleteLoading}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {deleteLoading ? (
              <>
                <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                Delete Account Permanently
              </>
            )}
          </button>
        </form>
      </section>
    </div>
  );
}
