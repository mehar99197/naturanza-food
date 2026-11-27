import { useState } from "react";
import { useAdminAuth } from "@/context/AdminAuthContext";

export function ConfirmRemoveModal({ admin, onConfirm, onClose }) {
  const { admin: currentAdmin } = useAdminAuth();
  const [loading, setLoading] = useState(false);
  const [stepUp, setStepUp] = useState({ currentPassword: "", otpCode: "" });
  const [needsOtp, setNeedsOtp] = useState(Boolean(currentAdmin?.two_fa_enabled));

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const result = await onConfirm({
        currentPassword: stepUp.currentPassword,
        otpCode: stepUp.otpCode.trim(),
      });
      if (result?.requiresTwoFactor) {
        setNeedsOtp(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="mb-2 text-lg font-bold text-slate-900">Remove Admin Role?</h3>
        <p className="mb-4 text-sm text-slate-600">
          Are you sure you want to remove admin role from{" "}
          <strong className="text-slate-900">{admin?.name}</strong>?
          <br />
          <span className="text-red-600">This action cannot be undone.</span>
        </p>

        <div className="mb-5 space-y-2">
          <input
            type="password"
            autoComplete="current-password"
            value={stepUp.currentPassword}
            onChange={(e) => setStepUp((prev) => ({ ...prev, currentPassword: e.target.value }))}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-red-400 focus:ring-4 focus:ring-red-100"
            placeholder="Confirm your current password"
          />
          {(needsOtp || currentAdmin?.two_fa_enabled) ? (
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={stepUp.otpCode}
              onChange={(e) => setStepUp((prev) => ({ ...prev, otpCode: e.target.value.replace(/\D/g, "") }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-red-400 focus:ring-4 focus:ring-red-100"
              placeholder="6-digit authenticator code"
            />
          ) : null}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={
              loading ||
              !stepUp.currentPassword ||
              ((needsOtp || currentAdmin?.two_fa_enabled) && stepUp.otpCode.length !== 6)
            }
            className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? "Removing..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
