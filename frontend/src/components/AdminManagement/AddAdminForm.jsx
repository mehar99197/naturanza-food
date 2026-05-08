import { useState } from "react";
import { UserPlus, Upload, X } from "lucide-react";
import { adminAPI } from "@/services/api";
import { toast } from "sonner";

const PERMISSIONS = [
  { id: "manage_orders", label: "Manage Orders" },
  { id: "manage_products", label: "Manage Products" },
  { id: "view_reports", label: "View Reports" },
  { id: "manage_customers", label: "Manage Customers" },
  { id: "manage_shipping", label: "Manage Shipping & Returns" },
];

export function AddAdminForm({ onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    role: "staff_admin",
    permissions: [],
  });
  const [profilePicture, setProfilePicture] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfilePicture(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setProfilePicture(null);
    setPreviewUrl(null);
  };

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
      if (profilePicture) data.append("profile_picture", profilePicture);

      await adminAPI.createAdmin(data);
      
      toast.success("Admin created successfully! Welcome email sent.");
      
      setFormData({
        full_name: "",
        email: "",
        phone: "",
        role: "staff_admin",
        permissions: [],
      });
      setProfilePicture(null);
      setPreviewUrl(null);
      
      if (onSuccess) onSuccess();
    } catch (error) {
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
            <p className="mb-2 text-xs font-semibold text-slate-600">Permissions</p>
            <div className="space-y-2">
              {PERMISSIONS.map((perm) => (
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
        )}

        <div>
          <label className="mb-2 block text-xs font-semibold text-slate-600">
            Profile Picture (optional)
          </label>
          {previewUrl ? (
            <div className="relative inline-block">
              <img
                src={previewUrl}
                alt="Preview"
                className="h-24 w-24 rounded-full object-cover border-2 border-emerald-200"
              />
              <button
                type="button"
                onClick={removeImage}
                className="absolute -top-2 -right-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-emerald-200 bg-emerald-50/50 px-4 py-3 transition-colors hover:border-emerald-300 hover:bg-emerald-50">
              <Upload className="h-5 w-5 text-emerald-600" />
              <span className="text-sm text-slate-600">Click to upload image</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />
            </label>
          )}
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
