import { useState } from "react";
import { X, Shield, ShieldCheck, Save } from "lucide-react";
import { adminAPI } from "@/services/api";
import { toast } from "sonner";
import { PERMISSION_LIST, PERMISSION_GROUPS } from "@/config/adminPermissions";

const normalizePermissions = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

export function EditPermissionsModal({ admin, onClose, onSuccess }) {
  const [role, setRole] = useState(
    admin.admin_role === "super_admin" ? "super_admin" : "staff_admin",
  );
  const [permissions, setPermissions] = useState(() =>
    normalizePermissions(admin.admin_permissions),
  );
  const [saving, setSaving] = useState(false);

  const togglePermission = (id) => {
    setPermissions((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payloadPermissions = role === "super_admin" ? null : permissions;
      await adminAPI.updateAdminRole(admin.id, role, payloadPermissions);
      toast.success("Permissions updated successfully");
      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      toast.error(error?.response?.data?.error || "Failed to update permissions");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Edit Permissions</h3>
            <p className="mt-0.5 text-sm text-slate-500 truncate">{admin.name} — {admin.email}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-xl border border-emerald-100 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-all focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            >
              <option value="staff_admin">Staff Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
            <p className="mt-1 text-[11px] text-slate-500">
              {role === "super_admin"
                ? "Super admins have unrestricted access to every section."
                : "Tick only the sections this staff admin should see in their sidebar."}
            </p>
          </div>

          {role === "staff_admin" && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                  <Shield className="h-3.5 w-3.5" />
                  Permissions
                </p>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPermissions(PERMISSION_LIST.map((p) => p.id))}
                    className="rounded-md border border-emerald-200 bg-white px-2 py-1 text-[10px] font-semibold text-emerald-700 transition hover:bg-emerald-50"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={() => setPermissions([])}
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
                            checked={permissions.includes(perm.id)}
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

          {role === "super_admin" && (
            <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-3">
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-800">
                <ShieldCheck className="h-4 w-4" />
                Full access to every section
              </p>
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {saving ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
