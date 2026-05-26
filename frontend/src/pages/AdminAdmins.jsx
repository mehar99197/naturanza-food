import { useCallback, useEffect, useState } from "react";
import { Users, UserCheck, UserX, Search } from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { adminAPI } from "@/services/api";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { AddAdminForm } from "@/components/AdminManagement/AddAdminForm";
import { AdminCard } from "@/components/AdminManagement/AdminCard";
import { ActivityDrawer } from "@/components/AdminManagement/ActivityDrawer";
import { ConfirmRemoveModal } from "@/components/AdminManagement/ConfirmRemoveModal";
import { ChangePasswordModal, ResetPasswordModal } from "@/components/AdminManagement/PasswordModals";
import { EditPermissionsModal } from "@/components/AdminManagement/EditPermissionsModal";
import { toast } from "sonner";

export function AdminAdmins() {
  const { admin: currentAdmin, isSuperAdmin } = useAdminAuth();

  const STAFF_ADMIN_ROLES = new Set(["staff_admin", "admin", "moderator"]);

  const [error, setError] = useState("");
  const [admins, setAdmins] = useState([]);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterRole, setFilterRole] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileSection, setMobileSection] = useState("directory");
  
  // Modals and drawers
  const [selectedAdminForActivity, setSelectedAdminForActivity] = useState(null);
  const [showRemoveModal, setShowRemoveModal] = useState(null);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(null);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(null);
  const [showEditPermissionsModal, setShowEditPermissionsModal] = useState(null);

  const loadAdmins = useCallback(async () => {
    try {
      setError("");
      const data = await adminAPI.getAdmins();
      setAdmins(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to load admins");
      setAdmins([]);
    }
  }, []);

  useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  // Filter admins based on search and filters
  const filteredAdmins = admins.filter((admin) => {
    // Staff admin should not see super admin accounts
    if (!isSuperAdmin && admin.admin_role === 'super_admin') return false;

    // Status filter
    if (filterStatus === "active" && !admin.is_active) return false;
    if (filterStatus === "inactive" && admin.is_active) return false;

    // Role filter
    if (filterRole === "super_admin" && admin.admin_role !== "super_admin") return false;
    if (filterRole === "staff_admin" && !STAFF_ADMIN_ROLES.has(admin.admin_role)) return false;

    // Search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = admin.name?.toLowerCase().includes(query);
      const matchesEmail = admin.email?.toLowerCase().includes(query);
      return matchesName || matchesEmail;
    }

    return true;
  });

  // Calculate stats
  const totalAdmins = admins.length;
  const activeAdmins = admins.filter((a) => a.is_active).length;
  const inactiveAdmins = admins.filter((a) => !a.is_active).length;
  const showDirectory = mobileSection === "directory";
  const showCreate = mobileSection === "create";

  const handleRemoveAdmin = async () => {
    if (!showRemoveModal) return;
    
    try {
      await adminAPI.removeAdminRole(showRemoveModal.id);
      toast.success("Admin role removed successfully");
      setShowRemoveModal(null);
      loadAdmins();
    } catch (error) {
      toast.error(error?.response?.data?.error || "Failed to remove admin role");
    }
  };

  const handleResetPassword = async () => {
    if (!showResetPasswordModal) return;
    
    try {
      await adminAPI.resetPassword(showResetPasswordModal.id);
      toast.success(`Password reset email sent to ${showResetPasswordModal.email}`);
      setShowResetPasswordModal(null);
      loadAdmins();
    } catch (error) {
      toast.error(error?.response?.data?.error || "Failed to reset password");
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-emerald-700">
            NATURANZA ADMIN
          </p>
          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Admin Management</h1>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          <button
            onClick={() => {
              setFilterStatus("all");
              setFilterRole("all");
            }}
            className={`col-span-2 sm:col-span-1 rounded-2xl border p-4 sm:p-5 text-left transition-all ${
              filterStatus === "all" && filterRole === "all"
                ? "border-emerald-500 bg-gradient-to-br from-emerald-50 to-white shadow-lg shadow-emerald-100/50 ring-1 ring-emerald-500/20"
                : "border-emerald-100 bg-white hover:border-emerald-300 hover:shadow-md"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-slate-500">Total Admins</p>
                <p className="mt-1 text-2xl sm:text-3xl font-bold text-slate-900">{totalAdmins}</p>
              </div>
              <div className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-emerald-100/80">
                <Users className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600" />
              </div>
            </div>
          </button>

          <button
            onClick={() => {
              setFilterStatus("active");
              setFilterRole("all");
            }}
            className={`rounded-2xl border p-4 sm:p-5 text-left transition-all ${
              filterStatus === "active"
                ? "border-emerald-500 bg-gradient-to-br from-emerald-50 to-white shadow-lg shadow-emerald-100/50 ring-1 ring-emerald-500/20"
                : "border-emerald-100 bg-white hover:border-emerald-300 hover:shadow-md"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-emerald-600">Active</p>
                <p className="mt-1 text-2xl sm:text-3xl font-bold text-emerald-700">{activeAdmins}</p>
              </div>
              <div className="hidden sm:flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100/80">
                <UserCheck className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </button>

          <button
            onClick={() => {
              setFilterStatus("inactive");
              setFilterRole("all");
            }}
            className={`rounded-2xl border p-4 sm:p-5 text-left transition-all ${
              filterStatus === "inactive"
                ? "border-orange-500 bg-gradient-to-br from-orange-50 to-white shadow-lg shadow-orange-100/50 ring-1 ring-orange-500/20"
                : "border-emerald-100 bg-white hover:border-emerald-300 hover:shadow-md"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-semibold uppercase tracking-wide text-orange-600">Inactive</p>
                <p className="mt-1 text-2xl sm:text-3xl font-bold text-orange-700">{inactiveAdmins}</p>
              </div>
              <div className="hidden sm:flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100/80">
                <UserX className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
            {error}
          </div>
        )}

        {/* Mobile Section Toggle */}
        <div className="lg:hidden">
          <div className="inline-flex w-full rounded-2xl border border-emerald-100 bg-gradient-to-r from-white to-emerald-50/30 p-1.5 shadow-sm backdrop-blur-sm">
            <button
              type="button"
              onClick={() => setMobileSection("directory")}
              className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                showDirectory
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-200"
                  : "text-slate-600 hover:bg-white/80"
              }`}
            >
              Admin Directory
            </button>
            <button
              type="button"
              onClick={() => setMobileSection("create")}
              className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                showCreate
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-200"
                  : "text-slate-600 hover:bg-white/80"
              }`}
            >
              Add Admin
            </button>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Add Admin Form */}
          <div className={`lg:col-span-1 ${showCreate ? "block" : "hidden"} lg:block`}>
            <AddAdminForm onSuccess={loadAdmins} />
          </div>

          {/* Admin Directory */}
          <div className={`lg:col-span-2 ${showDirectory ? "block" : "hidden"} lg:block`}>
            <div className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-[0_14px_30px_rgba(15,64,28,0.08)] sm:p-6">
              <div className="mb-4 flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100">
                  <Users className="h-4.5 w-4.5 text-slate-600" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">Admin Directory</h2>
              </div>

              {/* Search and Filters */}
              <div className="mb-5 space-y-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name or email..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3 pl-10 pr-4 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100/60"
                  />
                </div>

                {/* Filter Buttons */}
                <div className="flex flex-nowrap gap-2 overflow-x-auto pb-2 scrollbar-hide sm:flex-wrap sm:overflow-visible sm:pb-0">
                  <button
                    onClick={() => {
                      setFilterStatus("all");
                      setFilterRole("all");
                    }}
                    className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-all duration-200 ${
                      filterStatus === "all" && filterRole === "all"
                        ? "bg-emerald-600 text-white shadow-md shadow-emerald-200"
                        : "border border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50"
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => {
                      setFilterStatus("active");
                      setFilterRole("all");
                    }}
                    className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-all duration-200 ${
                      filterStatus === "active" && filterRole === "all"
                        ? "bg-emerald-600 text-white shadow-md shadow-emerald-200"
                        : "border border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50"
                    }`}
                  >
                    Active
                  </button>
                  <button
                    onClick={() => {
                      setFilterStatus("inactive");
                      setFilterRole("all");
                    }}
                    className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-all duration-200 ${
                      filterStatus === "inactive" && filterRole === "all"
                        ? "bg-emerald-600 text-white shadow-md shadow-emerald-200"
                        : "border border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50"
                    }`}
                  >
                    Inactive
                  </button>
                  <button
                    onClick={() => {
                      setFilterRole("super_admin");
                      setFilterStatus("all");
                    }}
                    className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition-all duration-200 ${
                      filterRole === "super_admin"
                        ? "bg-emerald-600 text-white shadow-md shadow-emerald-200"
                        : "border border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50"
                    }`}
                  >
                    Super Admin
                  </button>
                  <button
                    onClick={() => {
                      setFilterRole("staff_admin");
                      setFilterStatus("all");
                    }}
                    className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-all duration-200 ${
                      filterRole === "staff_admin"
                        ? "bg-emerald-600 text-white shadow-md shadow-emerald-200"
                        : "border border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50"
                    }`}
                  >
                    Staff
                  </button>
                </div>
              </div>

              {/* Admin List */}
              <div className="space-y-3">
                {filteredAdmins.length === 0 ? (
                  <div className="py-12 text-center">
                    <Users className="mx-auto h-12 w-12 text-slate-300" />
                    <p className="mt-4 text-sm text-slate-500">
                      {searchQuery || filterStatus !== "all" || filterRole !== "all"
                        ? "No admins found matching filters"
                        : "No admins found"}
                    </p>
                  </div>
                ) : (
                  filteredAdmins.map((admin) => (
                    <AdminCard
                      key={admin.id}
                      admin={admin}
                      currentUserId={currentAdmin?.id}
                      currentUserRole={currentAdmin?.admin_role}
                      onUpdate={loadAdmins}
                      onViewActivity={setSelectedAdminForActivity}
                      onRemove={setShowRemoveModal}
                      onChangePassword={setShowChangePasswordModal}
                      onResetPassword={setShowResetPasswordModal}
                      onEditPermissions={isSuperAdmin ? setShowEditPermissionsModal : undefined}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Drawer */}
      {selectedAdminForActivity && (
        <ActivityDrawer
          admin={selectedAdminForActivity}
          onClose={() => setSelectedAdminForActivity(null)}
        />
      )}

      {/* Remove Confirmation Modal */}
      {showRemoveModal && (
        <ConfirmRemoveModal
          admin={showRemoveModal}
          onConfirm={handleRemoveAdmin}
          onClose={() => setShowRemoveModal(null)}
        />
      )}

      {/* Change Password Modal */}
      {showChangePasswordModal && (
        <ChangePasswordModal
          admin={showChangePasswordModal}
          onClose={() => setShowChangePasswordModal(null)}
          onSuccess={loadAdmins}
        />
      )}

      {/* Reset Password Modal */}
      {showResetPasswordModal && (
        <ResetPasswordModal
          admin={showResetPasswordModal}
          onConfirm={handleResetPassword}
          onClose={() => setShowResetPasswordModal(null)}
        />
      )}

      {/* Edit Permissions Modal */}
      {showEditPermissionsModal && (
        <EditPermissionsModal
          admin={showEditPermissionsModal}
          onClose={() => setShowEditPermissionsModal(null)}
          onSuccess={loadAdmins}
        />
      )}

    </AdminLayout>
  );
}
