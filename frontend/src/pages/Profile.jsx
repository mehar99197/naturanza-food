import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { NoIndexSEO } from "@/components/SEO";
import {
  User,
  Mail,
  MapPin,
  Phone,
  Edit2,
  Save,
  X,
  Loader2,
} from "lucide-react";

const buildInitialFormData = (user) => ({
  name: user?.name || "",
  email: user?.email || "",
  phone: user?.phone || "",
  address: user?.address || "",
});

const Profile = () => {
  const {
    user,
    updateProfile,
    loading: authLoading,
  } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const [formData, setFormData] = useState(buildInitialFormData(user));

  useEffect(() => {
    if (isEditing) {
      return;
    }

    setFormData(buildInitialFormData(user));
  }, [user, isEditing]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    const result = await updateProfile(formData);

    if (result.success) {
      const nextUser = result.user;
      if (nextUser) {
        setFormData(buildInitialFormData(nextUser));
      }
      setSuccessMessage("Profile updated successfully");
      setIsEditing(false);
      setTimeout(() => setSuccessMessage(""), 3000);
    } else {
      alert(result.message || "Failed to update profile");
    }

    setLoading(false);
  };

  const handleCancel = () => {
    setFormData(buildInitialFormData(user));
    setIsEditing(false);
  };

  if (authLoading) {
    return (
      <>
        <NoIndexSEO title="My Profile" />
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-8 border border-gray-100 flex items-center justify-center min-h-[320px]">
        <div className="flex items-center gap-2 text-green-700 font-medium">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading profile...
        </div>
      </div>
      </>
    );
  }

  return (
    <>
      <NoIndexSEO title="My Profile" />
    <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-3.5 sm:p-8 border border-gray-100">
      {successMessage && (
        <div className="mb-4 sm:mb-6 bg-green-50 border border-green-200 text-green-700 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg text-xs sm:text-sm">
          {successMessage}
        </div>
      )}

      <div className="flex justify-between items-center mb-3 sm:mb-6">
        <h3 className="text-lg sm:text-2xl font-bold text-gray-900">
          Personal Information
        </h3>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-sm sm:text-base text-green-600 hover:bg-green-50 rounded-lg"
          >
            <Edit2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Edit</span>
          </button>
        ) : (
          <div className="flex gap-1.5 sm:gap-2">
            <button
              onClick={handleCancel}
              className="flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-base text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Cancel</span>
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-base bg-green-600 text-white hover:bg-green-700 rounded-lg disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Save
                </>
              )}
            </button>
          </div>
        )}
      </div>

      <div className="space-y-3 sm:space-y-6">
        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
            Full Name
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-2.5 sm:pl-3 flex items-center pointer-events-none">
              <User className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
            </div>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              disabled={!isEditing}
              className={`block w-full pl-8 sm:pl-10 pr-3 py-2 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg ${
                isEditing
                  ? "focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  : "bg-gray-50 cursor-not-allowed"
              }`}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
            Email Address
            <span className="ml-2 text-xs text-gray-500">(Cannot be changed)</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-2.5 sm:pl-3 flex items-center pointer-events-none">
              <Mail className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
            </div>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              disabled={true}
              className="block w-full pl-8 sm:pl-10 pr-3 py-2 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg bg-gray-50 cursor-not-allowed"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
            Phone Number
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-2.5 sm:pl-3 flex items-center pointer-events-none">
              <Phone className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
            </div>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              disabled={!isEditing}
              placeholder="Add phone number"
              className={`block w-full pl-8 sm:pl-10 ${
                isEditing && formData.phone ? "pr-8 sm:pr-9" : "pr-3"
              } py-2 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg ${
                isEditing
                  ? "focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  : "bg-gray-50 cursor-not-allowed"
              }`}
            />
            {isEditing && formData.phone && (
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, phone: "" }))}
                className="absolute inset-y-0 right-0 pr-2.5 sm:pr-3 flex items-center text-gray-400 hover:text-red-500"
                title="Clear phone number"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-2">
            Address
          </label>
          <div className="relative">
            <div className="absolute top-2.5 sm:top-3 left-2.5 sm:left-3 pointer-events-none">
              <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
            </div>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              disabled={!isEditing}
              rows="2"
              placeholder="Add your address"
              className={`block w-full pl-8 sm:pl-10 ${
                isEditing && formData.address ? "pr-8 sm:pr-9" : "pr-3"
              } py-2 sm:py-3 text-sm sm:text-base border border-gray-300 rounded-lg ${
                isEditing
                  ? "focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  : "bg-gray-50 cursor-not-allowed"
              } resize-none`}
            />
            {isEditing && formData.address && (
              <button
                type="button"
                onClick={() =>
                  setFormData((prev) => ({ ...prev, address: "" }))
                }
                className="absolute top-2.5 sm:top-3 right-2.5 sm:right-3 text-gray-400 hover:text-red-500"
                title="Clear address"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

    </div>
    </>
  );
};

export default Profile;
