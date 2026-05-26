import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
  Upload,
  Users,
  UserCheck,
  UserX,
} from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { teamAPI } from "@/services/api";
import { getAbsoluteImageUrl } from "@/lib/imageUtils";

const initialFormState = {
  name: "",
  role: "",
  image: "",
  bio: "",
  sort_order: 0,
  is_active: true,
};

const getMemberImageSrc = (imageUrl) =>
  getAbsoluteImageUrl(imageUrl, { defaultFolder: "avatars" });

export default function AdminTeam() {
  const [members, setMembers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [formData, setFormData] = useState(initialFormState);
  const [validationErrors, setValidationErrors] = useState({});
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [uploading, setUploading] = useState(false);

  const loadMembers = async () => {
    try {
      setError("");
      const response = await teamAPI.getAll();
      setMembers(Array.isArray(response) ? response : []);
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error ||
          "Could not load team members right now.",
      );
    }
  };

  useEffect(() => {
    void loadMembers();
  }, []);

  const activeCount = useMemo(
    () => members.filter((m) => Boolean(m.is_active)).length,
    [members],
  );

  const openCreateModal = () => {
    setEditingMember(null);
    setFormData(initialFormState);
    setValidationErrors({});
    setError("");
    setImageFile(null);
    setImagePreview("");
    setShowModal(true);
  };

  const openEditModal = (member) => {
    setEditingMember(member);
    setFormData({
      name: String(member.name || ""),
      role: String(member.role || ""),
      image: String(member.image || ""),
      bio: String(member.bio || ""),
      sort_order: member.sort_order ?? 0,
      is_active: Boolean(member.is_active),
    });
    setValidationErrors({});
    setError("");
    setImageFile(null);
    setImagePreview("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingMember(null);
    setFormData(initialFormState);
    setValidationErrors({});
    setError("");
    setImageFile(null);
    setImagePreview("");
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowed.includes(file.type)) {
      setValidationErrors((prev) => ({
        ...prev,
        image: "Only JPEG, PNG, GIF, or WebP images are allowed.",
      }));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setValidationErrors((prev) => ({
        ...prev,
        image: "Image must be less than 5MB.",
      }));
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setValidationErrors((prev) => {
      const next = { ...prev };
      delete next.image;
      return next;
    });
  };

  const validate = () => {
    const errors = {};
    if (!formData.name.trim()) errors.name = "Name is required";
    if (!formData.role.trim()) errors.role = "Role is required";
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    try {
      setSaving(true);
      setError("");

      let imageUrl = formData.image;

      if (imageFile) {
        setUploading(true);
        try {
          const uploadRes = await teamAPI.uploadImage(imageFile);
          imageUrl = uploadRes?.imageUrl || uploadRes?.url || uploadRes?.data?.imageUrl;
        } catch (uploadError) {
          console.error("Upload error:", uploadError);
          throw new Error(uploadError?.response?.data?.error || "Failed to upload image");
        } finally {
          setUploading(false);
        }
      }

      const payload = {
        name: formData.name.trim(),
        role: formData.role.trim(),
        image: imageUrl,
        bio: formData.bio.trim() || null,
        sort_order: Number(formData.sort_order),
        is_active: formData.is_active,
      };

      if (editingMember) {
        await teamAPI.update(editingMember.id, payload);
      } else {
        await teamAPI.create(payload);
      }

      closeModal();
      await loadMembers();
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error ||
          "Something went wrong saving the team member.",
      );
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  const handleDelete = async (member) => {
    if (
      !window.confirm(
        `Are you sure you want to delete "${member.name}"? This cannot be undone.`,
      )
    ) {
      return;
    }

    try {
      setError("");
      await teamAPI.delete(member.id);
      await loadMembers();
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error ||
          "Could not delete team member.",
      );
    }
  };

  return (
    <AdminLayout
      title="Team"
      subtitle="Manage your team members"
      icon={Users}
    >
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <Users className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Members</p>
                <p className="text-xl font-semibold text-gray-900">
                  {members.length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                <UserCheck className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Active</p>
                <p className="text-xl font-semibold text-gray-900">
                  {activeCount}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center">
                <UserX className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Inactive</p>
                <p className="text-xl font-semibold text-gray-900">
                  {members.length - activeCount}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2">
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Team Member
          </button>
          <button
            onClick={loadMembers}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-gray-50 text-gray-700 rounded-xl border border-gray-200 transition-colors text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Member
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Role
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">
                    Sort Order
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">
                    Status
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {members.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="text-center py-12 text-gray-400"
                    >
                      No team members yet. Click "Add Team Member" to create
                      one.
                    </td>
                  </tr>
                ) : (
                  members.map((member) => (
                    <tr
                      key={member.id}
                      className="hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                            {member.image ? (
                              <img
                                src={getMemberImageSrc(member.image)}
                                alt={member.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs font-medium text-gray-500">
                                {String(member.name)
                                  .split(" ")
                                  .map((p) => p[0])
                                  .join("")
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </div>
                            )}
                          </div>
                          <span className="font-medium text-gray-900">
                            {member.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {member.role}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-500">
                        {member.sort_order ?? 0}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            member.is_active
                              ? "bg-green-50 text-green-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {member.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(member)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-emerald-600"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(member)}
                            className="p-2 hover:bg-red-50 rounded-lg transition-colors text-gray-500 hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeModal();
            }}
          >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingMember ? "Edit Team Member" : "Add Team Member"}
                </h2>
                <button
                  onClick={closeModal}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                {/* Image Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Profile Image
                  </label>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
                      {imagePreview ? (
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      ) : formData.image ? (
                        <img
                          src={getMemberImageSrc(formData.image)}
                          alt="Current"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                          <Users className="w-6 h-6" />
                        </div>
                      )}
                    </div>
                    <label className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors text-sm text-gray-600">
                      <Upload className="w-4 h-4" />
                      {imageFile ? imageFile.name : "Choose Image"}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        className="hidden"
                        onChange={handleImageSelect}
                      />
                    </label>
                    {(imagePreview || formData.image) && (
                      <button
                        onClick={() => {
                          setImageFile(null);
                          setImagePreview("");
                          handleChange("image", "");
                        }}
                        className="p-2 hover:bg-red-50 rounded-lg transition-colors text-gray-400 hover:text-red-500"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {validationErrors.image && (
                    <p className="mt-1 text-xs text-red-500">
                      {validationErrors.image}
                    </p>
                  )}
                </div>

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    placeholder="Enter full name"
                    className={`w-full px-3.5 py-2.5 rounded-xl border ${
                      validationErrors.name
                        ? "border-red-300 focus:ring-red-500"
                        : "border-gray-200 focus:ring-emerald-500"
                    } focus:outline-none focus:ring-2 text-sm`}
                  />
                  {validationErrors.name && (
                    <p className="mt-1 text-xs text-red-500">
                      {validationErrors.name}
                    </p>
                  )}
                </div>

                {/* Role */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Role <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.role}
                    onChange={(e) => handleChange("role", e.target.value)}
                    placeholder="e.g. Founder & CEO"
                    className={`w-full px-3.5 py-2.5 rounded-xl border ${
                      validationErrors.role
                        ? "border-red-300 focus:ring-red-500"
                        : "border-gray-200 focus:ring-emerald-500"
                    } focus:outline-none focus:ring-2 text-sm`}
                  />
                  {validationErrors.role && (
                    <p className="mt-1 text-xs text-red-500">
                      {validationErrors.role}
                    </p>
                  )}
                </div>

                {/* Bio */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Bio
                  </label>
                  <textarea
                    value={formData.bio}
                    onChange={(e) => handleChange("bio", e.target.value)}
                    placeholder="Short biography of the team member"
                    rows={3}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm resize-none"
                  />
                </div>

                {/* Sort Order */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) =>
                      handleChange("sort_order", e.target.value)
                    }
                    min={0}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    Lower numbers appear first.
                  </p>
                </div>

                {/* Active Toggle */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    Active
                  </span>
                  <button
                    onClick={() =>
                      handleChange("is_active", !formData.is_active)
                    }
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      formData.is_active ? "bg-emerald-500" : "bg-gray-200"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.is_active ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex items-center justify-end gap-3">
                <button
                  onClick={closeModal}
                  className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      {uploading
                        ? "Uploading..."
                        : editingMember
                          ? "Updating..."
                          : "Creating..."}
                    </>
                  ) : editingMember ? (
                    "Update Member"
                  ) : (
                    "Create Member"
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </AdminLayout>
  );
}
