import { formatDistanceToNow } from "date-fns";
import { Shield, ShieldCheck, Activity, Trash2, Key, RefreshCw, Upload, Settings2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { adminAPI, emitAuthSessionSync } from "@/services/api";
import { toast } from "sonner";
import { getAbsoluteImageUrl } from "@/lib/imageUtils";

export function AdminCard({ admin, currentUserId, currentUserRole, onUpdate, onViewActivity, onRemove, onChangePassword, onResetPassword, onEditPermissions }) {
  const [loading, setLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);
  const isCurrentUser = admin.id === currentUserId;
  const canEditImage = isCurrentUser || currentUserRole === "super_admin";

  const resolveProfileImage = (value) => {
    const trimmed = String(value || "").trim();
    if (!trimmed) return null;

    const lowered = trimmed.toLowerCase();
    if (lowered === "null" || lowered === "undefined" || lowered === "none") {
      return null;
    }

    return getAbsoluteImageUrl(trimmed);
  };

  const profileImageUrl = resolveProfileImage(admin.profile_image);
  const shouldShowImage = Boolean(profileImageUrl) && !imageError;

  const getInitials = (name) => {
    return name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "??";
  };

  const handleStatusToggle = async () => {
    if (isCurrentUser) {
      toast.error("You cannot change your own status");
      return;
    }

    setLoading(true);
    try {
      const newStatus = admin.is_active ? "inactive" : "active";
      await adminAPI.updateAdminStatus(admin.id, newStatus);
      toast.success(`Admin ${newStatus === "active" ? "activated" : "deactivated"} successfully`);
      onUpdate();
    } catch (error) {
      toast.error(error?.response?.data?.error || "Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setImageError(false);
  }, [profileImageUrl]);

  const handleProfileImageChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size should be less than 5MB");
      event.target.value = "";
      return;
    }

    setUploadingImage(true);
    try {
      await adminAPI.updateAdminProfileImage(admin.id, file);
      toast.success("Profile image updated successfully");
      onUpdate();
      if (isCurrentUser) {
        emitAuthSessionSync("admin-profile-image");
      }
    } catch (error) {
      toast.error(error?.response?.data?.error || "Failed to update profile image");
    } finally {
      setUploadingImage(false);
      event.target.value = "";
    }
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:shadow-md hover:border-emerald-100 sm:p-5">
      {/* Mobile Layout - Centered */}
      <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left">
        {/* Profile Picture */}
        <div className="flex-shrink-0 mb-3 sm:mb-0 sm:mr-4">
          {shouldShowImage ? (
            <img
              src={profileImageUrl}
              alt={admin.name}
              onError={() => setImageError(true)}
              className="h-16 w-16 sm:h-14 sm:w-14 rounded-full border-2 border-emerald-100 object-cover shadow-sm"
            />
          ) : (
            <div className="flex h-16 w-16 sm:h-14 sm:w-14 items-center justify-center rounded-full border-2 border-emerald-100 bg-gradient-to-br from-emerald-50 to-emerald-100 text-lg font-bold text-emerald-700 shadow-sm">
              {getInitials(admin.name)}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 w-full">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-slate-900 truncate text-base">{admin.name}</h4>
              <p className="text-sm text-slate-500 truncate">{admin.email}</p>
              {admin.phone && (
                <p className="text-xs text-slate-400 mt-0.5">{admin.phone}</p>
              )}
            </div>

            {/* Status Badge */}
            <span
              className={`inline-flex items-center self-center sm:self-start rounded-full px-3 py-1 text-xs font-semibold ${
                admin.is_active
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20"
                  : "bg-slate-100 text-slate-600 ring-1 ring-slate-500/20"
              }`}
            >
              {admin.is_active ? "Active" : "Inactive"}
            </span>
          </div>

          {/* Role and Last Login */}
          <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs">
            {/* Role Badge */}
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold ${
                admin.admin_role === "super_admin"
                  ? "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-sm"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              {admin.admin_role === "super_admin" ? (
                <>
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Super Admin
                </>
              ) : (
                <>
                  <Shield className="h-3.5 w-3.5" />
                  Staff Admin
                </>
              )}
            </span>

            {/* Last Login */}
            <span className="text-slate-400">
              Last login:{" "}
              <span className="text-slate-600">
                {admin.last_login
                  ? formatDistanceToNow(new Date(admin.last_login), {
                      addSuffix: true,
                    })
                  : "Never"}
              </span>
            </span>
          </div>

          {/* Actions */}
          <div className="mt-4 flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <button
              onClick={handleStatusToggle}
              disabled={loading || isCurrentUser}
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-all duration-200 ${
                admin.is_active
                  ? "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                  : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {admin.is_active ? "Deactivate" : "Activate"}
            </button>

            {canEditImage && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleProfileImageChange}
                  className="hidden"
                  disabled={uploadingImage}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-700 transition-all duration-200 hover:bg-emerald-100 hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {uploadingImage ? "Uploading..." : "Change Photo"}
                </button>
              </>
            )}

            <button
              onClick={() => onViewActivity(admin)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3.5 py-2 text-xs font-semibold text-purple-700 transition-all duration-200 hover:bg-purple-100 hover:border-purple-300"
            >
              <Activity className="h-3.5 w-3.5" />
              <span className="hidden xs:inline">View</span> Activity
            </button>

            {isCurrentUser && (
              <button
                onClick={() => onChangePassword(admin)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-700 transition-all duration-200 hover:bg-blue-100 hover:border-blue-300"
              >
                <Key className="h-3.5 w-3.5" />
                <span className="hidden xs:inline">Change</span> Password
              </button>
            )}

            {!isCurrentUser && currentUserRole === 'super_admin' && (
              <button
                onClick={() => onResetPassword(admin)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3.5 py-2 text-xs font-semibold text-orange-700 transition-all duration-200 hover:bg-orange-100 hover:border-orange-300"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span className="hidden xs:inline">Reset</span> Password
              </button>
            )}

            {!isCurrentUser && currentUserRole === 'super_admin' && onEditPermissions && (
              <button
                onClick={() => onEditPermissions(admin)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-700 transition-all duration-200 hover:bg-emerald-100 hover:border-emerald-300"
              >
                <Settings2 className="h-3.5 w-3.5" />
                <span className="hidden xs:inline">Edit</span> Permissions
              </button>
            )}

            {currentUserRole === 'super_admin' && (
              <button
                onClick={() => onRemove(admin)}
                disabled={isCurrentUser}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 transition-all duration-200 hover:bg-red-100 hover:border-red-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden xs:inline">Remove</span>
              </button>
            )}
          </div>

          {isCurrentUser && (
            <p className="mt-3 text-xs text-slate-400 italic text-center sm:text-left">Current account</p>
          )}
        </div>
      </div>
    </div>
  );
}
