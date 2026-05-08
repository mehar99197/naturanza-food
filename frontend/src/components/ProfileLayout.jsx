import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  User,
  Heart,
  Package,
  Shield,
  AlertCircle,
  LogOut,
  Loader2,
  Camera,
  Upload,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { userAPI } from "@/services/api";

const menuItems = [
  {
    to: "/profile",
    label: "Profile Info",
    mobileLabel: "Info",
    icon: User,
    end: true,
  },
  {
    to: "/profile/wishlist",
    label: "My Wishlist",
    mobileLabel: "Wishlist",
    icon: Heart,
  },
  {
    to: "/profile/orders",
    label: "My Orders",
    mobileLabel: "Orders",
    icon: Package,
  },
  {
    to: "/profile/security",
    label: "Security Settings",
    mobileLabel: "Security",
    icon: Shield,
  },
];

const pageMeta = {
  "/profile": {
    title: "My Profile",
    subtitle: "Manage your account information",
  },
  "/profile/wishlist": {
    title: "My Wishlist",
    subtitle: "Products you love and want to buy later",
  },
  "/profile/orders": {
    title: "My Orders",
    subtitle: "Track and manage your purchases",
  },
  "/profile/security": {
    title: "Security Settings",
    subtitle: "Protect your account and manage active sessions",
  },
};

const resolveProfileImage = (user, fallbackImage = null) => {
  return (
    user?.profile_image ||
    user?.profileImage ||
    user?.avatar ||
    fallbackImage ||
    null
  );
};

const emitProfileImageUpdated = (profileImage) => {
  window.dispatchEvent(
    new CustomEvent("profileImageUpdated", {
      detail: { profileImage: profileImage || null },
    }),
  );
};

export default function ProfileLayout() {
  const { user, logout, loading, refreshProfile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const toastTimeoutRef = useRef(null);
  const suppressStaleImageRef = useRef(false);

  const currentMeta = pageMeta[location.pathname] || pageMeta["/profile"];
  const [imageLoading, setImageLoading] = useState(false);
  const [showImageMenu, setShowImageMenu] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [toastType, setToastType] = useState("success");
  const [toastMessage, setToastMessage] = useState("");
  const [profileImage, setProfileImage] = useState(() => {
    const savedImage = localStorage.getItem("profileImage");
    return resolveProfileImage(user, savedImage);
  });

  const showToast = (message, type = "success") => {
    setToastType(type);
    setToastMessage(message);
    setShowSuccessToast(true);

    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    toastTimeoutRef.current = setTimeout(() => {
      setShowSuccessToast(false);
    }, 3000);
  };

  useEffect(() => {
    const savedImage = localStorage.getItem("profileImage");
    const userImage = resolveProfileImage(user, null);
    const hasUser = Boolean(user && typeof user === "object");

    if (suppressStaleImageRef.current && userImage) {
      return;
    }

    if (userImage) {
      suppressStaleImageRef.current = false;

      if (userImage !== savedImage) {
        localStorage.setItem("profileImage", userImage);
      }

      setProfileImage(userImage);
      return;
    }

    if (hasUser) {
      suppressStaleImageRef.current = false;
      localStorage.removeItem("profileImage");
      setProfileImage(null);
      return;
    }

    setProfileImage(savedImage || null);
  }, [user]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast("Image size should be less than 5MB", "error");
      return;
    }

    try {
      suppressStaleImageRef.current = false;
      setImageLoading(true);
      const formPayload = new FormData();
      formPayload.append("profile_image", file);

      const uploadResponse = await userAPI.uploadProfileImage(formPayload);
      const refreshedUser = await refreshProfile();
      const nextImage = resolveProfileImage(
        refreshedUser,
        uploadResponse?.imageUrl || null,
      );

      if (!nextImage) {
        throw new Error("Profile image URL not found after upload");
      }

      setProfileImage(nextImage);
      localStorage.setItem("profileImage", nextImage);
      setShowImageMenu(false);
      showToast("Profile image updated successfully!");
      emitProfileImageUpdated(nextImage);
    } catch (err) {
      const message =
        err.response?.data?.error || "Failed to upload profile image";
      showToast(message, "error");
    } finally {
      setImageLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveImage = async () => {
    try {
      setImageLoading(true);
      await userAPI.deleteProfileImage();

      // Keep UI cleared if backend/user refresh briefly returns stale image.
      suppressStaleImageRef.current = true;
      setProfileImage(null);
      localStorage.removeItem("profileImage");
      setShowImageMenu(false);
      showToast("Profile image removed successfully!");
      emitProfileImageUpdated(null);

      const refreshedUser = await refreshProfile();
      const refreshedImage = resolveProfileImage(refreshedUser, null);
      if (!refreshedImage) {
        suppressStaleImageRef.current = false;
      }
    } catch (err) {
      suppressStaleImageRef.current = false;
      const message =
        err.response?.data?.error || "Failed to remove profile image";
      showToast(message, "error");
    } finally {
      setImageLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleLogout = () => {
    suppressStaleImageRef.current = false;
    setShowImageMenu(false);
    localStorage.removeItem("profileImage");
    emitProfileImageUpdated(null);
    logout();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 pt-24 pb-16 px-4 flex items-center justify-center">
        <div className="flex items-center gap-2 text-green-700 font-medium">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading profile...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 pt-16 sm:pt-24 md:pt-28 pb-8 sm:pb-16 px-4 sm:px-6 lg:h-screen lg:overflow-hidden lg:px-8 lg:pb-8">
      <div className="max-w-6xl mx-auto lg:flex lg:h-full lg:flex-col">
        {showSuccessToast && (
          <div
            className={`fixed top-4 left-1/2 -translate-x-1/2 sm:left-auto sm:-translate-x-0 sm:right-4 z-[60] text-white px-4 sm:px-6 py-3 sm:py-4 rounded-xl shadow-2xl flex items-center gap-2.5 sm:gap-3 animate-slide-in w-[calc(100%-1.5rem)] max-w-sm sm:w-auto ${
              toastType === "error" ? "bg-red-600" : "bg-green-600"
            }`}
          >
            <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
            <p className="font-semibold text-sm sm:text-base leading-tight">
              {toastMessage}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:h-full lg:grid-cols-[300px_minmax(0,1fr)] lg:items-stretch lg:gap-6">
          <aside className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-100 p-3.5 sm:p-6 lg:w-[300px] lg:self-center lg:max-h-[calc(100vh-9.5rem)] lg:flex lg:flex-col">
            <div className="relative text-center mb-3.5 sm:mb-6">
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-3 sm:mb-4">
                {profileImage ? (
                  <img
                    src={profileImage}
                    alt={user?.name || "User profile"}
                    className="w-full h-full rounded-full object-cover border-4 border-green-100 shadow-md"
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-gradient-to-br from-green-400 to-emerald-500 text-white text-2xl sm:text-3xl font-bold flex items-center justify-center border-4 border-green-100 shadow-md">
                    {user?.name?.charAt(0)?.toUpperCase() ||
                      user?.email?.charAt(0)?.toUpperCase() ||
                      "U"}
                  </div>
                )}

                <button
                  onClick={() => setShowImageMenu((prev) => !prev)}
                  disabled={imageLoading}
                  className="absolute bottom-0 right-0 w-7 h-7 sm:w-8 sm:h-8 bg-green-600 hover:bg-green-700 rounded-full flex items-center justify-center shadow-lg border-2 border-white disabled:opacity-70 disabled:cursor-not-allowed"
                  title="Manage profile image"
                >
                  {imageLoading ? (
                    <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                  ) : (
                    <Camera className="w-3.5 h-3.5 text-white" />
                  )}
                </button>

                {showImageMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowImageMenu(false)}
                    />

                    <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-white rounded-lg shadow-2xl border border-gray-200 py-1 min-w-[170px] z-50">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />

                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={imageLoading}
                        className="w-full flex items-center gap-2.5 px-3 sm:px-4 py-2.5 text-sm text-gray-700 hover:bg-green-50"
                      >
                        <Upload className="w-4 h-4 text-green-600" />
                        {profileImage ? "Change Image" : "Upload Image"}
                      </button>

                      {profileImage && (
                        <button
                          onClick={handleRemoveImage}
                          disabled={imageLoading}
                          className="w-full flex items-center gap-2.5 px-3 sm:px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                          Remove Image
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>

              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                {user?.name || "My Account"}
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 truncate px-2">
                {user?.email || "No email available"}
              </p>

              <button
                onClick={handleLogout}
                className="mt-3 inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 lg:hidden"
              >
                <LogOut className="h-3.5 w-3.5" />
                Logout
              </button>
            </div>

            <div className="hidden lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
              <nav className="scrollbar-hide mt-1 space-y-1.5 sm:space-y-2 lg:flex-1 lg:overflow-y-auto lg:pr-1">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base rounded-lg transition-colors ${
                          isActive
                            ? "bg-green-50 text-green-700 font-semibold"
                            : "text-gray-700 hover:bg-gray-50"
                        }`
                      }
                    >
                      <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                      {item.label}
                    </NavLink>
                  );
                })}
              </nav>

              <div className="mt-4 border-t border-gray-100 pt-4">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
                  Logout
                </button>
              </div>
            </div>
          </aside>

          <section className="scrollbar-hide min-w-0 overflow-x-hidden lg:h-full lg:overflow-y-auto lg:pr-1">
            <div className="text-center mb-3 sm:mb-8 mt-2 sm:mt-6 lg:mb-6 lg:mt-2">
              <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-1 sm:mb-2">
                {currentMeta.title}
              </h1>
              <p className="hidden text-sm text-gray-600 sm:block sm:text-base">
                {currentMeta.subtitle}
              </p>
            </div>

            <div className="mb-3 sm:mb-5 lg:hidden">
              <div className="scrollbar-hide max-w-full flex items-center gap-1.5 overflow-x-auto rounded-xl border border-gray-200 bg-white p-1.5 shadow-sm">
                {menuItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors sm:px-3 sm:py-2 sm:text-sm ${
                        isActive
                          ? "bg-green-50 text-green-700"
                          : "text-gray-600 hover:bg-gray-50"
                      }`
                    }
                  >
                    <span className="sm:hidden">{item.mobileLabel || item.label}</span>
                    <span className="hidden sm:inline">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>

            <Outlet />
          </section>
        </div>
      </div>
    </div>
  );
}
