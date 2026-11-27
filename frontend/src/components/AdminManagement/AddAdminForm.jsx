import { useState } from "react";
import { UserPlus } from "lucide-react";
import { adminAPI } from "@/services/api";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { toast } from "sonner";
import { PERMISSION_LIST, PERMISSION_GROUPS } from "@/config/adminPermissions";

export function AddAdminForm({ onSuccess }) {
  const { admin: currentAdmin } = useAdminAuth();
  const [loading, setLoading] = useState(false);
  const [stepUp, setStepUp] = useState({ currentPassword: "", otpCode: "" });
  const [needsOtp, setNeedsOtp] = useState(Boolean(currentAdmin?.two_fa_enabled));
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    role: "staff_admin",
    permissions: [],
  });

  const togglePermission = (permId) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permId)
        ? prev.permissions.filter((p) => p !== permId)
        : [...prev.permissions, permId],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = new FormData();
      data.append("full_name", formData.full_name);
      data.append("email", formData.email);
      if (formData.phone) data.append("phone", formData.phone);
      data.append("role", formData.role);
      data.append("permissions", JSON.stringify(formData.permissions));

      const response = await adminAPI.createAdmin(data, {
        currentPassword: stepUp.currentPassword,
        otpCode: stepUp.otpCode.trim(),
      });

      if (response?.emailStatus === "failed") {
        toast.error(response?.message || "Admin created, but reset email failed to send.");
      } else {
        toast.success(response?.message || "Admin created successfully! Reset email sent.");
      }
      
      setFormData({
        full_name: "",
        email: "",
        phone: "",
        role: "staff_admin",
        permissions: [],
      });
      setStepUp({ currentPassword: "", otpCode: "" });

      if (onSuccess) onSuccess();
    } catch (error) {
      if (error?.response?.data?.requiresTwoFactor) {
        setNeedsOtp(true);
      }
      toast.error(error?.response?.data?.error || "Failed to create admin");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-[0_14px_30px_rgba(15,64,28,0.08)] sm:p-6">
      <div className="mb-4 inline-flex items-center gap-2 text-lg font-bold text-slate-900">
        <UserPlus className="h-5 w-5 text-slate-500" />
        Add New Admin
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          required
          value={formData.full_name}
          onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
          className="w-full rounded-xl border border-emerald-100 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-all duration-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          placeholder="Full name *"
        />

        <input
          type="email"
          required
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="w-full rounded-xl border border-emerald-100 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-all duration-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          placeholder="Email address *"
        />

        <input
          type="text"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          className="w-full rounded-xl border border-emerald-100 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-all duration-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          placeholder="Phone (optional)"
        />

        <select
          value={formData.role}
          onChange={(e) => setFormData({ ...formData, role: e.target.value })}
          className="w-full rounded-xl border border-emerald-100 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-all duration-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
        >
          <option value="staff_admin">Staff Admin</option>
          <option value="super_admin">Super Admin</option>
        </select>

        {formData.role === "staff_admin" && (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-slate-600">Permissions</p>
                <p className="text-[11px] text-slate-500">
                  Only ticked sections will be visible in this staff admin's sidebar.
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      permissions: PERMISSION_LIST.map((p) => p.id),
                    }))
                  }
                  className="rounded-md border border-emerald-200 bg-white px-2 py-1 text-[10px] font-semibold text-emerald-700 transition hover:bg-emerald-50"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={() => setFormData((prev) => ({ ...prev, permissions: [] }))}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-50"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
              {PERMISSION_GROUPS.map((group) => (
                <div key={group.name} className="rounded-lg border border-emerald-100 bg-white/70 p-2">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                    {group.name}
                  </p>
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {group.items.map((perm) => (
                      <label key={perm.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.permissions.includes(perm.id)}
                          onChange={() => togglePermission(perm.id)}
                          className="h-4 w-4 rounded border-emerald-300 text-emerald-600 focus:ring-2 focus:ring-emerald-500"
                        />
                        <span className="text-sm text-slate-700">{perm.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold text-slate-700">Security Confirmation</p>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={stepUp.currentPassword}
            onChange={(e) => setStepUp((prev) => ({ ...prev, currentPassword: e.target.value }))}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            placeholder="Your current password *"
          />
          {(needsOtp || currentAdmin?.two_fa_enabled) ? (
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={stepUp.otpCode}
              onChange={(e) => setStepUp((prev) => ({ ...prev, otpCode: e.target.value.replace(/\D/g, "") }))}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              placeholder="6-digit authenticator code *"
            />
          ) : null}
        </div>

        <div className="rounded-xl bg-blue-50 border border-blue-200 p-3">
          <p className="text-xs text-blue-800">
            <strong>Note:</strong> A secure password will be auto-generated and emailed to the admin.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Creating...
            </>
          ) : (
            <>
              <UserPlus className="h-4 w-4" />
              Create Admin Account
            </>
          )}
        </button>
      </form>
    </div>
  );
}
