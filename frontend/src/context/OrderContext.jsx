import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { orderAPI } from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { useAdminAuth } from "@/context/AdminAuthContext";

// 25 rows fills the admin table without a scroll on a laptop and keeps the
// hydrated payload (items + history + shipment + transactions per order) small.
const DEFAULT_ADMIN_PAGE_SIZE = 25;

const OrderContext = createContext(null);

export const useOrders = () => {
  const context = useContext(OrderContext);
  if (!context) {
    throw new Error("useOrders must be used within an OrderProvider");
  }
  return context;
};

export const OrderProvider = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const { admin, loading: adminLoading } = useAdminAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Admin list state. `orders` holds the CURRENT PAGE for an admin and the
  // customer's full (bounded) list otherwise. Status and search are sent to the
  // server; they used to filter an in-memory copy of the entire orders table.
  const [totalOrders, setTotalOrders] = useState(0);
  const [orderQuery, setOrderQuery] = useState({
    page: 1,
    pageSize: DEFAULT_ADMIN_PAGE_SIZE,
    status: "all",
    search: "",
  });

  const isAdminViewer = Boolean(admin?.id);

  const normalize = (list) =>
    list.map((order) => ({
      ...order,
      order_date: order.order_date || order.created_at,
    }));

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);

      if (isAdminViewer) {
        const { page, pageSize, status, search } = orderQuery;
        const { data, total } = await orderAPI.getAdminPage({
          limit: pageSize,
          offset: (page - 1) * pageSize,
          status,
          search,
        });
        setOrders(normalize(data));
        setTotalOrders(total);
      } else {
        const response = await orderAPI.getAll();
        const rawOrders = Array.isArray(response) ? response : response.data || [];
        setOrders(normalize(rawOrders));
        setTotalOrders(rawOrders.length);
      }

      setError(null);
    } catch (err) {
      console.error("Failed to fetch orders:", err);
      setError(err.message);
      setOrders([]);
      setTotalOrders(0);
    } finally {
      setLoading(false);
    }
  }, [isAdminViewer, orderQuery]);

  // Changing a filter or search term must go back to page 1, otherwise the pager
  // can sit on a page the new result set does not have.
  const setOrderFilters = useCallback((patch) => {
    setOrderQuery((previous) => ({
      ...previous,
      ...patch,
      page: patch.page ?? 1,
    }));
  }, []);

  useEffect(() => {
    // Wait until BOTH auth contexts have settled, so we don't fire the fetch
    // before the admin token has been read from storage (the bug that made the
    // admin Orders page load empty until a manual Refresh).
    if (authLoading || adminLoading) {
      return;
    }

    // Fetch when EITHER a customer OR an admin is authenticated. The admin
    // Orders page has no regular `user`, so the old `!user?.id` check bailed out
    // and never loaded the list.
    if (!user?.id && !admin?.id) {
      setOrders([]);
      setLoading(false);
      return;
    }

    void fetchOrders();
  }, [authLoading, adminLoading, fetchOrders, user?.id, admin?.id]);

  const addOrder = async (orderData) => {
    try {
      const response = await orderAPI.create(orderData);
      const generatedId = response.orderId || response.id || response.order?.id;

      let newOrder = response.order || null;
      if (!newOrder && generatedId) {
        try {
          newOrder = await orderAPI.getById(generatedId);
        } catch {
          newOrder = null;
        }
      }

      if (!newOrder) {
        newOrder = {
          ...orderData,
          id: generatedId || Date.now(),
          total_amount: Number(response.total ?? orderData.total_amount ?? 0),
          created_at: orderData.created_at || new Date().toISOString(),
          order_date:
            orderData.order_date ||
            orderData.created_at ||
            new Date().toISOString(),
        };
      }

      setOrders((prevOrders) => [
        newOrder,
        ...prevOrders.filter((order) => order.id !== newOrder.id),
      ]);
      return newOrder;
    } catch (err) {
      console.error("Failed to create order:", err);
      throw err;
    }
  };

  const updateOrderStatus = async (
    orderId,
    newStatus,
    paymentStatus = null,
    extra = {},
  ) => {
    try {
      await orderAPI.updateStatus(orderId, newStatus, paymentStatus, extra);

      let freshOrder = null;
      try {
        freshOrder = await orderAPI.getById(orderId);
      } catch {
        freshOrder = null;
      }

      setOrders((prevOrders) =>
        prevOrders.map((order) => {
          if (order.id !== orderId) {
            return order;
          }

          if (freshOrder) {
            return {
              ...order,
              ...freshOrder,
            };
          }

          return {
            ...order,
            status: newStatus,
            payment_status:
              paymentStatus !== null ? paymentStatus : order.payment_status,
          };
        }),
      );
    } catch (err) {
      console.error("Failed to update order status:", err);
      throw err;
    }
  };

  const updateOrder = async (orderId, orderData) => {
    try {
      setOrders((prevOrders) =>
        prevOrders.map((order) =>
          order.id === orderId ? { ...order, ...orderData } : order,
        ),
      );
    } catch (err) {
      console.error("Failed to update order:", err);
      throw err;
    }
  };

  const deleteOrder = (orderId) => {
    return orderAPI.delete(orderId).then(() => {
      setOrders((prevOrders) =>
        prevOrders.filter((order) => order.id !== orderId),
      );
    });
  };

  const getUserOrders = async (userId) => {
    try {
      const response = await orderAPI.getUserOrders();
      return Array.isArray(response) ? response : response.data || [];
    } catch (err) {
      console.error("Failed to fetch user orders:", err);
      return [];
    }
  };

  const getOrderById = (orderId) => {
    return orders.find((order) => order.id === orderId);
  };

  const getOrdersByUser = (userId) => {
    return orders.filter((order) => order.user_id === userId);
  };

  const getOrdersByStatus = (status) => {
    return orders.filter((order) => order.status === status);
  };

  const getRecentOrders = (limit = 10) => {
    return [...orders]
      .sort(
        (a, b) =>
          new Date(b.created_at || b.order_date) -
          new Date(a.created_at || a.order_date),
      )
      .slice(0, limit);
  };

  const getOrderStats = () => {
    return {
      total: orders.length,
      pending: orders.filter((o) => o.status === "pending").length,
      processing: orders.filter((o) => o.status === "processing").length,
      shipped: orders.filter((o) => o.status === "shipped").length,
      delivered: orders.filter((o) => o.status === "delivered").length,
      cancelled: orders.filter((o) => o.status === "cancelled").length,
      totalRevenue: orders
        .filter((o) => o.payment_status === "paid")
        .reduce((sum, o) => sum + (o.total_amount || 0), 0),
    };
  };

  const value = {
    orders,
    loading,
    error,
    addOrder,
    updateOrderStatus,
    updateOrder,
    deleteOrder,
    getOrderById,
    getUserOrders,
    getOrdersByUser,
    getOrdersByStatus,
    getRecentOrders,
    getOrderStats,
    fetchOrders,
    totalOrders,
    orderQuery,
    setOrderFilters,
    adminPageSize: DEFAULT_ADMIN_PAGE_SIZE,
  };

  return (
    <OrderContext.Provider value={value}>{children}</OrderContext.Provider>
  );
};
