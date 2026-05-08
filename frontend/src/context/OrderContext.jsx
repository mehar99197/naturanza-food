import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { orderAPI } from "@/services/api";
import { useAuth } from "@/context/AuthContext";

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
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const response = await orderAPI.getAll();
      const rawOrders = Array.isArray(response)
        ? response
        : response.data || [];
      const normalizedOrders = rawOrders.map((order) => ({
        ...order,
        order_date: order.order_date || order.created_at,
      }));
      setOrders(normalizedOrders);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch orders:", err);
      setError(err.message);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user?.id) {
      setOrders([]);
      setLoading(false);
      return;
    }

    void fetchOrders();
  }, [authLoading, fetchOrders, user?.id]);

  const addOrder = async (orderData) => {
    try {
      const response = await orderAPI.create(orderData);
      const generatedId = response.orderId || response.id || response.order?.id;

      let newOrder = response.order || null;
      if (!newOrder && generatedId) {
        try {
          newOrder = await orderAPI.getById(generatedId);
        } catch (readErr) {
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
      } catch (readErr) {
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
  };

  return (
    <OrderContext.Provider value={value}>{children}</OrderContext.Provider>
  );
};
