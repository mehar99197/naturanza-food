import { createContext, useCallback, useContext, useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { productAPI, adminAPI, categoryAPI } from "@/services/api";
import { useAdminAuth } from "@/context/AdminAuthContext";

const AdminDataContext = createContext(null);

export const useAdminData = () => {
  const context = useContext(AdminDataContext);
  if (!context) {
    throw new Error("useAdminData must be used within an AdminDataProvider");
  }
  return context;
};

export const AdminDataProvider = ({ children }) => {
  const { isAdminAuthenticated, loading: adminLoading, admin } = useAdminAuth();
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [categories, setCategories] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const normalizeCustomer = (customer) => ({
    ...customer,
    is_active:
      customer?.is_active === false || customer?.is_active === 0
        ? false
        : true,
    status:
      customer?.is_active === false || customer?.is_active === 0
        ? 'blocked'
        : 'active',
    orders: Number(customer?.orders_count || 0),
    totalSpent: Number(customer?.total_spent || 0),
    location: customer?.address || '',
    joinDate: customer?.created_at,
  });

  const extractList = (payload) =>
    Array.isArray(payload) ? payload : payload?.data || [];

  const fetchCategoriesOnly = useCallback(async () => {
    try {
      const categoriesData = await categoryAPI.getAll();
      setCategories(extractList(categoriesData));
    } catch (err) {
      setError(err.message || "Failed to load categories");
    }
  }, []);

  useEffect(() => {
    const handleCategoriesUpdated = () => {
      void fetchCategoriesOnly();
    };

    window.addEventListener("categories:updated", handleCategoriesUpdated);
    return () => {
      window.removeEventListener("categories:updated", handleCategoriesUpdated);
    };
  }, [fetchCategoriesOnly]);

  const fetchAllData = useCallback(async () => {
    if (!isAdminAuthenticated || !isAdminRoute) {
      setProducts([]);
      setCustomers([]);
      setCoupons([]);
      setCategories([]);
      setError(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const isSuperAdmin = admin?.admin_role === "super_admin";
      const permissions = Array.isArray(admin?.admin_permissions)
        ? admin.admin_permissions.map((value) => String(value).trim())
        : [];
      const canLoad = (permission) => isSuperAdmin || permissions.includes(permission);
      const results = await Promise.allSettled([
        canLoad("manage_products") ? productAPI.getAll() : Promise.resolve([]),
        canLoad("manage_customers") ? adminAPI.getCustomers() : Promise.resolve([]),
        canLoad("manage_coupons") ? adminAPI.getCoupons() : Promise.resolve([]),
        canLoad("manage_categories") ? categoryAPI.getAll() : Promise.resolve([]),
      ]);
      const valueAt = (index) =>
        results[index]?.status === "fulfilled" ? results[index].value : [];
      const failedRequests = results.filter((result) => result.status === "rejected");
      const productsData = valueAt(0);
      const customersData = valueAt(1);
      const couponsData = valueAt(2);
      const categoriesData = valueAt(3);

      setProducts(
        extractList(productsData),
      );
      setCustomers(
        Array.isArray(customersData)
          ? customersData.map(normalizeCustomer)
          : [],
      );
      setCoupons(Array.isArray(couponsData) ? couponsData : []);
      setCategories(
        extractList(categoriesData),
      );
      setError(failedRequests.length ? "Some admin data could not be loaded" : null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [admin, isAdminAuthenticated, isAdminRoute]);

  useEffect(() => {
    if (adminLoading) {
      setLoading(true);
      return;
    }

    if (!isAdminAuthenticated || !isAdminRoute) {
      setProducts([]);
      setCustomers([]);
      setCoupons([]);
      setCategories([]);
      setLoading(false);
      setError(null);
      return;
    }

    void fetchAllData();
  }, [adminLoading, fetchAllData, isAdminAuthenticated, isAdminRoute]);

  // ===== PRODUCTS CRUD =====
  const addProduct = async (productData) => {
    const response = await productAPI.create(productData);
    const newProduct = response.product || response.data || response;
    setProducts([...products, newProduct]);
    return newProduct;
  };

  const updateProduct = async (productId, updates) => {
    await productAPI.update(productId, updates);
    setProducts(
      products.map((p) => (p.id === productId ? { ...p, ...updates } : p)),
    );
  };

  const deleteProduct = async (productId) => {
    await productAPI.delete(productId);
    setProducts(products.filter((p) => p.id !== productId));
  };

  // ===== CUSTOMERS CRUD =====
  const addCustomer = async (customerData) => {
    const payload = {
      name: customerData?.name,
      email: customerData?.email,
      phone: customerData?.phone || null,
      address: customerData?.address || customerData?.location || null,
      role: 'customer',
    };

    const response = await adminAPI.createCustomer(payload);
    const nextCustomer = normalizeCustomer(
      response?.user || {
        ...payload,
        id: response?.id,
        created_at: new Date().toISOString(),
        orders_count: 0,
        total_spent: 0,
      },
    );

    setCustomers((prev) => [nextCustomer, ...prev]);
    return nextCustomer;
  };

  const updateCustomer = async (customerId, customerData) => {
    const payload = {
      name: customerData?.name,
      email: customerData?.email,
      phone: customerData?.phone || null,
      address: customerData?.address || customerData?.location || null,
    };

    const response = await adminAPI.updateCustomer(customerId, payload);
    const updatedCustomer = response?.user || payload;

    setCustomers((prev) =>
      prev.map((customer) =>
        customer.id === customerId
          ? normalizeCustomer({
              ...customer,
              ...updatedCustomer,
            })
          : customer,
      ),
    );
  };

  const deleteCustomer = async (customerId) => {
    await adminAPI.deleteCustomer(customerId);
    setCustomers((prev) => prev.filter((customer) => customer.id !== customerId));
  };

  const toggleCustomerStatus = async (customerId) => {
    const target = customers.find((customer) => customer.id === customerId);
    if (!target) {
      throw new Error('Customer not found');
    }

    const nextStatus = !target.is_active;
    await adminAPI.updateCustomerStatus(customerId, nextStatus);

    setCustomers((prev) =>
      prev.map((customer) =>
        customer.id === customerId
          ? normalizeCustomer({
              ...customer,
              is_active: nextStatus,
            })
          : customer,
      ),
    );
  };

  const getProductById = (productId) => {
    return products.find((p) => p.id === productId);
  };

  // ===== COUPONS CRUD =====
  const addCoupon = async (couponData) => {
    const response = await adminAPI.createCoupon(couponData);
    const newCoupon = response.coupon || response.data || response;
    setCoupons([...coupons, newCoupon]);
    return newCoupon;
  };

  const updateCoupon = async (couponId, couponData) => {
    await adminAPI.updateCoupon(couponId, couponData);
    setCoupons(
      coupons.map((c) => (c.id === couponId ? { ...c, ...couponData } : c)),
    );
  };

  const deleteCoupon = async (couponId) => {
    await adminAPI.deleteCoupon(couponId);
    setCoupons(coupons.filter((c) => c.id !== couponId));
  };

  const toggleCouponStatus = async (couponId) => {
    await adminAPI.toggleCouponStatus(couponId);
    setCoupons(
      coupons.map((coupon) =>
        coupon.id === couponId
          ? { ...coupon, is_active: !coupon.is_active }
          : coupon,
      ),
    );
  };

  const getCouponById = (couponId) => {
    return coupons.find((c) => c.id === couponId);
  };

  // NOTE: no client-side stats here. Counting orders and summing revenue in the
  // browser required loading every order ever placed; GET /api/admin/dashboard/stats
  // computes the same figures with SQL aggregates and is what the dashboard uses.

  const value = {
    // Data
    products,
    customers,
    coupons,
    categories,
    loading,
    error,

    // Functions
    addProduct,
    updateProduct,
    deleteProduct,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    toggleCustomerStatus,
    getProductById,
    addCoupon,
    updateCoupon,
    deleteCoupon,
    toggleCouponStatus,
    getCouponById,
    fetchAllData,
  };

  return (
    <AdminDataContext.Provider value={value}>
      {children}
    </AdminDataContext.Provider>
  );
};
