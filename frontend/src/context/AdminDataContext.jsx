import { createContext, useCallback, useContext, useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { productAPI, orderAPI, adminAPI, categoryAPI } from "@/services/api";
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
  const { isAdminAuthenticated, loading: adminLoading } = useAdminAuth();
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
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
    const categoriesData = await categoryAPI.getAll().catch(() => []);
    setCategories(extractList(categoriesData));
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
      setOrders([]);
      setCustomers([]);
      setCoupons([]);
      setCategories([]);
      setError(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [
        productsData,
        ordersData,
        customersData,
        couponsData,
        categoriesData,
      ] = await Promise.all([
        productAPI.getAll().catch(() => []),
        orderAPI.getAll().catch(() => []),
        adminAPI.getCustomers().catch(() => []),
        adminAPI.getCoupons().catch(() => []),
        categoryAPI.getAll().catch(() => []),
      ]);

      setProducts(
        extractList(productsData),
      );
      setOrders(
        extractList(ordersData),
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
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isAdminAuthenticated, isAdminRoute]);

  useEffect(() => {
    if (adminLoading) {
      setLoading(true);
      return;
    }

    if (!isAdminAuthenticated || !isAdminRoute) {
      setProducts([]);
      setOrders([]);
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
    try {
      const response = await productAPI.create(productData);
      const newProduct = response.product || response.data || response;
      setProducts([...products, newProduct]);
      return newProduct;
    } catch (err) {
      throw err;
    }
  };

  const updateProduct = async (productId, updates) => {
    try {
      await productAPI.update(productId, updates);
      setProducts(
        products.map((p) => (p.id === productId ? { ...p, ...updates } : p)),
      );
    } catch (err) {
      throw err;
    }
  };

  const deleteProduct = async (productId) => {
    try {
      await productAPI.delete(productId);
      setProducts(products.filter((p) => p.id !== productId));
    } catch (err) {
      throw err;
    }
  };

  // ===== CUSTOMERS CRUD =====
  const addCustomer = async (customerData) => {
    try {
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
    } catch (err) {
      throw err;
    }
  };

  const updateCustomer = async (customerId, customerData) => {
    try {
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
    } catch (err) {
      throw err;
    }
  };

  const deleteCustomer = async (customerId) => {
    try {
      await adminAPI.deleteCustomer(customerId);
      setCustomers((prev) => prev.filter((customer) => customer.id !== customerId));
    } catch (err) {
      throw err;
    }
  };

  const toggleCustomerStatus = async (customerId) => {
    try {
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
    } catch (err) {
      throw err;
    }
  };

  const getProductById = (productId) => {
    return products.find((p) => p.id === productId);
  };

  // ===== ORDERS CRUD =====
  const updateOrderStatus = async (orderId, status) => {
    try {
      await orderAPI.updateStatus(orderId, status);
      setOrders(orders.map((o) => (o.id === orderId ? { ...o, status } : o)));
    } catch (err) {
      throw err;
    }
  };

  // ===== COUPONS CRUD =====
  const addCoupon = async (couponData) => {
    try {
      const response = await adminAPI.createCoupon(couponData);
      const newCoupon = response.coupon || response.data || response;
      setCoupons([...coupons, newCoupon]);
      return newCoupon;
    } catch (err) {
      throw err;
    }
  };

  const updateCoupon = async (couponId, couponData) => {
    try {
      await adminAPI.updateCoupon(couponId, couponData);
      setCoupons(
        coupons.map((c) => (c.id === couponId ? { ...c, ...couponData } : c)),
      );
    } catch (err) {
      throw err;
    }
  };

  const deleteCoupon = async (couponId) => {
    try {
      await adminAPI.deleteCoupon(couponId);
      setCoupons(coupons.filter((c) => c.id !== couponId));
    } catch (err) {
      throw err;
    }
  };

  const toggleCouponStatus = async (couponId) => {
    try {
      await adminAPI.toggleCouponStatus(couponId);
      setCoupons(
        coupons.map((coupon) =>
          coupon.id === couponId
            ? { ...coupon, is_active: !coupon.is_active }
            : coupon,
        ),
      );
    } catch (err) {
      throw err;
    }
  };

  const getCouponById = (couponId) => {
    return coupons.find((c) => c.id === couponId);
  };

  // ===== STATISTICS =====
  const getStats = () => {
    return {
      totalProducts: products.length,
      totalOrders: orders.length,
      totalCustomers: customers.length,
      totalCoupons: coupons.length,
      totalRevenue: orders
        .filter((o) => o.payment_status === "paid")
        .reduce((sum, o) => sum + (o.total_amount || 0), 0),
      pendingOrders: orders.filter((o) => o.status === "pending").length,
      completedOrders: orders.filter((o) => o.status === "delivered").length,
    };
  };

  const value = {
    // Data
    products,
    orders,
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
    updateOrderStatus,
    addCoupon,
    updateCoupon,
    deleteCoupon,
    toggleCouponStatus,
    getCouponById,
    getStats,
    fetchAllData,
  };

  return (
    <AdminDataContext.Provider value={value}>
      {children}
    </AdminDataContext.Provider>
  );
};
