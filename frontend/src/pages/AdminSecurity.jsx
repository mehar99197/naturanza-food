import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Globe,
  History,
  KeyRound,
  Loader2,
  Lock,
  MonitorSmartphone,
  PlusCircle,
  Shield,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserCog,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { AdminLayout } from "@/components/AdminLayout";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { adminSecurityAPI } from "@/services/api";

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const feedbackStyles = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-red-200 bg-red-50 text-red-700",
};

const Feedback = ({ feedback }) => {
  if (!feedback?.message) return null;
  const Icon = feedback.type === "success" ? CheckCircle2 : AlertCircle;
  return (
    <div
      className={`mt-3 flex items-start gap-2 rounded-xl border px-3 py-2 text-xs font-medium sm:text-sm ${feedbackStyles[feedback.type] || feedbackStyles.error}`}
    >
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <span>{feedback.message}</span>
    </div>
  );
};

const inputClasses =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100";

const primaryButtonClasses =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-emerald-600 hover:to-green-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60";

const dangerButtonClasses =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-100 disabled:cursor-not-allowed disabled:opacity-60";

export function AdminSecurity() {
  const { isSuperAdmin } = useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [overview, setOverview] = useState(null);

  const [setupData, setSetupData] = useState(null);
  const [setupCode, setSetupCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState(null);
  const [disableForm, setDisableForm] = useState({ password: "", code: "" });
  const [regenCode, setRegenCode] = useState("");
  const [twoFactorLoading, setTwoFactorLoading] = useState("");
  const [twoFactorFeedback, setTwoFactorFeedback] = useState({ type: "", message: "" });

  const [sessionActionLoading, setSessionActionLoading] = useState("");
  const [sessionFeedback, setSessionFeedback] = useState({ type: "", message: "" });

  const [allowlist, setAllowlist] = useState(null);
  const [allowlistForm, setAllowlistForm] = useState({ label: "", cidr: "" });
  const [allowlistLoading, setAllowlistLoading] = useState("");
  const [allowlistFeedback, setAllowlistFeedback] = useState({ type: "", message: "" });

  const loadOverview = useCallback(async () => {
    try {
      const data = await adminSecurityAPI.getOverview();
      setOverview(data);
      setError("");
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to load security overview.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAllowlist = useCallback(async () => {
    if (!isSuperAdmin) return;
    try {
      const data = await adminSecurityAPI.getIpAllowlist();
      setAllowlist(data);
    } catch {
      setAllowlist(null);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    void loadOverview();
    void loadAllowlist();
  }, [loadOverview, loadAllowlist]);

  const handleStartSetup = async () => {
    try {
      setTwoFactorLoading("setup");
      setTwoFactorFeedback({ type: "", message: "" });
      setRecoveryCodes(null);
      const data = await adminSecurityAPI.setupTwoFactor();
      setSetupData(data);
      setSetupCode("");
    } catch (err) {
      setTwoFactorFeedback({
        type: "error",
        message: err?.response?.data?.error || "Could not start 2FA setup.",
      });
    } finally {
      setTwoFactorLoading("");
    }
  };

  const handleEnableTwoFactor = async (event) => {
    event.preventDefault();
    try {
      setTwoFactorLoading("enable");
      setTwoFactorFeedback({ type: "", message: "" });
      const data = await adminSecurityAPI.enableTwoFactor(setupCode.trim());
      setRecoveryCodes(data.recoveryCodes || []);
      setSetupData(null);
      setSetupCode("");
      setTwoFactorFeedback({
        type: "success",
        message: "Two-factor authentication enabled. Save your recovery codes now — they are shown only once.",
      });
      await loadOverview();
    } catch (err) {
      setTwoFactorFeedback({
        type: "error",
        message: err?.response?.data?.error || "Could not enable 2FA.",
      });
    } finally {
      setTwoFactorLoading("");
    }
  };

  const copyRecoveryCodes = async () => {
    try {
      await navigator.clipboard.writeText((recoveryCodes || []).join("\n"));
      setTwoFactorFeedback({ type: "success", message: "Recovery codes copied to clipboard." });
    } catch {
      setTwoFactorFeedback({ type: "error", message: "Copy failed. Please select and copy the codes manually." });
    }
  };

  const handleDisableTwoFactor = async (event) => {
    event.preventDefault();
    try {
      setTwoFactorLoading("disable");
      setTwoFactorFeedback({ type: "", message: "" });
      await adminSecurityAPI.disableTwoFactor({
        password: disableForm.password,
        code: disableForm.code.trim(),
      });
      setDisableForm({ password: "", code: "" });
      setRecoveryCodes(null);
      setTwoFactorFeedback({ type: "success", message: "Two-factor authentication disabled. Other sessions were signed out." });
      await loadOverview();
    } catch (err) {
      setTwoFactorFeedback({
        type: "error",
        message: err?.response?.data?.error || "Could not disable 2FA.",
      });
    } finally {
      setTwoFactorLoading("");
    }
  };

  const handleRegenerateCodes = async (event) => {
    event.preventDefault();
    try {
      setTwoFactorLoading("regen");
      setTwoFactorFeedback({ type: "", message: "" });
      const data = await adminSecurityAPI.regenerateRecoveryCodes(regenCode.trim());
      setRecoveryCodes(data.recoveryCodes || []);
      setRegenCode("");
      setTwoFactorFeedback({ type: "success", message: "New recovery codes generated. Old codes no longer work." });
      await loadOverview();
    } catch (err) {
      setTwoFactorFeedback({
        type: "error",
        message: err?.response?.data?.error || "Could not regenerate recovery codes.",
      });
    } finally {
      setTwoFactorLoading("");
    }
  };

  const handleRevokeSession = async (sessionId) => {
    try {
      setSessionActionLoading(`session-${sessionId}`);
      setSessionFeedback({ type: "", message: "" });
      const response = await adminSecurityAPI.revokeSession(sessionId);
      setSessionFeedback({ type: "success", message: response?.message || "Session revoked." });
      await loadOverview();
    } catch (err) {
      setSessionFeedback({
        type: "error",
        message: err?.response?.data?.error || "Could not revoke session.",
      });
    } finally {
      setSessionActionLoading("");
    }
  };

  const handleRevokeOthers = async () => {
    try {
      setSessionActionLoading("all");
      setSessionFeedback({ type: "", message: "" });
      const response = await adminSecurityAPI.revokeOtherSessions();
      setSessionFeedback({
        type: "success",
        message: response?.message || "All other sessions revoked.",
      });
      await loadOverview();
    } catch (err) {
      setSessionFeedback({
        type: "error",
        message: err?.response?.data?.error || "Could not revoke other sessions.",
      });
    } finally {
      setSessionActionLoading("");
    }
  };

  const handleAddAllowlistEntry = async (event) => {
    event.preventDefault();
    try {
      setAllowlistLoading("add");
      setAllowlistFeedback({ type: "", message: "" });
      await adminSecurityAPI.addIpAllowlistEntry({
        label: allowlistForm.label.trim(),
        cidr: allowlistForm.cidr.trim(),
      });
      setAllowlistForm({ label: "", cidr: "" });
      setAllowlistFeedback({ type: "success", message: "Allowlist entry added. It is enforced immediately." });
      await loadAllowlist();
    } catch (err) {
      setAllowlistFeedback({
        type: "error",
        message: err?.response?.data?.error || "Could not add allowlist entry.",
      });
    } finally {
      setAllowlistLoading("");
    }
  };

  const handleDeleteAllowlistEntry = async (entry) => {
    const confirmed = window.confirm(
      `Remove ${entry.cidr} (${entry.label}) from the allowlist? If it is the last entry, the restriction turns off.`,
    );
    if (!confirmed) return;
    try {
      setAllowlistLoading(`delete-${entry.id}`);
      setAllowlistFeedback({ type: "", message: "" });
      await adminSecurityAPI.deleteIpAllowlistEntry(entry.id);
      setAllowlistFeedback({ type: "success", message: "Allowlist entry removed." });
      await loadAllowlist();
    } catch (err) {
      setAllowlistFeedback({
        type: "error",
        message: err?.response?.data?.error || "Could not remove allowlist entry.",
      });
    } finally {
      setAllowlistLoading("");
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      </AdminLayout>
    );
  }

  if (error && !overview) {
    return (
      <AdminLayout>
        <div className="mx-auto w-full max-w-[1240px]">
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const account = overview?.account || {};
  const sessions = overview?.sessions || [];
  const loginAttempts = overview?.loginAttempts || [];
  const permissionChanges = overview?.permissionChanges || [];
  const auditLogs = overview?.auditLogs || [];

  return (
    <AdminLayout>
      <div className="mx-auto w-full max-w-[1240px] space-y-4 sm:space-y-6">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900 sm:text-2xl">
              <Shield className="h-6 w-6 text-emerald-600" />
              Security Center
            </h1>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">
              Two-factor authentication, active sessions, login activity, and access controls for your admin account.
            </p>
          </div>
          <span
            className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${
              account.twoFactorEnabled
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            {account.twoFactorEnabled ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldOff className="h-3.5 w-3.5" />}
            2FA {account.twoFactorEnabled ? "Enabled" : "Disabled"}
          </span>
        </header>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <History className="h-4 w-4 text-emerald-600" />
              Last login
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-900">{formatDateTime(account.lastLogin)}</p>
            <p className="mt-1 text-xs text-slate-500">
              {[account.lastLoginDevice, account.lastLoginIp, account.lastLoginLocation].filter(Boolean).join(" · ") || "No login recorded yet"}
            </p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <MonitorSmartphone className="h-4 w-4 text-emerald-600" />
              Active sessions
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{sessions.length}</p>
            <p className="mt-1 text-xs text-slate-500">Devices currently signed in</p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Lock className="h-4 w-4 text-emerald-600" />
              Password changed
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-900">{formatDateTime(account.passwordLastChanged)}</p>
            <p className="mt-1 text-xs text-slate-500">Last account update timestamp</p>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <KeyRound className="h-4 w-4 text-emerald-600" />
              Recovery codes
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {account.twoFactorEnabled ? account.recoveryCodesRemaining : "-"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {account.twoFactorEnabled
                ? `Unused codes remaining${account.twoFactorEnabledAt ? ` · enabled ${formatDateTime(account.twoFactorEnabledAt)}` : ""}`
                : "Enable 2FA to get recovery codes"}
            </p>
          </article>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900 sm:text-lg">Two-Factor Authentication</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            A 6-digit code from your authenticator app is required at every admin sign-in, in addition to your password.
          </p>

          <Feedback feedback={twoFactorFeedback} />

          {recoveryCodes?.length ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">
                Save these recovery codes now. Each works once, and they will not be shown again.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {recoveryCodes.map((code) => (
                  <code
                    key={code}
                    className="rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-center font-mono text-xs font-semibold text-slate-800"
                  >
                    {code}
                  </code>
                ))}
              </div>
              <button
                type="button"
                onClick={copyRecoveryCodes}
                className="mt-3 inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-white px-3.5 py-2 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy codes
              </button>
            </div>
          ) : null}

          {!account.twoFactorEnabled && !setupData ? (
            <div className="mt-4">
              <button
                type="button"
                onClick={handleStartSetup}
                disabled={twoFactorLoading === "setup"}
                className={primaryButtonClasses}
              >
                {twoFactorLoading === "setup" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                Set up two-factor authentication
              </button>
            </div>
          ) : null}

          {!account.twoFactorEnabled && setupData ? (
            <form onSubmit={handleEnableTwoFactor} className="mt-4 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[auto_1fr]">
              <div className="mx-auto rounded-xl border border-slate-200 bg-white p-3">
                <QRCodeSVG value={setupData.otpauthUrl} size={148} level="M" />
              </div>
              <div className="space-y-3">
                <p className="text-xs text-slate-600 sm:text-sm">
                  Scan this QR code with Google Authenticator, Authy, or any TOTP app — or enter the key manually:
                </p>
                <code className="block break-all rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs font-semibold text-slate-800">
                  {setupData.manualSecret}
                </code>
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-600">6-digit code</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={setupCode}
                    onChange={(event) => setSetupCode(event.target.value.replace(/\D/g, ""))}
                    className={inputClasses}
                    placeholder="123456"
                  />
                </label>
                <button
                  type="submit"
                  disabled={twoFactorLoading === "enable" || setupCode.length !== 6}
                  className={primaryButtonClasses}
                >
                  {twoFactorLoading === "enable" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  Verify &amp; enable
                </button>
              </div>
            </form>
          ) : null}

          {account.twoFactorEnabled ? (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <form onSubmit={handleRegenerateCodes} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-800">Regenerate recovery codes</p>
                <p className="mt-1 text-xs text-slate-500">Enter a current authenticator code to issue fresh recovery codes.</p>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={regenCode}
                  onChange={(event) => setRegenCode(event.target.value.replace(/\D/g, ""))}
                  className={`${inputClasses} mt-3`}
                  placeholder="123456"
                />
                <button
                  type="submit"
                  disabled={twoFactorLoading === "regen" || regenCode.length !== 6}
                  className={`${primaryButtonClasses} mt-3`}
                >
                  {twoFactorLoading === "regen" ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                  Regenerate
                </button>
              </form>

              <form onSubmit={handleDisableTwoFactor} className="rounded-xl border border-red-200 bg-red-50/60 p-4">
                <p className="text-sm font-semibold text-red-800">Disable two-factor authentication</p>
                <p className="mt-1 text-xs text-red-600">Requires your password plus an authenticator or recovery code. Other sessions are signed out.</p>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={disableForm.password}
                  onChange={(event) => setDisableForm((prev) => ({ ...prev, password: event.target.value }))}
                  className={`${inputClasses} mt-3`}
                  placeholder="Account password"
                />
                <input
                  type="text"
                  autoComplete="one-time-code"
                  value={disableForm.code}
                  onChange={(event) => setDisableForm((prev) => ({ ...prev, code: event.target.value.trimStart() }))}
                  className={`${inputClasses} mt-2`}
                  placeholder="Authenticator or recovery code"
                />
                <button
                  type="submit"
                  disabled={twoFactorLoading === "disable" || !disableForm.password || !disableForm.code}
                  className={`${dangerButtonClasses} mt-3`}
                >
                  {twoFactorLoading === "disable" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
                  Disable 2FA
                </button>
              </form>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <MonitorSmartphone className="h-5 w-5 text-emerald-600" />
              <h2 className="text-base font-bold text-slate-900 sm:text-lg">Active Sessions</h2>
            </div>
            <button
              type="button"
              onClick={handleRevokeOthers}
              disabled={sessionActionLoading === "all" || sessions.filter((s) => !s.isCurrent).length === 0}
              className={dangerButtonClasses}
            >
              {sessionActionLoading === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldOff className="h-4 w-4" />}
              Sign out all other devices
            </button>
          </div>

          <Feedback feedback={sessionFeedback} />

          <div className="mt-4 space-y-2">
            {sessions.length === 0 ? (
              <p className="text-sm text-slate-500">No active sessions found.</p>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-800">
                      {session.device}
                      {session.isCurrent ? (
                        <span className="rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                          This device
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {session.ipAddress} · {session.provider} · active {formatDateTime(session.lastActive)} · signed in {formatDateTime(session.loginTime)}
                    </p>
                  </div>
                  {!session.isCurrent ? (
                    <button
                      type="button"
                      onClick={() => handleRevokeSession(session.id)}
                      disabled={sessionActionLoading === `session-${session.id}`}
                      className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                    >
                      {sessionActionLoading === `session-${session.id}` ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      Revoke
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900 sm:text-lg">Recent Login Attempts</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            Successful and blocked sign-in events for this admin account. Alerts are also emailed to you.
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3 font-semibold">Status</th>
                  <th className="py-2 pr-3 font-semibold">Time</th>
                  <th className="py-2 pr-3 font-semibold">Device</th>
                  <th className="py-2 pr-3 font-semibold">IP</th>
                  <th className="py-2 pr-3 font-semibold">Location</th>
                  <th className="py-2 font-semibold">Detail</th>
                </tr>
              </thead>
              <tbody>
                {loginAttempts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-slate-500">
                      No login activity recorded yet.
                    </td>
                  </tr>
                ) : (
                  loginAttempts.map((attempt) => (
                    <tr key={attempt.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-2.5 pr-3">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                            attempt.status === "success"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-red-200 bg-red-50 text-red-700"
                          }`}
                        >
                          {attempt.status}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-slate-700">{formatDateTime(attempt.created_at)}</td>
                      <td className="py-2.5 pr-3 text-slate-600">{attempt.device_name || "Unknown"}</td>
                      <td className="py-2.5 pr-3 font-mono text-xs text-slate-600">{attempt.ip_address || "-"}</td>
                      <td className="py-2.5 pr-3 text-slate-600">{attempt.location_label || "-"}</td>
                      <td className="py-2.5 text-slate-500">{attempt.failure_reason || attempt.login_provider || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="flex items-center gap-2">
              <UserCog className="h-5 w-5 text-emerald-600" />
              <h2 className="text-base font-bold text-slate-900 sm:text-lg">Permission &amp; Role Changes</h2>
            </div>
            <div className="mt-4 space-y-2">
              {permissionChanges.length === 0 ? (
                <p className="text-sm text-slate-500">No permission changes recorded.</p>
              ) : (
                permissionChanges.map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
                    <p className="text-xs font-medium text-slate-800 sm:text-sm">{entry.action}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {formatDateTime(entry.created_at)}{entry.ip_address ? ` · ${entry.ip_address}` : ""}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-emerald-600" />
              <h2 className="text-base font-bold text-slate-900 sm:text-lg">Recent Admin Activity</h2>
            </div>
            <div className="mt-4 space-y-2">
              {auditLogs.length === 0 ? (
                <p className="text-sm text-slate-500">No audit events recorded yet.</p>
              ) : (
                auditLogs.map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
                    <p className="text-xs font-medium text-slate-800 sm:text-sm">{entry.action}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {formatDateTime(entry.created_at)}{entry.ip_address ? ` · ${entry.ip_address}` : ""}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {isSuperAdmin ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-emerald-600" />
              <h2 className="text-base font-bold text-slate-900 sm:text-lg">Super Admin IP Allowlist</h2>
            </div>
            <p className="mt-1 text-xs text-slate-500 sm:text-sm">
              When at least one entry exists, super admin sign-in is only possible from these IPs/CIDR ranges. Staff logins are unaffected.
              {allowlist?.currentIp ? (
                <>
                  {" "}Your current IP: <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold">{allowlist.currentIp}</code>
                </>
              ) : null}
            </p>

            <Feedback feedback={allowlistFeedback} />

            <form onSubmit={handleAddAllowlistEntry} className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input
                type="text"
                value={allowlistForm.label}
                onChange={(event) => setAllowlistForm((prev) => ({ ...prev, label: event.target.value }))}
                className={inputClasses}
                placeholder="Label (e.g. Office)"
                maxLength={120}
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={allowlistForm.cidr}
                  onChange={(event) => setAllowlistForm((prev) => ({ ...prev, cidr: event.target.value }))}
                  className={inputClasses}
                  placeholder="203.0.113.10 or 203.0.113.0/24"
                />
                {allowlist?.currentIp ? (
                  <button
                    type="button"
                    onClick={() => setAllowlistForm((prev) => ({ ...prev, cidr: allowlist.currentIp }))}
                    className="whitespace-nowrap rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                  >
                    Use my IP
                  </button>
                ) : null}
              </div>
              <button
                type="submit"
                disabled={allowlistLoading === "add" || !allowlistForm.label.trim() || !allowlistForm.cidr.trim()}
                className={primaryButtonClasses}
              >
                {allowlistLoading === "add" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
                Add
              </button>
            </form>

            <div className="mt-4 space-y-2">
              {(allowlist?.items || []).length === 0 ? (
                <p className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-xs text-slate-500 sm:text-sm">
                  Allowlist is empty — super admin sign-in is currently allowed from any network. Add your own IP first; the server rejects a first entry that does not cover your current IP.
                </p>
              ) : (
                allowlist.items.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{entry.label}</p>
                      <p className="mt-0.5 font-mono text-xs text-slate-500">
                        {entry.cidr} · added {formatDateTime(entry.created_at)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteAllowlistEntry(entry)}
                      disabled={allowlistLoading === `delete-${entry.id}`}
                      className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                    >
                      {allowlistLoading === `delete-${entry.id}` ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        ) : null}
      </div>
    </AdminLayout>
  );
}






