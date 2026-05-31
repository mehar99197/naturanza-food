import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  AlertTriangle,
  Box,
  CheckCircle2,
  Image,
  Package,
  Pencil,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { useProducts } from "@/context/ProductContext";
import { useAdminData } from "@/context/AdminDataContext";
import { useSettings } from "@/context/SettingsContext";
import { formatPrice } from "@/lib/utils";
import { getAbsoluteImageUrl } from "@/lib/imageUtils";
import { ProductQRCode } from "@/components/ProductQRCode";

const initialFormState = {
  name: "",
  description: "",
  ingredients: "",
  benefits: "",
  usage: "",
  price: "",
  category_id: "",
  image_url: "",
  gallery_images: [],
  stock_quantity: "0",
  discount_percentage: "0",
  is_featured: false,
  is_active: true,
};

const normalizeStatus = (product) =>
  product.is_active === false || product.is_active === 0 ? "inactive" : "active";

const normalizeCategoryType = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (normalized === "shop" || normalized === "shop_by_category" || normalized === "both") {
    return normalized;
  }

  return "both";
};

const MOBILE_INITIAL_PRODUCTS = 6;

const getDisplayDescription = (product, fallback = "No description provided") => {
  const existing = String(product?.description || "").trim();
  if (existing) {
    return existing;
  }

  return fallback;
};

const ADMIN_FALLBACK_IMAGES = {
  honey: "/images/products/honey.webp",
  tea: "/images/products/tea.webp",
  oil: "/images/products/oil.webp",
  powder: "/images/products/ispaghol_2.webp",
  seeds: "/images/products/ispaghol_1.png",
  supplements: "/images/products/herbs.webp",
  aloe: "/images/products/herbs.webp",
  coconut: "/images/products/coconut-oil.webp",
  herbs: "/images/products/herbs.webp",
  default: "/images/products/honey.webp",
};

const getAdminFallbackImage = (product) => {
  const text = `${product?.name || ""} ${product?.category_name || ""} ${product?.category || ""}`
    .toLowerCase();

  if (text.includes("honey")) return ADMIN_FALLBACK_IMAGES.honey;
  if (text.includes("tea") || text.includes("chai")) return ADMIN_FALLBACK_IMAGES.tea;
  if (text.includes("coconut")) return ADMIN_FALLBACK_IMAGES.coconut;
  if (text.includes("oil")) return ADMIN_FALLBACK_IMAGES.oil;
  if (
    text.includes("powder") ||
    text.includes("superfood") ||
    text.includes("greens") ||
    text.includes("ispaghol") ||
    text.includes("psyllium")
  ) {
    return ADMIN_FALLBACK_IMAGES.powder;
  }
  if (text.includes("seed")) return ADMIN_FALLBACK_IMAGES.seeds;
  if (
    text.includes("supplement") ||
    text.includes("capsule") ||
    text.includes("curcumin") ||
    text.includes("probiotic")
  ) {
    return ADMIN_FALLBACK_IMAGES.supplements;
  }
  if (text.includes("aloe")) return ADMIN_FALLBACK_IMAGES.aloe;
  if (text.includes("herb")) return ADMIN_FALLBACK_IMAGES.herbs;

  return ADMIN_FALLBACK_IMAGES.default;
};

const pickProductImageValue = (product) => {
  const candidates = [];
  const addCandidate = (value) => {
    const trimmed = String(value || "").trim();
    if (trimmed) {
      candidates.push(trimmed);
    }
  };

  addCandidate(product?.image_url);
  addCandidate(product?.image);

  const collectFromList = (list) => {
    if (!list) {
      return;
    }

    if (typeof list === "string") {
      addCandidate(list);
      return;
    }

    if (!Array.isArray(list)) {
      return;
    }

    list.forEach((entry) => {
      if (typeof entry === "string") {
        addCandidate(entry);
        return;
      }

      if (entry && typeof entry === "object") {
        addCandidate(entry.image_url);
        addCandidate(entry.url);
        addCandidate(entry.src);
      }
    });
  };

  collectFromList(product?.images);
  collectFromList(product?.image_urls);
  collectFromList(product?.gallery_images);

  return candidates[0] || "";
};

const getProductImageSrc = (product) => {
  const imageValue = pickProductImageValue(product);
  const resolvedValue = imageValue || getAdminFallbackImage(product);
  return resolvedValue
    ? getAbsoluteImageUrl(resolvedValue, { defaultFolder: "products" })
    : "";
};

export function AdminProducts() {
  const {
    products,
    addProduct,
    updateProduct,
    deleteProduct,
    fetchProducts,
  } = useProducts();
  const { categories } = useAdminData();
  const { settings } = useSettings();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState(initialFormState);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showAllMobileRows, setShowAllMobileRows] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrProductData, setQrProductData] = useState(null);

  const productRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return products
      .filter((product) => {
        const status = normalizeStatus(product);
        const matchesStatus = statusFilter === "all" || status === statusFilter;

        if (!matchesStatus) {
          return false;
        }

        if (!query) {
          return true;
        }

        const searchable = [
          product.name,
          product.description,
          product.ingredients,
          product.benefits,
          product.usage,
          product.category_name,
          product.slug,
        ]
          .map((value) => String(value || "").toLowerCase())
          .join(" ");

        return searchable.includes(query);
      })
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }, [products, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const active = products.filter((item) => normalizeStatus(item) === "active").length;
    const inactive = products.length - active;
    const lowStock = products.filter((item) => Number(item.stock_quantity || 0) < 10).length;

    return {
      total: products.length,
      active,
      inactive,
      lowStock,
    };
  }, [products]);

  const assignableCategories = useMemo(
    () =>
      (categories || []).filter((category) => {
        const categoryType = normalizeCategoryType(category?.category_type);
        return categoryType === "shop" || categoryType === "both";
      }),
    [categories],
  );

  useEffect(() => {
    setShowAllMobileRows(false);
  }, [searchQuery, statusFilter]);

  const openAddModal = () => {
    setEditingProduct(null);
    setFormData(initialFormState);
    setError("");
    setShowFormModal(true);
  };

  const openEditModal = (product) => {
    const resolvedImageUrl = pickProductImageValue(product);
    // Gallery = all stored images minus the primary (the primary keeps its own field).
    const galleryFromProduct = Array.isArray(product.images)
      ? product.images
          .map((entry) => (typeof entry === "string" ? entry : entry?.image_url))
          .map((url) => String(url || "").trim())
          .filter(Boolean)
      : [];
    const additionalImages = [...new Set(galleryFromProduct)].filter(
      (url) => url !== String(resolvedImageUrl || "").trim(),
    );
    setEditingProduct(product);
    setFormData({
      name: String(product.name || ""),
      description: getDisplayDescription(product, ""),
      ingredients: String(product.ingredients || ""),
      benefits: String(product.benefits || ""),
      usage: String(product.usage || ""),
      price: String(product.price || ""),
      category_id: product.category_id ? String(product.category_id) : "",
      image_url: resolvedImageUrl,
      gallery_images: additionalImages,
      stock_quantity: String(product.stock_quantity || 0),
      discount_percentage: String(product.discount_percentage || 0),
      is_featured: Boolean(product.is_featured),
      is_active: normalizeStatus(product) === "active",
    });
    setError("");
    setShowFormModal(true);
  };

  const closeModal = () => {
    setShowFormModal(false);
    setEditingProduct(null);
    setFormData(initialFormState);
  };

  const refreshProducts = async () => {
    try {
      setError("");
      await fetchProducts();
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "Failed to refresh products");
    }
  };

  const saveProduct = async () => {
    const name = String(formData.name || "").trim();
    const description = String(formData.description || "").trim();
    const ingredients = String(formData.ingredients || "").trim();
    const benefits = String(formData.benefits || "").trim();
    const usage = String(formData.usage || "").trim();
    const price = Number(formData.price);

    if (!name || !Number.isFinite(price) || price < 0) {
      setError("Product name and a valid price are required.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const primaryImage = String(formData.image_url || "").trim();
      // Full ordered gallery: primary first, then the additional images. Deduped so the
      // backend stores each image once (it flags index 0 as is_primary).
      const galleryImages = [...new Set(
        [primaryImage, ...(formData.gallery_images || []).map((url) => String(url || "").trim())]
          .filter(Boolean),
      )];

      const payload = {
        name,
        description: description || null,
        ingredients: ingredients || null,
        benefits: benefits || null,
        usage: usage || null,
        price,
        category_id: formData.category_id ? Number(formData.category_id) : null,
        image_url: primaryImage || null,
        gallery_images: galleryImages,
        stock_quantity: Math.max(0, Number(formData.stock_quantity) || 0),
        discount_percentage: Math.max(0, Number(formData.discount_percentage) || 0),
        is_featured: Boolean(formData.is_featured),
        is_active: Boolean(formData.is_active),
      };

      if (editingProduct) {
        await updateProduct(editingProduct.id, payload);
      } else {
        await addProduct(payload);
      }

      closeModal();
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  const removeProduct = async (productId) => {
    if (!window.confirm("Delete this product?")) {
      return;
    }

    try {
      setError("");
      await deleteProduct(productId);
    } catch (requestError) {
      setError(requestError?.response?.data?.error || "Failed to delete product");
    }
  };

  const openQrModal = (product) => {
    setQrProductData({
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
    });
    setShowQrModal(true);
  };

  const closeQrModal = () => {
    setShowQrModal(false);
    setQrProductData(null);
  };

  // Validates a single image file (type + size). Returns an error string, or "" if valid.
  const validateImageFile = (file) => {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      return 'Please select a valid image file (JPEG, PNG, GIF, or WebP)';
    }
    if (file.size > 5 * 1024 * 1024) {
      return 'Each image must be less than 5MB';
    }
    return "";
  };

  // Uploads one file to the product image endpoint and resolves to its stored URL.
  const uploadImageFile = async (file) => {
    const uploadFormData = new FormData();
    uploadFormData.append('product_image', file);

    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/products/upload-image`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('adminAccessToken') || localStorage.getItem('token')}`
      },
      body: uploadFormData,
      credentials: 'include'
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Failed to upload image';
      try {
        errorMessage = JSON.parse(errorText).error || errorMessage;
      } catch (e) {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    if (!data.imageUrl) {
      throw new Error('Upload did not return an image URL');
    }
    return data.imageUrl;
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setUploadingImage(true);
    setError("");

    try {
      const imageUrl = await uploadImageFile(file);
      setFormData(prev => ({ ...prev, image_url: imageUrl }));
    } catch (uploadError) {
      console.error('Upload failed:', uploadError);
      setError(uploadError.message || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  // Uploads one or more gallery (additional) images and appends their URLs.
  const handleGalleryUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    for (const file of files) {
      const validationError = validateImageFile(file);
      if (validationError) {
        setError(validationError);
        event.target.value = "";
        return;
      }
    }

    setUploadingGallery(true);
    setError("");

    try {
      const uploadedUrls = [];
      for (const file of files) {
        uploadedUrls.push(await uploadImageFile(file));
      }
      setFormData(prev => ({
        ...prev,
        gallery_images: [
          ...new Set([
            ...(prev.gallery_images || []),
            ...uploadedUrls,
          ].filter(Boolean)),
        ],
      }));
    } catch (uploadError) {
      console.error('Gallery upload failed:', uploadError);
      setError(uploadError.message || 'Failed to upload gallery image');
    } finally {
      setUploadingGallery(false);
      event.target.value = "";
    }
  };

  const removeGalleryImage = (url) => {
    setFormData(prev => ({
      ...prev,
      gallery_images: (prev.gallery_images || []).filter((item) => item !== url),
    }));
  };

  // Promote a gallery image to the main image; the old main moves into the gallery.
  const makeImagePrimary = (url) => {
    setFormData(prev => {
      const previousPrimary = String(prev.image_url || "").trim();
      const nextGallery = (prev.gallery_images || []).filter((item) => item !== url);
      if (previousPrimary && previousPrimary !== url) {
        nextGallery.unshift(previousPrimary);
      }
      return {
        ...prev,
        image_url: url,
        gallery_images: [...new Set(nextGallery.filter(Boolean))],
      };
    });
  };

  const statusFilterOptions = [
    { value: "all", label: "All", count: stats.total },
    { value: "active", label: "Active", count: stats.active },
    { value: "inactive", label: "Inactive", count: stats.inactive },
  ];

  const statCards = [
    {
      key: "total",
      label: "Total Products",
      value: stats.total,
      caption: "Complete catalog entries",
      icon: Box,
      iconClasses: "bg-emerald-100 text-emerald-700",
    },
    {
      key: "active",
      label: "Active",
      value: stats.active,
      caption: "Visible on storefront",
      icon: CheckCircle2,
      iconClasses: "bg-teal-100 text-teal-700",
    },
    {
      key: "inactive",
      label: "Inactive",
      value: stats.inactive,
      caption: "Hidden from shoppers",
      icon: XCircle,
      iconClasses: "bg-amber-100 text-amber-700",
    },
    {
      key: "low-stock",
      label: "Low Stock",
      value: stats.lowStock,
      caption: "Need restock soon",
      icon: AlertTriangle,
      iconClasses: "bg-rose-100 text-rose-700",
    },
  ];

  const quickSummaryItems = [
    { key: "products", label: "Products", value: stats.total },
    { key: "active", label: "Active", value: stats.active },
    { key: "inactive", label: "Inactive", value: stats.inactive },
    { key: "low", label: "Low", value: stats.lowStock },
  ];

  const mobileRows = showAllMobileRows
    ? productRows
    : productRows.slice(0, MOBILE_INITIAL_PRODUCTS);

  const shouldShowMobileToggle = productRows.length > MOBILE_INITIAL_PRODUCTS;

  return (
    <AdminLayout>
      <div className="mx-auto w-full max-w-[1240px] space-y-4 sm:space-y-6">
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:justify-end sm:gap-2 sm:items-center">
          <button
            type="button"
            onClick={() => void refreshProducts()}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-emerald-200/90 bg-white px-3 text-[13px] font-semibold text-emerald-800 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50 sm:h-11 sm:rounded-2xl sm:px-4 sm:text-sm sm:w-auto"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#16a34a] px-3 text-[13px] font-semibold text-white shadow-[0_14px_30px_rgba(22,163,74,0.32)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#15803d] sm:h-11 sm:rounded-2xl sm:px-5 sm:text-sm sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            Add Product
          </button>
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
                <article
                  key={item.key}
                  className="rounded-xl border border-emerald-100 bg-[#f7fbf7] px-1.5 py-2"
                >
                  <p className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                    {item.label}
                  </p>
                  <p className="mt-0.5 truncate text-xs font-extrabold text-slate-900">{item.value}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <div className="hidden gap-4 md:grid md:grid-cols-2 xl:grid-cols-4">
          {statCards.map((card) => {
            const Icon = card.icon;

            return (
              <article
                key={card.key}
                className="group rounded-2xl border border-emerald-100 bg-white p-5 shadow-[0_10px_28px_rgba(15,64,28,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(15,64,28,0.16)]"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-500">{card.label}</p>
                    <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{card.value}</p>
                  </div>
                  <span
                    className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${card.iconClasses}`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                </div>
                <p className="mt-4 text-xs font-medium text-slate-500">{card.caption}</p>
              </article>
            );
          })}
        </div>

        <section className="rounded-3xl border border-emerald-100 bg-white shadow-[0_16px_34px_rgba(15,64,28,0.1)] md:overflow-hidden">
          <div className="sticky top-[74px] z-20 border-b border-emerald-100 bg-[#f8faf7]/95 px-3 py-3 backdrop-blur-sm sm:px-6 sm:py-5 md:static md:bg-[#f8faf7] md:backdrop-blur-none">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-xl">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-emerald-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search by product name, description, category, or slug"
                  className="h-12 w-full rounded-2xl border border-emerald-100 bg-white pl-11 pr-4 text-sm text-slate-700 shadow-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between lg:justify-end">
                <div className="inline-flex w-auto max-w-full flex-wrap items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50/65 p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
                  {statusFilterOptions.map((item) => {
                    const isActive = statusFilter === item.value;

                    return (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setStatusFilter(item.value)}
                        aria-pressed={isActive}
                        className={`group inline-flex min-h-[34px] items-center justify-center gap-1 rounded-lg px-2.5 py-1 text-[13px] font-semibold leading-none transition-all duration-200 sm:px-3.5 ${
                          isActive
                            ? "bg-[#16a34a] text-white shadow-[0_8px_18px_rgba(22,163,74,0.28)]"
                            : "text-slate-600 hover:bg-emerald-100 hover:text-emerald-800"
                        }`}
                      >
                        <span>{item.label}</span>
                        <span
                          className={`text-[12px] font-semibold tabular-nums ${
                            isActive ? "text-emerald-100" : "text-slate-500 group-hover:text-emerald-700"
                          }`}
                        >
                          ({item.count})
                        </span>
                      </button>
                    );
                  })}
                </div>

                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 sm:text-right">
                  Showing {productRows.length} of {stats.total} products
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2 p-3 md:hidden">
            {mobileRows.length > 0 ? (
              mobileRows.map((product) => {
                const status = normalizeStatus(product);
                const stock = Number(product.stock_quantity || 0);
                const isLowStock = stock < 10;
                const productImage = getProductImageSrc(product);

                return (
                  <article
                    key={product.id}
                    className="rounded-2xl border border-emerald-100 bg-white p-3 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-emerald-100 bg-[#f4f8f3]">
                        {productImage ? (
                          <img
                            src={productImage}
                            alt={product.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-emerald-500/80">
                            <Package className="h-5 w-5" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{product.name}</p>
                        <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                          {getDisplayDescription(product)}
                        </p>
                        <p className="mt-1 text-sm font-bold text-slate-900">
                          {formatPrice(Number(product.price || 0), settings.currency)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            status === "active"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {status === "active" ? "Active" : "Inactive"}
                        </span>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            isLowStock ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          Stock {stock}
                        </span>
                      </div>

                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openQrModal(product)}
                          aria-label={`QR Code for ${product.name}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-white text-emerald-700"
                        >
                          <QrCode className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(product)}
                          aria-label={`Edit ${product.name}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-white text-emerald-700"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeProduct(product.id)}
                          aria-label={`Delete ${product.name}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-white text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="rounded-2xl border border-emerald-100 bg-white px-4 py-8 text-center">
                <p className="text-sm font-semibold text-slate-700">No products found</p>
                <p className="mt-1 text-xs text-slate-500">
                  Try a different search term or switch your status filter.
                </p>
              </div>
            )}

            {shouldShowMobileToggle ? (
              <button
                type="button"
                onClick={() => setShowAllMobileRows((prev) => !prev)}
                className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-emerald-200 bg-white text-xs font-semibold text-emerald-800"
              >
                {showAllMobileRows
                  ? "Show fewer products"
                  : `Show all ${productRows.length} products`}
              </button>
            ) : null}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[980px]">
              <thead>
                <tr className="border-b border-emerald-100 bg-[#f2f8f2] text-left text-[11px] font-bold uppercase tracking-[0.15em] text-slate-500">
                  <th className="px-6 py-4">Product</th>
                  <th className="px-4 py-4">Category</th>
                  <th className="px-4 py-4 text-right">Price</th>
                  <th className="px-4 py-4 text-right">Stock</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {productRows.length > 0 ? (
                  productRows.map((product) => {
                    const status = normalizeStatus(product);
                    const stock = Number(product.stock_quantity || 0);
                    const isLowStock = stock < 10;
                    const productImage = getProductImageSrc(product);

                    return (
                      <tr
                        key={product.id}
                        className="group border-b border-emerald-50 transition-colors duration-200 hover:bg-emerald-50/45"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <div className="h-16 w-16 overflow-hidden rounded-2xl border border-emerald-100 bg-[#f4f8f3] shadow-sm">
                              {productImage ? (
                                <img
                                  src={productImage}
                                  alt={product.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-emerald-500/80">
                                  <Package className="h-6 w-6" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="max-w-[280px] text-sm font-semibold leading-snug text-slate-900 sm:text-[15px]">
                                {product.name}
                              </p>
                              <p className="mt-1 max-w-[360px] line-clamp-2 text-xs leading-relaxed text-slate-500">
                                {getDisplayDescription(product)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                            {product.category_name || "Uncategorized"}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <p className="text-sm font-bold text-slate-900 sm:text-[15px]">
                            {formatPrice(Number(product.price || 0), settings.currency)}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <p className={`text-sm font-semibold ${isLowStock ? "text-amber-700" : "text-slate-800"}`}>
                            {stock}
                          </p>
                          <p className={`text-xs ${isLowStock ? "text-amber-600" : "text-slate-500"}`}>
                            {isLowStock ? "Low stock" : "Healthy"}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                              status === "active"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                status === "active" ? "bg-emerald-600" : "bg-amber-600"
                              }`}
                            />
                            {status === "active" ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openQrModal(product)}
                              title="Generate QR Code"
                              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm transition-colors duration-200 hover:bg-emerald-50"
                            >
                              <QrCode className="h-4 w-4" />
                              QR
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(product)}
                              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm transition-colors duration-200 hover:bg-emerald-50"
                            >
                              <Pencil className="h-4 w-4" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void removeProduct(product.id)}
                              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 shadow-sm transition-colors duration-200 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-14 text-center">
                      <p className="text-base font-semibold text-slate-700">No products found</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Try a different search term or switch your status filter.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {showFormModal && typeof document !== "undefined"
          ? createPortal(
              <div className="fixed inset-0 z-[120] overflow-hidden">
                <div className="absolute -inset-1 bg-slate-950/80 backdrop-blur-lg" />
                <div className="scrollbar-hide relative flex h-full w-full items-end justify-center overflow-y-auto px-0 pb-0 pt-0 sm:items-center sm:px-4 sm:pb-4 sm:pt-[calc(env(safe-area-inset-top)+1.25rem)]">
                  <div className="flex h-[100dvh] w-full max-w-3xl flex-col overflow-hidden rounded-none border-0 bg-white shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-3xl sm:border sm:border-emerald-100">
              <div className="sticky top-0 z-20 border-b border-emerald-100/90 bg-white/95 px-4 py-4 backdrop-blur-sm sm:px-8 sm:py-5 sm:backdrop-blur-none">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[2rem] font-bold tracking-tight text-slate-900 sm:text-2xl">
                      {editingProduct ? "Edit Product" : "Add Product"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Configure catalog details, stock levels, and publishing status.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 sm:rounded-2xl"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="scrollbar-hide flex-1 overflow-y-auto px-4 py-4 sm:max-h-[72vh] sm:px-8 sm:py-6">
                <div className="space-y-5 sm:space-y-7">
                  <section className="space-y-3 sm:space-y-4">
                    <div className="flex items-center gap-2 text-emerald-700">
                      <Box className="h-4 w-4" />
                      <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">
                        Basic Information
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                      <label className="space-y-1.5 sm:col-span-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Product Name
                        </span>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(event) =>
                            setFormData((prev) => ({ ...prev, name: event.target.value }))
                          }
                          className="h-11 w-full rounded-xl border border-emerald-100 bg-white px-4 text-sm text-slate-700 shadow-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 sm:h-12 sm:rounded-2xl"
                          placeholder="Product name"
                        />
                      </label>

                      <label className="space-y-1.5 sm:col-span-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Category
                        </span>
                        <select
                          value={formData.category_id}
                          onChange={(event) =>
                            setFormData((prev) => ({ ...prev, category_id: event.target.value }))
                          }
                          className="h-11 w-full rounded-xl border border-emerald-100 bg-white px-4 text-sm text-slate-700 shadow-sm outline-none transition-all duration-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 sm:h-12 sm:rounded-2xl"
                        >
                          <option value="">Uncategorized</option>
                          {assignableCategories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-1.5 sm:col-span-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Description
                        </span>
                        <textarea
                          rows={3}
                          value={formData.description}
                          onChange={(event) =>
                            setFormData((prev) => ({ ...prev, description: event.target.value }))
                          }
                          className="w-full rounded-xl border border-emerald-100 bg-white px-4 py-3 text-sm leading-relaxed text-slate-700 shadow-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 sm:rounded-2xl"
                          placeholder="Product description"
                        />
                      </label>

                      <label className="space-y-1.5 sm:col-span-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Ingredients
                        </span>
                        <textarea
                          rows={3}
                          value={formData.ingredients}
                          onChange={(event) =>
                            setFormData((prev) => ({ ...prev, ingredients: event.target.value }))
                          }
                          className="w-full rounded-xl border border-emerald-100 bg-white px-4 py-3 text-sm leading-relaxed text-slate-700 shadow-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 sm:rounded-2xl"
                          placeholder="List ingredients (comma or line separated)"
                        />
                      </label>

                      <label className="space-y-1.5 sm:col-span-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Benefits
                        </span>
                        <textarea
                          rows={3}
                          value={formData.benefits}
                          onChange={(event) =>
                            setFormData((prev) => ({ ...prev, benefits: event.target.value }))
                          }
                          className="w-full rounded-xl border border-emerald-100 bg-white px-4 py-3 text-sm leading-relaxed text-slate-700 shadow-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 sm:rounded-2xl"
                          placeholder="List benefits (comma or line separated)"
                        />
                      </label>

                      <label className="space-y-1.5 sm:col-span-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Usage
                        </span>
                        <textarea
                          rows={3}
                          value={formData.usage}
                          onChange={(event) =>
                            setFormData((prev) => ({ ...prev, usage: event.target.value }))
                          }
                          className="w-full rounded-xl border border-emerald-100 bg-white px-4 py-3 text-sm leading-relaxed text-slate-700 shadow-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 sm:rounded-2xl"
                          placeholder="How to use this product"
                        />
                      </label>
                    </div>
                  </section>

                  <div className="h-px bg-emerald-100" />

                  <section className="space-y-3 sm:space-y-4">
                    <div className="flex items-center gap-2 text-emerald-700">
                      <Package className="h-4 w-4" />
                      <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">
                        Pricing &amp; Inventory
                      </h3>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
                      <label className="space-y-1.5">
                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Price
                        </span>
                        <input
                          type="number"
                          value={formData.price}
                          onChange={(event) =>
                            setFormData((prev) => ({ ...prev, price: event.target.value }))
                          }
                          className="h-11 w-full rounded-xl border border-emerald-100 bg-white px-4 text-sm text-slate-700 shadow-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 sm:h-12 sm:rounded-2xl"
                          placeholder="Price"
                        />
                      </label>

                      <label className="space-y-1.5">
                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Discount %
                        </span>
                        <input
                          type="number"
                          value={formData.discount_percentage}
                          onChange={(event) =>
                            setFormData((prev) => ({ ...prev, discount_percentage: event.target.value }))
                          }
                          className="h-11 w-full rounded-xl border border-emerald-100 bg-white px-4 text-sm text-slate-700 shadow-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 sm:h-12 sm:rounded-2xl"
                          placeholder="Discount %"
                        />
                      </label>

                      <label className="col-span-2 space-y-1.5 sm:col-span-1">
                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Stock Quantity
                        </span>
                        <input
                          type="number"
                          value={formData.stock_quantity}
                          onChange={(event) =>
                            setFormData((prev) => ({ ...prev, stock_quantity: event.target.value }))
                          }
                          className="h-11 w-full rounded-xl border border-emerald-100 bg-white px-4 text-sm text-slate-700 shadow-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 sm:h-12 sm:rounded-2xl"
                          placeholder="Stock quantity"
                        />
                      </label>
                    </div>
                  </section>

                  <div className="h-px bg-emerald-100" />

                  <section className="space-y-3 sm:space-y-4">
                    <div className="flex items-center gap-2 text-emerald-700">
                      <Image className="h-4 w-4" />
                      <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">
                        Main Image
                      </h3>
                    </div>

                    <div className="space-y-3">
                      <label className="block cursor-pointer">
                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Upload Image
                        </span>
                        <div className="mt-1.5 flex items-center gap-3">
                          <label className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 shadow-sm transition-all duration-200 hover:bg-emerald-50 cursor-pointer">
                            <Upload className="h-4 w-4" />
                            {uploadingImage ? 'Uploading...' : 'Choose Image'}
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleImageUpload}
                              disabled={uploadingImage}
                              className="hidden"
                            />
                          </label>
                          <span className="text-xs text-slate-500">
                            Max 5MB • JPG, PNG, GIF, or WebP
                          </span>
                        </div>
                      </label>

                      {formData.image_url && (
                        <div className="space-y-2">
                          <div className="relative inline-block">
                            <img
                              src={getAbsoluteImageUrl(formData.image_url, { defaultFolder: 'products' })}
                              alt="Product preview"
                              className="h-32 w-32 rounded-xl border border-emerald-100 object-cover shadow-sm"
                            />
                            <button
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, image_url: '' }))}
                              className="absolute -right-2 -top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-lg hover:bg-red-600"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                          <p className="text-xs text-slate-500">
                            Current image • Click X to remove
                          </p>
                        </div>
                      )}
                    </div>
                  </section>

                  <div className="h-px bg-emerald-100" />

                  <section className="space-y-3 sm:space-y-4">
                    <div className="flex items-center gap-2 text-emerald-700">
                      <Image className="h-4 w-4" />
                      <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">
                        Additional Images (Gallery)
                      </h3>
                    </div>

                    <div className="space-y-3">
                      <label className="block cursor-pointer">
                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Add Images
                        </span>
                        <div className="mt-1.5 flex items-center gap-3">
                          <label className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 shadow-sm transition-all duration-200 hover:bg-emerald-50 cursor-pointer">
                            <Upload className="h-4 w-4" />
                            {uploadingGallery ? 'Uploading...' : 'Choose Images'}
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={handleGalleryUpload}
                              disabled={uploadingGallery}
                              className="hidden"
                            />
                          </label>
                          <span className="text-xs text-slate-500">
                            Select multiple • Max 5MB each • Shown on the product gallery
                          </span>
                        </div>
                      </label>

                      {(formData.gallery_images?.length || 0) > 0 && (
                        <div className="flex flex-wrap gap-3">
                          {formData.gallery_images.map((url) => (
                            <div key={url} className="relative inline-block group">
                              <img
                                src={getAbsoluteImageUrl(url, { defaultFolder: 'products' })}
                                alt="Gallery preview"
                                className="h-24 w-24 rounded-xl border border-emerald-100 object-cover shadow-sm"
                              />
                              <button
                                type="button"
                                onClick={() => removeGalleryImage(url)}
                                title="Remove image"
                                className="absolute -right-2 -top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow-lg hover:bg-red-600"
                              >
                                <X className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => makeImagePrimary(url)}
                                title="Set as main image"
                                className="absolute inset-x-1 bottom-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                              >
                                Make Main
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>

                  <div className="h-px bg-emerald-100" />

                  <section className="space-y-3 sm:space-y-4">
                    <div className="flex items-center gap-2 text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" />
                      <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-700">
                        Status &amp; Visibility
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="group flex cursor-pointer items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-3.5 transition-all duration-200 hover:border-emerald-200 hover:bg-emerald-50">
                        <input
                          type="checkbox"
                          checked={formData.is_active}
                          onChange={(event) =>
                            setFormData((prev) => ({ ...prev, is_active: event.target.checked }))
                          }
                          className="mt-0.5 h-4 w-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>
                          <span className="text-sm font-semibold text-slate-800">Active</span>
                          <span className="mt-0.5 hidden text-xs text-slate-500 sm:block">
                            Show this product on storefront listings.
                          </span>
                        </span>
                      </label>

                      <label className="group flex cursor-pointer items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-3.5 transition-all duration-200 hover:border-emerald-200 hover:bg-emerald-50">
                        <input
                          type="checkbox"
                          checked={formData.is_featured}
                          onChange={(event) =>
                            setFormData((prev) => ({ ...prev, is_featured: event.target.checked }))
                          }
                          className="mt-0.5 h-4 w-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>
                          <span className="text-sm font-semibold text-slate-800">Featured</span>
                          <span className="mt-0.5 hidden text-xs text-slate-500 sm:block">
                            Highlight this product in premium placements.
                          </span>
                        </span>
                      </label>
                    </div>
                  </section>
                </div>
              </div>

              <div className="sticky bottom-0 z-20 border-t border-emerald-100 bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur-sm sm:px-8 sm:py-4 sm:backdrop-blur-none">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void saveProduct()}
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-[#16a34a] px-5 py-2 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(22,163,74,0.32)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#15803d] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {editingProduct ? "Update Product" : "Create Product"}
                  </button>
                  <button
                    type="button"
                    onClick={closeModal}
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>
                  </div>
                </div>
              </div>,
              document.body,
            )
              : null}

        {showQrModal && qrProductData && typeof document !== "undefined"
          ? createPortal(
              <div className="fixed inset-0 z-[130] overflow-hidden">
                <div className="absolute -inset-1 bg-slate-950/80 backdrop-blur-lg" />
                <div className="relative flex h-full w-full items-end justify-center overflow-y-auto px-0 pb-0 pt-0 sm:items-center sm:px-4 sm:pb-4">
                  <div className="flex w-full max-w-md flex-col overflow-hidden rounded-none border-0 bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-3xl sm:border sm:border-emerald-100">
                    <div className="sticky top-0 z-20 border-b border-emerald-100/90 bg-white/95 px-4 py-4 backdrop-blur-sm sm:px-6 sm:py-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                            Product QR Code
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            Scan to view product details
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={closeQrModal}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
                      <ProductQRCode
                        productId={qrProductData.productId}
                        productName={qrProductData.productName}
                        productSlug={qrProductData.productSlug}
                      />
                    </div>
                  </div>
                </div>
              </div>,
              document.body,
            )
          : null}
      </div>
    </AdminLayout>
  );
}
