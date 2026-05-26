import { createContext, useContext, useState, useEffect } from "react";
import { productAPI } from "@/services/api";

const ProductContext = createContext(null);

const STARTUP_PRODUCT_GROUPS = [
  {
    key: "honey",
    preferredSlugs: ["organic-honey", "honey"],
    keywords: ["honey"],
  },
  {
    key: "coconut-oil",
    preferredSlugs: ["organic-coconut-oil", "coconut-oil", "coconut-oil-1"],
    keywords: ["coconut", "oil"],
  },
  {
    key: "ispaghol",
    preferredSlugs: ["ispaghol", "ispaghol-husk", "psyllium", "psyllium-husk"],
    keywords: ["ispaghol", "psyllium"],
  },
];

const normalizeText = (value = "") => String(value).toLowerCase().trim();

const isTruthyFlag = (value) => {
  if (value === true || value === 1) {
    return true;
  }

  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  return normalized === "true" || normalized === "1" || normalized === "yes";
};

const buildProductSearchText = (product) => {
  return [
    product?.slug,
    product?.name,
    product?.category,
    product?.category_name,
    product?.description,
    product?.image,
    product?.image_url,
  ]
    .map(normalizeText)
    .join(" ");
};

const scoreProductMatch = (product, group) => {
  const slug = normalizeText(product?.slug);
  const searchableText = buildProductSearchText(product);

  if (group.preferredSlugs.includes(slug)) {
    return 100;
  }

  let matchedKeywords = 0;
  group.keywords.forEach((keyword) => {
    if (searchableText.includes(keyword)) {
      matchedKeywords += 1;
    }
  });

  if (matchedKeywords === 0) {
    return -1;
  }

  return matchedKeywords * 10;
};

const pickStartupProducts = (productList) => {
  const selectedProducts = [];
  const usedProductIds = new Set();

  STARTUP_PRODUCT_GROUPS.forEach((group) => {
    let bestProduct = null;
    let bestScore = -1;

    productList.forEach((product) => {
      if (usedProductIds.has(product.id)) {
        return;
      }

      const score = scoreProductMatch(product, group);
      if (score > bestScore) {
        bestScore = score;
        bestProduct = product;
      }
    });

    if (bestProduct && bestScore > 0) {
      usedProductIds.add(bestProduct.id);
      selectedProducts.push(bestProduct);
    }
  });

  return selectedProducts;
};

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
      
      // Check if we're in admin panel - include inactive products for admin
      const isAdminPage = typeof window !== 'undefined' && 
        window.location.pathname.startsWith('/admin');
      
      const data = await productAPI.getAll(isAdminPage);
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

  // Get featured products (only products marked as featured)
  const getFeaturedProducts = () => {
    const featured = products.filter(
      (p) => isTruthyFlag(p.is_active) && isTruthyFlag(p.is_featured),
    );

    if (featured.length > 0) {
      return featured;
    }

    return products.filter((p) => isTruthyFlag(p.is_active));
  };

  // Get active products only
  const getActiveProducts = () => {
    return products.filter((p) => isTruthyFlag(p.is_active));
  };

  // Startup catalog (only Honey, Coconut Oil, Ispaghol)
  const getStartupProducts = () => {
    const activeProducts = getActiveProducts();
    return pickStartupProducts(activeProducts);
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
    getStartupProducts,
  };

  return (
    <ProductContext.Provider value={value}>{children}</ProductContext.Provider>
  );
};
