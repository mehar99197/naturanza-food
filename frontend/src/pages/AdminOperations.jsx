import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { adminAPI } from "@/services/api";
import { AlertCircle, RefreshCw } from "lucide-react";

const PAYMENT_METHOD_OPTIONS = [
  { code: "cod", label: "Cash on Delivery" },
  { code: "card", label: "Card Payment" },
  { code: "online", label: "Online Transfer" },
  { code: "easypaisa", label: "EasyPaisa" },
  { code: "jazzcash", label: "JazzCash" },
];

const initialTaxForm = {
  name: "",
  rate_percent: "",
  country: "Pakistan",
  state: "",
  is_default: false,
  is_active: true,
};

const initialPaymentMethodForm = {
  code: "cod",
  label: "Cash on Delivery",
  description: "",
  sort_order: 1,
  supports_online: false,
  is_active: true,
};

export function AdminOperations() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [paymentMethods, setPaymentMethods] = useState([]);
  const [taxRates, setTaxRates] = useState([]);
  const [inventoryMovements, setInventoryMovements] = useState([]);

  const [paymentMethodForm, setPaymentMethodForm] = useState(
    initialPaymentMethodForm,
  );
  const [taxForm, setTaxForm] = useState(initialTaxForm);

  const loadData = async () => {
    try {
      setLoading(true);
      setError("");

      const [paymentMethodsResponse, taxRatesResponse, movementsResponse] =
        await Promise.all([
          adminAPI.getPaymentMethods(),
          adminAPI.getTaxRates(),
          adminAPI.getInventoryMovements({ limit: 20 }),
        ]);

      setPaymentMethods(
        Array.isArray(paymentMethodsResponse) ? paymentMethodsResponse : [],
      );
      setTaxRates(Array.isArray(taxRatesResponse) ? taxRatesResponse : []);
      setInventoryMovements(
        Array.isArray(movementsResponse) ? movementsResponse : [],
      );
    } catch (loadError) {
      setError(
        loadError?.response?.data?.error ||
          loadError.message ||
          "Failed to load operations data",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onPaymentMethodCodeChange = (code) => {
    const matched = PAYMENT_METHOD_OPTIONS.find((item) => item.code === code);
    setPaymentMethodForm((prev) => ({
      ...prev,
      code,
      label: matched?.label || prev.label,
      supports_online: code !== "cod",
    }));
  };

  const createPaymentMethod = async () => {
    try {
      await adminAPI.createPaymentMethod({
        ...paymentMethodForm,
        sort_order: Number(paymentMethodForm.sort_order) || 0,
      });
      setPaymentMethodForm(initialPaymentMethodForm);
      await loadData();
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error ||
          "Failed to create payment method",
      );
    }
  };

  const togglePaymentMethod = async (method) => {
    try {
      await adminAPI.updatePaymentMethod(method.id, {
        code: method.code,
        label: method.label,
        description: method.description,
        sort_order: method.sort_order,
        supports_online: method.supports_online,
        is_active: !(method.is_active === true || method.is_active === 1),
      });
      await loadData();
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error ||
          "Failed to update payment method",
      );
    }
  };

  const deletePaymentMethod = async (method) => {
    if (!confirm(`Delete payment method ${method.code}?`)) {
      return;
    }

    try {
      await adminAPI.deletePaymentMethod(method.id);
      await loadData();
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error ||
          "Failed to delete payment method",
      );
    }
  };

  const createTaxRate = async () => {
    try {
      await adminAPI.createTaxRate({
        ...taxForm,
        rate_percent: Number(taxForm.rate_percent),
      });
      setTaxForm(initialTaxForm);
      await loadData();
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error || "Failed to create tax rate",
      );
    }
  };

  const toggleTaxRate = async (taxRate) => {
    try {
      await adminAPI.updateTaxRate(taxRate.id, {
        ...taxRate,
        is_active: !(taxRate.is_active === true || taxRate.is_active === 1),
      });
      await loadData();
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error || "Failed to update tax rate",
      );
    }
  };

  const setDefaultTaxRate = async (taxRate) => {
    try {
      await adminAPI.updateTaxRate(taxRate.id, {
        ...taxRate,
        is_default: true,
        is_active: true,
      });
      await loadData();
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error || "Failed to set default tax rate",
      );
    }
  };

  const deleteTaxRate = async (taxRate) => {
    if (!confirm(`Delete tax rate ${taxRate.name}?`)) {
      return;
    }

    try {
      await adminAPI.deleteTaxRate(taxRate.id);
      await loadData();
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error || "Failed to delete tax rate",
      );
    }
  };

  const activePaymentMethodsCount = useMemo(
    () =>
      paymentMethods.filter(
        (method) => method.is_active === true || method.is_active === 1,
      ).length,
    [paymentMethods],
  );

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Operations Control
            </h1>
            <p className="text-gray-600">
              Manage payment methods, tax rates and inventory logs in real time.
            </p>
          </div>
          <button
            onClick={loadData}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl inline-flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Payment Methods</p>
            <p className="text-2xl font-bold text-gray-900">
              {paymentMethods.length}
            </p>
            <p className="text-xs text-gray-500">
              {activePaymentMethodsCount} active
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">Tax Rates</p>
            <p className="text-2xl font-bold text-gray-900">
              {taxRates.length}
            </p>
          </div>
        </div>

        <section className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <h2 className="text-xl font-bold text-gray-900">Payment Methods</h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <select
              value={paymentMethodForm.code}
              onChange={(e) => onPaymentMethodCodeChange(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2"
            >
              {PAYMENT_METHOD_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.code.toUpperCase()}
                </option>
              ))}
            </select>
            <input
              value={paymentMethodForm.label}
              onChange={(e) =>
                setPaymentMethodForm((prev) => ({
                  ...prev,
                  label: e.target.value,
                }))
              }
              placeholder="Label"
              className="border border-gray-300 rounded-lg px-3 py-2"
            />
            <input
              value={paymentMethodForm.description}
              onChange={(e) =>
                setPaymentMethodForm((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="Description"
              className="border border-gray-300 rounded-lg px-3 py-2"
            />
            <input
              type="number"
              value={paymentMethodForm.sort_order}
              onChange={(e) =>
                setPaymentMethodForm((prev) => ({
                  ...prev,
                  sort_order: e.target.value,
                }))
              }
              placeholder="Sort"
              className="border border-gray-300 rounded-lg px-3 py-2"
            />
            <button
              onClick={createPaymentMethod}
              className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 font-semibold"
            >
              Add Method
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600 border-b">
                  <th className="py-2">Code</th>
                  <th className="py-2">Label</th>
                  <th className="py-2">Online</th>
                  <th className="py-2">Status</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paymentMethods.map((method) => {
                  const isActive =
                    method.is_active === true || method.is_active === 1;
                  return (
                    <tr key={method.id} className="border-b">
                      <td className="py-2 font-semibold">{method.code}</td>
                      <td className="py-2">{method.label}</td>
                      <td className="py-2">
                        {method.supports_online ? "Yes" : "No"}
                      </td>
                      <td className="py-2">
                        {isActive ? "Active" : "Inactive"}
                      </td>
                      <td className="py-2 text-right space-x-2">
                        <button
                          onClick={() => togglePaymentMethod(method)}
                          className="px-3 py-1 border rounded"
                        >
                          {isActive ? "Disable" : "Enable"}
                        </button>
                        <button
                          onClick={() => deletePaymentMethod(method)}
                          className="px-3 py-1 bg-red-600 text-white rounded"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <h2 className="text-xl font-bold text-gray-900">Tax Rates</h2>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <input
              value={taxForm.name}
              onChange={(e) =>
                setTaxForm((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="Name"
              className="border border-gray-300 rounded-lg px-3 py-2"
            />
            <input
              type="number"
              value={taxForm.rate_percent}
              onChange={(e) =>
                setTaxForm((prev) => ({
                  ...prev,
                  rate_percent: e.target.value,
                }))
              }
              placeholder="Rate %"
              className="border border-gray-300 rounded-lg px-3 py-2"
            />
            <input
              value={taxForm.country}
              onChange={(e) =>
                setTaxForm((prev) => ({ ...prev, country: e.target.value }))
              }
              placeholder="Country"
              className="border border-gray-300 rounded-lg px-3 py-2"
            />
            <input
              value={taxForm.state}
              onChange={(e) =>
                setTaxForm((prev) => ({ ...prev, state: e.target.value }))
              }
              placeholder="State"
              className="border border-gray-300 rounded-lg px-3 py-2"
            />
            <label className="inline-flex items-center gap-2 px-2">
              <input
                type="checkbox"
                checked={taxForm.is_default}
                onChange={(e) =>
                  setTaxForm((prev) => ({
                    ...prev,
                    is_default: e.target.checked,
                  }))
                }
              />
              Default
            </label>
            <button
              onClick={createTaxRate}
              className="bg-green-600 hover:bg-green-700 text-white rounded-lg px-4 py-2 font-semibold"
            >
              Add Tax
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600 border-b">
                  <th className="py-2">Name</th>
                  <th className="py-2">Rate</th>
                  <th className="py-2">Region</th>
                  <th className="py-2">Default</th>
                  <th className="py-2">Status</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {taxRates.map((taxRate) => {
                  const isActive =
                    taxRate.is_active === true || taxRate.is_active === 1;
                  const isDefault =
                    taxRate.is_default === true || taxRate.is_default === 1;
                  return (
                    <tr key={taxRate.id} className="border-b">
                      <td className="py-2">{taxRate.name}</td>
                      <td className="py-2">
                        {Number(taxRate.rate_percent || 0).toFixed(2)}%
                      </td>
                      <td className="py-2">
                        {taxRate.country}
                        {taxRate.state ? `, ${taxRate.state}` : ""}
                      </td>
                      <td className="py-2">{isDefault ? "Yes" : "No"}</td>
                      <td className="py-2">
                        {isActive ? "Active" : "Inactive"}
                      </td>
                      <td className="py-2 text-right space-x-2">
                        <button
                          onClick={() => toggleTaxRate(taxRate)}
                          className="px-3 py-1 border rounded"
                        >
                          {isActive ? "Disable" : "Enable"}
                        </button>
                        {!isDefault && (
                          <button
                            onClick={() => setDefaultTaxRate(taxRate)}
                            className="px-3 py-1 border rounded"
                          >
                            Set Default
                          </button>
                        )}
                        <button
                          onClick={() => deleteTaxRate(taxRate)}
                          className="px-3 py-1 bg-red-600 text-white rounded"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-gray-200 p-5">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Latest Inventory Movements
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600 border-b">
                  <th className="py-2">Time</th>
                  <th className="py-2">Product</th>
                  <th className="py-2">Type</th>
                  <th className="py-2">Change</th>
                  <th className="py-2">Stock</th>
                </tr>
              </thead>
              <tbody>
                {inventoryMovements.map((movement) => (
                  <tr key={movement.id} className="border-b">
                    <td className="py-2">
                      {new Date(movement.created_at).toLocaleString()}
                    </td>
                    <td className="py-2">
                      {movement.product_name ||
                        `Product #${movement.product_id}`}
                    </td>
                    <td className="py-2 capitalize">
                      {movement.movement_type}
                    </td>
                    <td className="py-2">{movement.quantity_change}</td>
                    <td className="py-2">
                      {movement.previous_stock} - {movement.new_stock}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
