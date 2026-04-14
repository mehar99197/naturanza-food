import { createContext, useContext, useState, useEffect } from "react";
import { productAPI } from "@/services/api";

const ProductContext = createContext(null);

export const useProducts = () => {
  const context = useContext(ProductContext);
  if (!context) {
    throw new Error("useProducts must be used within a ProductProvider");
  }
  return context;
};

export const ProductProvider = ({ children }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch products from backend on mount
  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await productAPI.getAll();
      setProducts(Array.isArray(data) ? data : data.data || []);
    } catch (err) {
      setError(err.message);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  // Add new product via API
  const addProduct = async (productData) => {
    try {
      const response = await productAPI.create(productData);
      await fetchProducts();
      return response;
    } catch (err) {
      throw err;
    }
  };

  // Update existing product via API
  const updateProduct = async (productId, updates) => {
    try {
      const response = await productAPI.update(productId, updates);
      await fetchProducts();
      return response;
    } catch (err) {
      throw err;
    }
  };

  // Delete product via API
  const deleteProduct = async (productId) => {
    try {
      await productAPI.delete(productId);
      await fetchProducts();
    } catch (err) {
      throw err;
    }
  };

  // Get product by ID
  const getProductById = (productId) => {
    return products.find((p) => p.id === parseInt(productId));
  };

  // Get products by category
  const getProductsByCategory = (category) => {
    if (category === "all") return products;
    return products.filter(
      (p) =>
        p.category === category ||
        p.category_id === category ||
        p.category_name === category,
    );
  };

  // Get featured products
  const getFeaturedProducts = () => {
    return products
      .filter((p) => p.is_featured === true || p.is_featured === 1)
      .slice(0, 8);
  };

  // Get active products only
  const getActiveProducts = () => {
    return products.filter((p) => p.is_active === true || p.is_active === 1);
  };

  const value = {
    products,
    loading,
    error,
    fetchProducts,
    addProduct,
    updateProduct,
    deleteProduct,
    getProductById,
    getProductsByCategory,
    getFeaturedProducts,
    getActiveProducts,
  };

  return (
    <ProductContext.Provider value={value}>{children}</ProductContext.Provider>
  );
};
