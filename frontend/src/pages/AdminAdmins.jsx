import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  RefreshCw,
  Shield,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { AdminPageSkeleton } from "@/components/Skeletons/AdminPageSkeleton";
import { adminAPI } from "@/services/api";
import { useAdminAuth } from "@/context/AdminAuthContext";

const formatDate = (value) => {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
};

export function AdminAdmins() {
  const { admin } = useAdminAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [admins, setAdmins] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mobileView, setMobileView] = useState("create");
  const [showAllMobileRows, setShowAllMobileRows] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    address: "",
  });

  const loadAdmins = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await adminAPI.getUsers({ include_admins: true });
      const users = Array.isArray(response) ? response : [];
      const adminsOnly = users.filter(
        (user) => String(user.role || "").toLowerCase() === "admin",
      );

      setAdmins(adminsOnly);
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "Failed to load admin users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAdmins();
  }, [loadAdmins]);

  const metrics = useMemo(() => {
    const active = admins.filter((item) => Boolean(item.is_active)).length;
    const inactive = admins.length - active;

    return {
      total: admins.length,
      active,
      inactive,
    };
  }, [admins]);

  const createAdmin = async (event) => {
    event.preventDefault();

    try {
      setIsSubmitting(true);
      setError("");

      await adminAPI.createCustomer({
        name: formData.name,
        email: formData.email,
        password: formData.password || undefined,
        phone: formData.phone || undefined,
        address: formData.address || undefined,
        role: "admin",
        is_active: true,
      });

      setFormData({
        name: "",
        email: "",
        password: "",
        phone: "",
        address: "",
      });

      setMobileView("directory");

      await loadAdmins();
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "Failed to create admin user");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleStatus = async (targetAdmin) => {
    try {
      setError("");
      await adminAPI.updateCustomerStatus(targetAdmin.id, !targetAdmin.is_active);
      await loadAdmins();
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "Failed to update admin status");
    }
  };

  const removeAdminAccess = async (targetAdmin) => {
    if (
      !window.confirm(
        `Remove admin role for ${targetAdmin.name || targetAdmin.email}? This user will become a customer.`,
      )
    ) {
      return;
    }

    try {
      setError("");
      await adminAPI.updateCustomerRole(targetAdmin.id, "customer");
      await loadAdmins();
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "Failed to update role");
    }
  };

  useEffect(() => {
    setShowAllMobileRows(false);
  }, [admins.length]);

  if (loading) {
    return (
      <AdminLayout>
        <AdminPageSkeleton cards={3} rows={6} showSidebar />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mx-auto w-full max-w-7xl space-y-4 sm:space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-[2rem] font-bold text-gray-900 sm:text-3xl">Admin Users</h1>
            <p className="text-sm text-gray-600 sm:text-base">
              Manage your internal admin team from the live users table.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadAdmins()}
            className="inline-flex h-9 self-end items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 sm:h-auto sm:min-h-[42px] sm:self-auto sm:gap-2 sm:rounded-xl sm:px-4 sm:py-2 sm:text-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {error ? (
          <div className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            <AlertCircle className="h-5 w-5" />
            {error}
          </div>
        ) : null}

        <section className="md:hidden">
          <div className="rounded-2xl border border-gray-200 bg-white p-2.5 shadow-sm">
            <div className="grid grid-cols-3 gap-1.5">
              <article className="rounded-xl border border-gray-200 bg-gray-50 px-1.5 py-2">
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-500">Total</p>
                <p className="mt-0.5 truncate text-sm font-extrabold text-gray-900">{metrics.total}</p>
              </article>
              <article className="rounded-xl border border-gray-200 bg-gray-50 px-1.5 py-2">
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-500">Active</p>
                <p className="mt-0.5 truncate text-sm font-extrabold text-emerald-700">{metrics.active}</p>
              </article>
              <article className="rounded-xl border border-gray-200 bg-gray-50 px-1.5 py-2">
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-500">Inactive</p>
                <p className="mt-0.5 truncate text-sm font-extrabold text-amber-700">{metrics.inactive}</p>
              </article>
            </div>
          </div>
        </section>

        <div className="hidden grid-cols-1 gap-4 md:grid md:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Total Admins</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{metrics.total}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Active</p>
            <p className="mt-2 text-2xl font-bold text-emerald-700">{metrics.active}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Inactive</p>
            <p className="mt-2 text-2xl font-bold text-amber-700">{metrics.inactive}</p>
          </div>
        </div>

        <section className="md:hidden">
          <div className="inline-flex rounded-full border border-gray-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setMobileView("create")}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                mobileView === "create" ? "bg-[#2a5f1e] text-white" : "text-gray-600"
              }`}
            >
              Add Admin
            </button>
            <button
              type="button"
              onClick={() => setMobileView("directory")}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                mobileView === "directory" ? "bg-[#2a5f1e] text-white" : "text-gray-600"
              }`}
            >
              Directory
            </button>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[40%_60%]">
          <div className={`rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6 ${mobileView === "directory" ? "hidden md:block" : "block"}`}>
            <div className="mb-4 inline-flex items-center gap-2 text-lg font-bold text-gray-900">
              <UserPlus className="h-5 w-5 text-gray-500" />
              Add New Admin
            </div>

            <form onSubmit={createAdmin} className="space-y-3">
              <input
                type="text"
                required
                value={formData.name}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, name: event.target.value }))
                }
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-green-500 focus:outline-none"
                placeholder="Full name"
              />
              <input
                type="email"
                required
                value={formData.email}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, email: event.target.value }))
                }
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-green-500 focus:outline-none"
                placeholder="Email address"
              />
              <input
                type="password"
                value={formData.password}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, password: event.target.value }))
                }
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-green-500 focus:outline-none"
                placeholder="Password (optional)"
              />
              <input
                type="text"
                value={formData.phone}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, phone: event.target.value }))
                }
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-green-500 focus:outline-none"
                placeholder="Phone (optional)"
              />
              <textarea
                rows={3}
                value={formData.address}
                onChange={(event) =>
                  setFormData((prev) => ({ ...prev, address: event.target.value }))
                }
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-green-500 focus:outline-none"
                placeholder="Address (optional)"
              />

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-[#2a5f1e] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#224f18] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Create Admin Account
              </button>
            </form>
          </div>

          <div className={`rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6 ${mobileView === "create" ? "hidden md:block" : "block"}`}>
            <div className="mb-4 inline-flex items-center gap-2 text-lg font-bold text-gray-900">
              <Users className="h-5 w-5 text-gray-500" />
              Admin Directory
            </div>

            <div className="space-y-3">
              {admins.length > 0 ? (
                <>
                  {admins.map((item, index) => {
                  const isSelf = Number(item.id) === Number(admin?.id);

                  return (
                    <article
                      key={item.id}
                      className={`${!showAllMobileRows && index >= 4 ? "hidden md:block" : "block"} rounded-xl border border-gray-100 bg-gray-50 p-4`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-gray-900">{item.name}</p>
                          <p className="truncate text-xs text-gray-500">{item.email}</p>
                          <p className="mt-1 text-xs text-gray-500">Joined {formatDate(item.created_at)}</p>
                        </div>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            item.is_active
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {item.is_active ? "Active" : "Inactive"}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={isSelf}
                          onClick={() => void toggleStatus(item)}
                          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Shield className="h-4 w-4" />
                          {item.is_active ? "Deactivate" : "Activate"}
                        </button>

                        <button
                          type="button"
                          disabled={isSelf}
                          onClick={() => void removeAdminAccess(item)}
                          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Remove Admin Role
                        </button>

                        {isSelf ? (
                          <span className="text-xs font-semibold text-gray-500">Current account</span>
                        ) : null}
                      </div>
                    </article>
                  );
                  })}

                  {admins.length > 4 ? (
                    <button
                      type="button"
                      onClick={() => setShowAllMobileRows((prev) => !prev)}
                      className="inline-flex min-h-[36px] items-center rounded-lg border border-gray-200 px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 md:hidden"
                    >
                      {showAllMobileRows
                        ? "Show fewer admins"
                        : `Show all ${admins.length} admins`}
                    </button>
                  ) : null}
                </>
              ) : (
                <p className="py-8 text-center text-sm text-gray-500">No admin users found.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
