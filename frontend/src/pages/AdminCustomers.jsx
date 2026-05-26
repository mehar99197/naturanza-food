import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  Pencil,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { useAdminData } from "@/context/AdminDataContext";
import { useSettings } from "@/context/SettingsContext";
import { formatPrice } from "@/lib/utils";

const initialFormState = {
  name: "",
  email: "",
  phone: "",
  address: "",
};

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

const MOBILE_INITIAL_CUSTOMERS = 6;

export function AdminCustomers() {
  const {
    customers,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    toggleCustomerStatus,
    fetchAllData,
  } = useAdminData();
  const { settings } = useSettings();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [formData, setFormData] = useState(initialFormState);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [mobileView, setMobileView] = useState("queue");
  const [showAllMobileRows, setShowAllMobileRows] = useState(false);

  const customerRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return customers
      .filter((customer) => {
        const matchesStatus =
          statusFilter === "all" || String(customer.status || "active") === statusFilter;

        if (!matchesStatus) {
          return false;
        }

        if (!query) {
          return true;
        }

        const searchable = [
          customer.name,
          customer.email,
          customer.phone,
          customer.address,
        ]
          .map((value) => String(value || "").toLowerCase())
          .join(" ");

        return searchable.includes(query);
      })
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }, [customers, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const active = customers.filter((item) => String(item.status) === "active").length;
    const blocked = customers.length - active;
    const withOrders = customers.filter((item) => Number(item.orders || 0) > 0).length;

    return {
      total: customers.length,
      active,
      blocked,
      withOrders,
    };
  }, [customers]);

  useEffect(() => {
    setShowAllMobileRows(false);
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    if (!customerRows.length) {
      setSelectedCustomer(null);
      setMobileView("queue");
      return;
    }

    if (selectedCustomer?.id) {
      const latestMatch = customerRows.find((item) => item.id === selectedCustomer.id);
      if (latestMatch) {
        setSelectedCustomer(latestMatch);
        return;
      }
    }

    setSelectedCustomer(customerRows[0]);
  }, [customerRows, selectedCustomer?.id]);

  const quickSummaryItems = [
    { key: "total", label: "Customers", value: stats.total },
    { key: "active", label: "Active", value: stats.active },
    { key: "blocked", label: "Blocked", value: stats.blocked },
    { key: "orders", label: "With Orders", value: stats.withOrders },
  ];

  const shouldShowMobileToggle = customerRows.length > MOBILE_INITIAL_CUSTOMERS;

  const refreshCustomers = async () => {
    try {
      setError("");
      await fetchAllData();
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "Failed to refresh customers");
    }
  };

  const openAddModal = () => {
    setEditingCustomer(null);
    setFormData(initialFormState);
    setError("");
    setShowFormModal(true);
  };

  const openEditModal = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: String(customer.name || ""),
      email: String(customer.email || ""),
      phone: String(customer.phone || ""),
      address: String(customer.address || customer.location || ""),
    });
    setError("");
    setShowFormModal(true);
  };

  const closeModal = () => {
    setShowFormModal(false);
    setEditingCustomer(null);
    setFormData(initialFormState);
  };

  const saveCustomer = async () => {
    const name = String(formData.name || "").trim();
    const email = String(formData.email || "").trim();

    if (!name || !email) {
      setError("Customer name and email are required.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        name,
        email,
        phone: String(formData.phone || "").trim() || null,
        address: String(formData.address || "").trim() || null,
      };

      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, payload);
      } else {
        await addCustomer(payload);
      }

      closeModal();
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "Failed to save customer");
    } finally {
      setSaving(false);
    }
  };

  const removeCustomer = async (customerId) => {
    if (!window.confirm("Delete this customer account?")) {
      return;
    }

    try {
      setError("");
      await deleteCustomer(customerId);
      if (selectedCustomer?.id === customerId) {
        setSelectedCustomer(null);
      }
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "Failed to delete customer");
    }
  };

  const toggleStatus = async (customerId) => {
    try {
      setError("");
      await toggleCustomerStatus(customerId);
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "Failed to update customer status");
    }
  };

  return (
    <AdminLayout>
      <div className="mx-auto w-full max-w-[1240px] space-y-4 sm:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-[2rem] font-bold text-slate-900 sm:text-3xl">Customers</h1>
            <p className="text-sm text-slate-600 sm:text-base">
              Manage customer accounts, activity, and lifetime value from live records.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <button
              type="button"
              onClick={() => void refreshCustomers()}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-emerald-200/90 bg-white px-3 text-[13px] font-semibold text-emerald-800 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50 sm:h-11 sm:w-auto sm:rounded-2xl sm:px-4 sm:text-sm"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#16a34a] px-3 text-[13px] font-semibold text-white shadow-[0_14px_30px_rgba(22,163,74,0.32)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#15803d] sm:h-11 sm:w-auto sm:rounded-2xl sm:px-4 sm:text-sm"
            >
              <UserPlus className="h-4 w-4" />
              Add Customer
            </button>
          </div>
        </div>

        {error ? (
          <div className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 shadow-sm">
            <AlertCircle className="h-5 w-5" />
            {error}
          </div>
        ) : null}

        <section className="md:hidden">
          <div className="rounded-2xl border border-emerald-100 bg-white p-2.5 shadow-[0_10px_24px_rgba(15,64,28,0.08)]">
            <div className="grid grid-cols-4 gap-1.5">
              {quickSummaryItems.map((item) => (
                <article key={item.key} className="rounded-xl border border-emerald-100 bg-[#f7fbf7] px-1.5 py-2">
                  <p className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    {item.label}
                  </p>
                  <p className="mt-0.5 truncate text-xs font-extrabold text-slate-900">{item.value}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <div className="hidden grid-cols-2 gap-4 md:grid lg:grid-cols-4">
          <div className="group rounded-2xl border border-emerald-100 bg-white p-5 shadow-[0_10px_28px_rgba(15,64,28,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(15,64,28,0.16)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{stats.total}</p>
          </div>
          <div className="group rounded-2xl border border-emerald-100 bg-white p-5 shadow-[0_10px_28px_rgba(15,64,28,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(15,64,28,0.16)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active</p>
            <p className="mt-2 text-2xl font-bold text-emerald-700">{stats.active}</p>
          </div>
          <div className="group rounded-2xl border border-emerald-100 bg-white p-5 shadow-[0_10px_28px_rgba(15,64,28,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(15,64,28,0.16)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Blocked</p>
            <p className="mt-2 text-2xl font-bold text-amber-700">{stats.blocked}</p>
          </div>
          <div className="group rounded-2xl border border-emerald-100 bg-white p-5 shadow-[0_10px_28px_rgba(15,64,28,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(15,64,28,0.16)]">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">With Orders</p>
            <p className="mt-2 text-2xl font-bold text-indigo-700">{stats.withOrders}</p>
          </div>
        </div>

        <div className="md:hidden">
          <div className="inline-flex w-full rounded-2xl border border-emerald-200 bg-emerald-50/65 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
            <button
              type="button"
              onClick={() => setMobileView("queue")}
              className={`inline-flex min-h-[34px] flex-1 items-center justify-center rounded-xl px-3 text-xs font-semibold transition-all duration-200 ${
                mobileView === "queue"
                  ? "bg-[#16a34a] text-white shadow-[0_8px_18px_rgba(22,163,74,0.28)]"
                  : "text-slate-600 hover:bg-emerald-100 hover:text-emerald-800"
              }`}
            >
              List ({customerRows.length})
            </button>
            <button
              type="button"
              onClick={() => setMobileView("detail")}
              className={`inline-flex min-h-[34px] flex-1 items-center justify-center rounded-xl px-3 text-xs font-semibold transition-all duration-200 ${
                mobileView === "detail"
                  ? "bg-[#16a34a] text-white shadow-[0_8px_18px_rgba(22,163,74,0.28)]"
                  : "text-slate-600 hover:bg-emerald-100 hover:text-emerald-800"
              }`}
            >
              Detail
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[62%_38%]">
          <div
            className={`rounded-3xl border border-emerald-100 bg-white p-4 shadow-[0_14px_30px_rgba(15,64,28,0.08)] sm:p-6 ${
              mobileView === "detail" ? "hidden xl:block" : "block"
            }`}
          >
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative w-full md:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search customer by name/email/phone"
                  className="w-full rounded-xl border border-emerald-100 py-2.5 pl-10 pr-3 text-sm text-slate-700 shadow-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                />
              </div>
              <div className="flex items-center gap-2">
                {[
                  { value: "all", label: "All" },
                  { value: "active", label: "Active" },
                  { value: "blocked", label: "Blocked" },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setStatusFilter(item.value)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-all duration-200 ${
                      statusFilter === item.value
                        ? "bg-[#16a34a] text-white shadow-[0_8px_18px_rgba(22,163,74,0.28)]"
                        : "bg-emerald-100 text-slate-600 hover:bg-emerald-200/70 hover:text-emerald-800"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[48vh] space-y-2 overflow-y-auto sm:max-h-[56vh] xl:max-h-none xl:overflow-visible">
              {customerRows.length > 0 ? (
                customerRows.map((customer, index) => (
                  <article
                    key={customer.id}
                    className={`${!showAllMobileRows && index >= MOBILE_INITIAL_CUSTOMERS ? "hidden md:block" : "block"} rounded-2xl border p-3.5 transition-all duration-200 ${
                      selectedCustomer?.id === customer.id
                        ? "border-emerald-200 bg-emerald-50/80 shadow-[0_10px_24px_rgba(15,64,28,0.12)]"
                        : "border-emerald-100 bg-[#f7fbf7] hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(15,64,28,0.1)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900">{customer.name}</p>
                        <p className="truncate text-xs text-slate-500">{customer.email}</p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          customer.status === "active"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {customer.status}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                      <span>{Number(customer.orders || 0)} orders</span>
                      <span>{formatPrice(Number(customer.totalSpent || 0), settings.currency)}</span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCustomer(customer);
                          setMobileView("detail");
                        }}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(customer)}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggleStatus(customer.id)}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                      >
                        <Shield className="h-3.5 w-3.5" />
                        {customer.status === "active" ? "Block" : "Activate"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeCustomer(customer.id)}
                        className="inline-flex min-h-[34px] items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </article>
                ))
              ) : (
                <p className="py-10 text-center text-sm text-gray-500">
                  No customers found for current filter.
                </p>
              )}

              {shouldShowMobileToggle ? (
                <button
                  type="button"
                  onClick={() => setShowAllMobileRows((prev) => !prev)}
                  className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-emerald-200 bg-white text-xs font-semibold text-emerald-800 shadow-sm md:hidden"
                >
                  {showAllMobileRows
                    ? "Show fewer customers"
                    : `Show all ${customerRows.length} customers`}
                </button>
              ) : null}
            </div>
          </div>

          <div
            className={`rounded-3xl border border-emerald-100 bg-white p-5 shadow-[0_14px_30px_rgba(15,64,28,0.08)] sm:p-6 ${
              mobileView === "queue" ? "hidden xl:block" : "block"
            } max-h-[72vh] overflow-y-auto xl:max-h-none xl:overflow-visible`}
          >
            {selectedCustomer ? (
              <div className="space-y-4">
                <button
                  type="button"
                  onClick={() => setMobileView("queue")}
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-emerald-800 xl:hidden"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to list
                </button>

                <p className="text-xl font-bold text-slate-900">Customer Details</p>

                <div className="rounded-xl border border-emerald-100 bg-[#f0f8f2] p-4">
                  <p className="text-sm font-semibold text-slate-900">{selectedCustomer.name}</p>
                  <p className="mt-1 text-sm text-slate-600">{selectedCustomer.email}</p>
                  <p className="mt-1 text-sm text-slate-600">{selectedCustomer.phone || "No phone"}</p>
                  <p className="mt-1 text-sm text-slate-600">{selectedCustomer.address || selectedCustomer.location || "No address"}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-emerald-100 bg-[#f0f8f2] p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Orders</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">{Number(selectedCustomer.orders || 0)}</p>
                  </div>
                  <div className="rounded-xl border border-emerald-100 bg-[#f0f8f2] p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Spent</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">
                      {formatPrice(Number(selectedCustomer.totalSpent || 0), settings.currency)}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-100 bg-[#f0f8f2] p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Joined</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{formatDate(selectedCustomer.joinDate || selectedCustomer.created_at)}</p>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
                <p className="text-lg font-semibold text-slate-900">Select a Customer</p>
                <p className="mt-1 max-w-sm text-sm text-slate-500">
                  Choose a customer from the left list to view complete details.
                </p>
              </div>
            )}
          </div>
        </div>

        {showFormModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
            <div className="w-full max-w-lg rounded-2xl border border-emerald-100 bg-white p-5 shadow-[0_20px_48px_rgba(15,64,28,0.22)] sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-xl font-bold text-slate-900">
                  {editingCustomer ? "Edit Customer" : "Add Customer"}
                </p>
                <button
                  type="button"
                  onClick={closeModal}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3">
                <input
                  type="text"
                  value={formData.name}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, name: event.target.value }))
                  }
                  className="w-full rounded-xl border border-emerald-100 px-3 py-2.5 text-sm text-slate-700 outline-none transition-all duration-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  placeholder="Full name"
                />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, email: event.target.value }))
                  }
                  className="w-full rounded-xl border border-emerald-100 px-3 py-2.5 text-sm text-slate-700 outline-none transition-all duration-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  placeholder="Email"
                />
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, phone: event.target.value }))
                  }
                  className="w-full rounded-xl border border-emerald-100 px-3 py-2.5 text-sm text-slate-700 outline-none transition-all duration-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  placeholder="Phone"
                />
                <textarea
                  rows={3}
                  value={formData.address}
                  onChange={(event) =>
                    setFormData((prev) => ({ ...prev, address: event.target.value }))
                  }
                  className="w-full rounded-xl border border-emerald-100 px-3 py-2.5 text-sm text-slate-700 outline-none transition-all duration-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  placeholder="Address"
                />
              </div>

              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveCustomer()}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-[#16a34a] px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(22,163,74,0.32)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#15803d] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {editingCustomer ? "Update" : "Create"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AdminLayout>
  );
}
