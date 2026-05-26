import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  Edit2,
  MapPin,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { formatPrice } from "@/lib/utils";
import { adminAPI } from "@/services/api";
import { useSettings } from "@/context/SettingsContext";

const defaultFormData = () => ({
  city_name: "",
  fee: "",
  is_active: true,
});

export function AdminShippingCities() {
  const { settings } = useSettings();
  const currency = settings.currency || "PKR";
  const pageSize = 10;
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isEditing, setIsEditing] = useState(false);
  const [editingCityId, setEditingCityId] = useState(null);
  const [formData, setFormData] = useState(defaultFormData());
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchCities = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await adminAPI.getShippingCities();
      setCities(Array.isArray(response) ? response : []);
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to load cities");
      setCities([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchCities();
  }, []);

  const filteredCities = useMemo(() => {
    return [...cities]
      .filter((city) => {
        if (statusFilter === "active") return city.is_active;
        if (statusFilter === "inactive") return !city.is_active;
        return true;
      })
      .filter((city) => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return true;
        return String(city.city_name || "").toLowerCase().includes(query);
      })
      .sort((a, b) => String(a.city_name || "").localeCompare(b.city_name || ""));
  }, [cities, searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredCities.length / pageSize));
  const paginatedCities = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredCities.slice(startIndex, startIndex + pageSize);
  }, [currentPage, filteredCities, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    setCurrentPage((prev) => (prev > totalPages ? totalPages : prev));
  }, [totalPages]);

  const metrics = useMemo(() => {
    const active = cities.filter((c) => c.is_active).length;
    const inactive = cities.filter((c) => !c.is_active).length;
    return {
      total: cities.length,
      active,
      inactive,
    };
  }, [cities]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : type === "number" ? parseInt(value, 10) || 0 : value,
    }));
  };

  const handleEdit = (city) => {
    setFormData({
      city_name: city.city_name || "",
      fee: city.fee || "",
      is_active: Boolean(city.is_active),
    });
    setEditingCityId(city.id);
    setIsEditing(true);
    setShowAddForm(false);
    setError("");
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingCityId(null);
    setFormData(defaultFormData());
    setShowAddForm(false);
  };

  const handleAdd = () => {
    setFormData(defaultFormData());
    setIsEditing(false);
    setEditingCityId(null);
    setShowAddForm(true);
    setError("");
  };

  const handleSave = async () => {
    if (!formData.city_name?.trim()) {
      setError("City name is required");
      return;
    }

    try {
      setSaving(true);
      setError("");

      if (isEditing && editingCityId) {
        const updatedCity = await adminAPI.updateShippingCity(editingCityId, {
          city_name: formData.city_name.trim(),
          fee: parseInt(formData.fee, 10) || 0,
          is_active: Boolean(formData.is_active),
        });
        setCities((prev) =>
          prev.map((c) => (c.id === editingCityId ? updatedCity : c)),
        );
      } else {
        const newCity = await adminAPI.createShippingCity({
          city_name: formData.city_name.trim(),
          fee: parseInt(formData.fee, 10) || 0,
          is_active: Boolean(formData.is_active),
        });
        setCities((prev) => [...prev, newCity]);
      }

      handleCancel();
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to save city");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cityId) => {
    if (!confirm("Delete this city?")) return;
    try {
      setError("");
      await adminAPI.deleteShippingCity(cityId);
      setCities((prev) => prev.filter((c) => c.id !== cityId));
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to delete city");
    }
  };

  const handleToggleActive = async (city) => {
    try {
      setError("");
      const updatedCity = await adminAPI.updateShippingCity(city.id, {
        is_active: !city.is_active,
      });
      setCities((prev) =>
        prev.map((c) => (c.id === city.id ? updatedCity : c)),
      );
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to update city");
    }
  };

  return (
    <AdminLayout title="Shipping Cities">
      <div className="p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Shipping Cities</h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage delivery cities and their fees
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => void fetchCities()}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <button
              onClick={handleAdd}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-600"
            >
              <Plus className="h-4 w-4" />
              Add City
            </button>
          </div>
        </div>

        {/* Metrics */}
        <div className="mb-6 grid grid-cols-3 gap-4">
          {[
            { label: "Total Cities", value: metrics.total },
            { label: "Active", value: metrics.active, className: "bg-emerald-50 border-emerald-200" },
            { label: "Inactive", value: metrics.inactive, className: "bg-slate-50 border-slate-200" },
          ].map((item) => (
            <div
              key={item.label}
              className={`rounded-xl border p-4 ${item.className || "bg-white border-slate-200"}`}
            >
              <p className="text-2xl font-bold text-slate-800">{item.value}</p>
              <p className="text-xs font-medium text-slate-500">{item.label}</p>
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Add/Edit Form */}
        {(showAddForm || isEditing) && (
          <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
            <h3 className="mb-4 text-sm font-semibold text-slate-700">
              {isEditing ? "Edit City" : "Add New City"}
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  City Name *
                </label>
                <input
                  type="text"
                  name="city_name"
                  value={formData.city_name}
                  onChange={handleChange}
                  placeholder="e.g. Lahore"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-600">
                  Delivery Fee ({currency})
                </label>
                <input
                  type="number"
                  name="fee"
                  value={formData.fee}
                  onChange={handleChange}
                  placeholder="e.g. 150"
                  min="0"
                  step="10"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                />
              </div>
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={formData.is_active}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-slate-600">Active</span>
                </label>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={handleCancel}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search cities..."
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          <div className="flex items-center gap-2">
            {["all", "active", "inactive"].map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  statusFilter === filter
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
                }`}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    City
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Fee
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-sm text-slate-400">
                      Loading cities...
                    </td>
                  </tr>
                ) : filteredCities.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-sm text-slate-400">
                      No cities found
                    </td>
                  </tr>
                ) : (
                  paginatedCities.map((city) => (
                    <tr
                      key={city.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-slate-400" />
                          <span className="font-medium text-slate-800">
                            {city.city_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-emerald-700">
                          {formatPrice(city.fee || 0, currency)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleActive(city)}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                            city.is_active
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {city.is_active ? (
                            <>
                              <Check className="h-3 w-3" /> Active
                            </>
                          ) : (
                            <>
                              <X className="h-3 w-3" /> Inactive
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleEdit(city)}
                            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                            title="Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(city.id)}
                            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {!loading && filteredCities.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white px-4 py-3">
              <p className="text-xs text-slate-500">
                Showing{" "}
                <span className="font-medium text-slate-700">
                  {(currentPage - 1) * pageSize + 1}
                </span>
                -
                <span className="font-medium text-slate-700">
                  {Math.min(currentPage * pageSize, filteredCities.length)}
                </span>{" "}
                of{" "}
                <span className="font-medium text-slate-700">
                  {filteredCities.length}
                </span>
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-xs text-slate-500">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}