import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Trash2,
  X,
  XCircle,
  Upload,
  Image as ImageIcon,
} from 'lucide-react';
import { AdminLayout } from '@/components/AdminLayout';
import { categoryAPI } from '@/services/api';
import { useSWRCache, invalidateSWRKey } from '@/hooks/useSWRCache';

const CATEGORIES_CACHE_KEY = 'admin:categories';

const CATEGORY_TYPE_OPTIONS = [
  {
    value: 'shop',
    label: 'Shop Section',
    hint: 'Used in shop filters and category sidebar',
  },
  {
    value: 'shop_by_category',
    label: 'Shop by Categories',
    hint: 'Used in homepage category cards',
  },
  {
    value: 'both',
    label: 'Shared (Both)',
    hint: 'Visible in both sections',
  },
];

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active only' },
  { value: 'inactive', label: 'Inactive only' },
];

const parseApiList = (payload) => (Array.isArray(payload) ? payload : payload?.data || []);

const normalizeCategoryType = (value) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();

  if (normalized === 'shop' || normalized === 'shop_by_category' || normalized === 'both') {
    return normalized;
  }

  return 'both';
};

const getCategoryTypeMeta = (categoryType) => {
  if (categoryType === 'shop') {
    return {
      label: 'Shop Section',
      badge: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
    };
  }

  if (categoryType === 'shop_by_category') {
    return {
      label: 'Shop by Categories',
      badge: 'bg-blue-100 text-blue-800 border border-blue-200',
    };
  }

  return {
    label: 'Shared (Both)',
    badge: 'bg-violet-100 text-violet-800 border border-violet-200',
  };
};

const matchesCategoryTypeFilter = (categoryType, typeFilter) => {
  if (typeFilter === 'all') {
    return true;
  }

  if (typeFilter === 'shop') {
    return categoryType === 'shop' || categoryType === 'both';
  }

  if (typeFilter === 'shop_by_category') {
    return categoryType === 'shop_by_category' || categoryType === 'both';
  }

  if (typeFilter === 'both') {
    return categoryType === 'both';
  }

  return true;
};

const formatDate = (value) => {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '-';
  }

  return parsed.toLocaleDateString();
};

export default function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionMessage, setActionMessage] = useState('');
  const [mobileView, setMobileView] = useState('list');

  const [newCategory, setNewCategory] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newImageFile, setNewImageFile] = useState(null);
  const [newImagePreview, setNewImagePreview] = useState('');
  const [newCategoryType, setNewCategoryType] = useState('both');
  const [submitting, setSubmitting] = useState(false);
  const [rowSavingId, setRowSavingId] = useState(null);

  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [editingDescription, setEditingDescription] = useState('');
  const [editingImageUrl, setEditingImageUrl] = useState('');
  const [editImageFile, setEditImageFile] = useState(null);
  const [editImagePreview, setEditImagePreview] = useState('');
  const [editingCategoryType, setEditingCategoryType] = useState('both');

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // SWR caches the categories list so re-visits to this section show
  // instantly while a background refresh keeps the data fresh.
  const {
    data: cachedCategoriesData,
    loading: swrLoading,
    revalidating,
    error: swrError,
    refresh: swrRefresh,
  } = useSWRCache(CATEGORIES_CACHE_KEY, () =>
    categoryAPI.getAll({ include_inactive: true }),
  );

  // Sync SWR state into the existing local state so the rest of the page
  // (filters, edit drafts, mutations) keeps working unchanged.
  useEffect(() => {
    if (cachedCategoriesData !== null && cachedCategoriesData !== undefined) {
      setCategories(parseApiList(cachedCategoriesData));
    }
  }, [cachedCategoriesData]);

  useEffect(() => {
    setLoading(swrLoading);
  }, [swrLoading]);

  useEffect(() => {
    if (!swrError) return;
    setError(swrError?.response?.data?.error || swrError.message || 'Failed to fetch categories');
  }, [swrError]);

  const fetchCategories = useCallback(async () => {
    setActionMessage('');
    invalidateSWRKey(CATEGORIES_CACHE_KEY);
    await swrRefresh();
  }, [swrRefresh]);

  const notifyCategoriesUpdated = useCallback(() => {
    window.dispatchEvent(new Event('categories:updated'));
  }, []);

  const startEditing = (category) => {
    setEditingId(category.id);
    setEditingName(category.name || '');
    setEditingDescription(category.description || '');
    setEditingImageUrl(category.image_url || '');
    setEditImageFile(null);
    setEditImagePreview(category.image_url || '');
    setEditingCategoryType(normalizeCategoryType(category.category_type));
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingName('');
    setEditingDescription('');
    setEditingImageUrl('');
    setEditImageFile(null);
    setEditImagePreview('');
    setEditingCategoryType('both');
  };

  const handleAddCategory = async () => {
    const trimmed = newCategory.trim();
    if (!trimmed || submitting) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setActionMessage('');

      let imageUrl = null;
      if (newImageFile) {
        const uploadRes = await categoryAPI.uploadImage(newImageFile);
        imageUrl = uploadRes.imageUrl;
      }

      await categoryAPI.create({
        name: trimmed,
        description: newDescription.trim() || null,
        image_url: imageUrl,
        category_type: newCategoryType,
        is_active: true,
      });

      setNewCategory('');
      setNewDescription('');
      setNewImageFile(null);
      setNewImagePreview('');
      setNewCategoryType('both');
      await fetchCategories();
      setActionMessage('Category added successfully.');
      notifyCategoriesUpdated();
    } catch (requestError) {
      setError(requestError?.response?.data?.error || requestError.message || 'Failed to add category');
    } finally {
      setSubmitting(false);
    }
  };

  const saveCategory = async (category) => {
    const trimmedName = editingName.trim();
    if (!trimmedName) {
      setError('Category name is required.');
      return;
    }

    try {
      setRowSavingId(category.id);
      setError(null);
      setActionMessage('');

      let imageUrl = editingImageUrl.trim() || null;
      if (editImageFile) {
        const uploadRes = await categoryAPI.uploadImage(editImageFile);
        imageUrl = uploadRes.imageUrl;
      }

      await categoryAPI.update(category.id, {
        name: trimmedName,
        description: editingDescription.trim() || null,
        image_url: imageUrl,
        category_type: editingCategoryType,
        is_active: category.is_active === false || category.is_active === 0 ? false : true,
      });

      cancelEditing();
      await fetchCategories();
      setActionMessage('Category updated successfully.');
      notifyCategoriesUpdated();
    } catch (requestError) {
      setError(requestError?.response?.data?.error || requestError.message || 'Failed to update category');
    } finally {
      setRowSavingId(null);
    }
  };

  const toggleCategoryActive = async (category) => {
    try {
      setRowSavingId(category.id);
      setError(null);
      setActionMessage('');

      const currentlyActive = !(category.is_active === false || category.is_active === 0);
      await categoryAPI.update(category.id, {
        name: category.name,
        description: category.description || null,
        image_url: category.image_url || null,
        category_type: normalizeCategoryType(category.category_type),
        is_active: !currentlyActive,
      });

      await fetchCategories();
      setActionMessage('Category status updated.');
      notifyCategoriesUpdated();
    } catch (requestError) {
      setError(
        requestError?.response?.data?.error ||
          requestError.message ||
          'Failed to update category status',
      );
    } finally {
      setRowSavingId(null);
    }
  };

  const deleteCategory = async (category) => {
    if (!window.confirm(`Delete category "${category.name}"?`)) {
      return;
    }

    try {
      setRowSavingId(category.id);
      setError(null);
      setActionMessage('');
      await categoryAPI.delete(category.id);
      await fetchCategories();
      setActionMessage('Category deleted successfully.');
      notifyCategoriesUpdated();
    } catch (requestError) {
      setError(requestError?.response?.data?.error || requestError.message || 'Failed to delete category');
    } finally {
      setRowSavingId(null);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAddCategory();
    }
  };

  const dashboardStats = useMemo(() => {
    const total = categories.length;
    const inactive = categories.filter(
      (category) => category.is_active === false || category.is_active === 0,
    ).length;
    const shopVisible = categories.filter((category) =>
      matchesCategoryTypeFilter(normalizeCategoryType(category.category_type), 'shop'),
    ).length;
    const homeVisible = categories.filter((category) =>
      matchesCategoryTypeFilter(normalizeCategoryType(category.category_type), 'shop_by_category'),
    ).length;
    const shared = categories.filter(
      (category) => normalizeCategoryType(category.category_type) === 'both',
    ).length;

    return {
      total,
      inactive,
      shopVisible,
      homeVisible,
      shared,
    };
  }, [categories]);

  const mobileSummaryItems = useMemo(
    () => [
      { key: 'total', label: 'Total', value: dashboardStats.total },
      { key: 'shop', label: 'Shop Section', value: dashboardStats.shopVisible },
      { key: 'home', label: 'Shop by Categories', value: dashboardStats.homeVisible },
      { key: 'shared', label: 'Shared', value: dashboardStats.shared },
      { key: 'inactive', label: 'Inactive', value: dashboardStats.inactive },
    ],
    [dashboardStats.homeVisible, dashboardStats.inactive, dashboardStats.shared, dashboardStats.shopVisible, dashboardStats.total],
  );

  const typeTabs = useMemo(() => {
    const getCount = (value) =>
      categories.filter((category) => {
        const categoryType = normalizeCategoryType(category.category_type);
        return matchesCategoryTypeFilter(categoryType, value);
      }).length;

    return [
      { value: 'all', label: 'All', count: categories.length },
      { value: 'shop', label: 'Shop Section', count: getCount('shop') },
      {
        value: 'shop_by_category',
        label: 'Shop by Categories',
        count: getCount('shop_by_category'),
      },
      { value: 'both', label: 'Shared', count: getCount('both') },
    ];
  }, [categories]);

  const filteredCategories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return categories.filter((category) => {
      const categoryType = normalizeCategoryType(category.category_type);
      const isActive = !(category.is_active === false || category.is_active === 0);

      if (!matchesCategoryTypeFilter(categoryType, typeFilter)) {
        return false;
      }

      if (statusFilter === 'active' && !isActive) {
        return false;
      }

      if (statusFilter === 'inactive' && isActive) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchable = [
        category.name,
        category.slug,
        category.description,
        category.image_url,
        categoryType,
      ]
        .map((value) => String(value || '').toLowerCase())
        .join(' ');

      return searchable.includes(query);
    });
  }, [categories, searchQuery, statusFilter, typeFilter]);

  return (
    <AdminLayout>
      <div className="mx-auto w-full max-w-[1240px] space-y-4 sm:space-y-6">
        <section className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/30 to-[#f5fbf4] p-4 shadow-[0_16px_38px_rgba(15,64,28,0.1)] sm:p-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700/80">
                Catalog Management
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Manage Categories
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                Manage Shop Section and Shop by Categories independently while keeping shared
                categories in one place.
              </p>
            </div>

            <div className="flex w-full justify-end lg:w-auto">
              <button
                type="button"
                onClick={fetchCategories}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 text-sm font-semibold text-emerald-800 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50 sm:h-10"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 md:hidden">
            {mobileSummaryItems.map((item, index) => (
              <article
                key={item.key}
                className={`${index === 4 ? 'col-span-2' : 'col-span-1'} rounded-xl border border-emerald-100 bg-white px-3 py-2.5 shadow-[0_8px_20px_rgba(15,64,28,0.08)]`}
              >
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                  {item.label}
                </p>
                <p className="mt-0.5 text-xl font-bold text-slate-900">{item.value}</p>
              </article>
            ))}
          </div>

          <div className="mt-5 hidden gap-3 md:grid md:grid-cols-2 xl:grid-cols-5">
            <article className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-[0_10px_28px_rgba(15,64,28,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(15,64,28,0.16)]">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Total</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{dashboardStats.total}</p>
            </article>
            <article className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-[0_10px_28px_rgba(15,64,28,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(15,64,28,0.16)]">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Shop Section
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{dashboardStats.shopVisible}</p>
            </article>
            <article className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-[0_10px_28px_rgba(15,64,28,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(15,64,28,0.16)]">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Shop by Categories
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{dashboardStats.homeVisible}</p>
            </article>
            <article className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-[0_10px_28px_rgba(15,64,28,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(15,64,28,0.16)]">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Shared</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{dashboardStats.shared}</p>
            </article>
            <article className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-[0_10px_28px_rgba(15,64,28,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_34px_rgba(15,64,28,0.16)]">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Inactive</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{dashboardStats.inactive}</p>
            </article>
          </div>
        </section>

        {error ? (
          <div className="inline-flex w-full items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 shadow-sm">
            <XCircle className="h-5 w-5" />
            {error}
          </div>
        ) : null}

        {actionMessage ? (
          <div className="inline-flex w-full items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 shadow-sm">
            <CheckCircle2 className="h-5 w-5" />
            {actionMessage}
          </div>
        ) : null}

        <section className="md:hidden">
          <div className="inline-flex w-full rounded-2xl border border-emerald-100 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setMobileView('list')}
              className={`inline-flex min-h-[34px] flex-1 items-center justify-center rounded-xl px-3 text-xs font-semibold transition-colors ${
                mobileView === 'list' ? 'bg-emerald-700 text-white' : 'text-slate-600'
              }`}
            >
              Browse
            </button>
            <button
              type="button"
              onClick={() => setMobileView('create')}
              className={`inline-flex min-h-[34px] flex-1 items-center justify-center rounded-xl px-3 text-xs font-semibold transition-colors ${
                mobileView === 'create' ? 'bg-emerald-700 text-white' : 'text-slate-600'
              }`}
            >
              Create
            </button>
          </div>
        </section>

        <section className={`rounded-3xl border border-emerald-100 bg-white p-4 shadow-[0_14px_30px_rgba(15,64,28,0.08)] sm:p-5 ${mobileView === 'list' ? 'hidden md:block' : 'block'}`}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Create Category</h2>
              <p className="text-sm text-slate-500">
                Choose where this category should appear in storefront.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.1fr_1.4fr_1fr_0.9fr_auto]">
            <input
              type="text"
              value={newCategory}
              onChange={(event) => setNewCategory(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Category name"
              className="h-11 rounded-xl border border-emerald-100 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            />
            <input
              type="text"
              value={newDescription}
              onChange={(event) => setNewDescription(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Description (optional)"
              className="h-11 rounded-xl border border-emerald-100 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            />
            <div className="flex items-center gap-2">
              <label className="relative flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-emerald-100 bg-white px-3 text-sm text-slate-500 shadow-sm transition-all duration-200 hover:border-emerald-400 hover:bg-emerald-50">
                <Upload className="h-4 w-4 text-emerald-600" />
                <span className="truncate max-w-[120px]">{newImageFile ? newImageFile.name : 'Choose Image'}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files[0];
                    if (file) {
                      setNewImageFile(file);
                      setNewImagePreview(URL.createObjectURL(file));
                    }
                  }}
                />
              </label>
              {newImagePreview && (
                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-emerald-100">
                  <img src={newImagePreview} alt="Preview" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => { setNewImageFile(null); setNewImagePreview(''); }}
                    className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow-sm"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
            <select
              value={newCategoryType}
              onChange={(event) => setNewCategoryType(event.target.value)}
              className="h-11 rounded-xl border border-emerald-100 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none transition-all duration-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            >
              {CATEGORY_TYPE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAddCategory}
              disabled={submitting || !newCategory.trim()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#16a34a] px-4 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(22,163,74,0.32)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#15803d] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              {submitting ? 'Saving...' : 'Add'}
            </button>
          </div>

        </section>

        <section className={`rounded-3xl border border-emerald-100 bg-white shadow-[0_14px_30px_rgba(15,64,28,0.08)] ${mobileView === 'create' ? 'hidden md:block' : 'block'}`}>
          <div className="flex flex-col gap-3 border-b border-emerald-100 p-4 sm:p-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="inline-flex w-full flex-wrap items-center gap-1 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-1 xl:w-auto">
              {typeTabs.map((tab) => {
                const isActive = typeFilter === tab.value;

                return (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setTypeFilter(tab.value)}
                    className={`inline-flex min-h-[34px] items-center justify-center gap-1 rounded-xl px-3 py-1 text-xs font-semibold transition-all duration-200 sm:px-4 ${
                      isActive
                        ? 'bg-[#16a34a] text-white shadow-[0_8px_18px_rgba(22,163,74,0.28)]'
                        : 'text-slate-600 hover:bg-white hover:text-emerald-800'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`${isActive ? 'text-emerald-100' : 'text-slate-400'}`}>
                      ({tab.count})
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
              <label className="relative w-full sm:min-w-[260px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search categories"
                  className="h-10 w-full rounded-xl border border-emerald-100 bg-white pl-10 pr-3 text-sm text-slate-700 shadow-sm outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                />
              </label>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-10 rounded-xl border border-emerald-100 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none transition-all duration-200 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              >
                {STATUS_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[220px] items-center justify-center">
              <p className="text-sm font-medium text-slate-500">Loading categories...</p>
            </div>
          ) : (
            <div className="max-h-[58vh] overflow-auto md:max-h-[64vh]">
              <table className="min-w-full table-auto">
                <thead className="sticky top-0 z-10 bg-[#f8faf7] shadow-[0_1px_0_rgba(148,163,184,0.16)]">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Category
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Placement
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Updated
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCategories.length > 0 ? (
                    filteredCategories.map((category) => {
                      const isEditing = editingId === category.id;
                      const isActive = !(category.is_active === false || category.is_active === 0);
                      const categoryType = normalizeCategoryType(category.category_type);
                      const typeMeta = getCategoryTypeMeta(categoryType);
                      const isBusy = rowSavingId === category.id;

                      return (
                        <tr key={category.id} className="border-t border-emerald-100 align-top hover:bg-emerald-50/40">
                          <td className="px-4 py-2.5 text-sm font-semibold text-slate-500">{category.id}</td>

                          <td className="px-4 py-2.5">
                            {isEditing ? (
                              <div className="space-y-2">
                                <input
                                  value={editingName}
                                  onChange={(event) => setEditingName(event.target.value)}
                                  className="h-9 w-full rounded-lg border border-emerald-100 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                                  placeholder="Category name"
                                />
                                <input
                                  value={editingDescription}
                                  onChange={(event) => setEditingDescription(event.target.value)}
                                  className="h-9 w-full rounded-lg border border-emerald-100 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                                  placeholder="Description"
                                />
                                <div className="flex items-center gap-2">
                                  <label className="relative flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-emerald-100 bg-white px-3 text-sm text-slate-500 transition-all hover:border-emerald-400 hover:bg-emerald-50">
                                    <Upload className="h-3.5 w-3.5 text-emerald-600" />
                                    <span className="truncate max-w-[100px]">{editImageFile ? editImageFile.name : 'Choose Image'}</span>
                                    <input
                                      type="file"
                                      accept="image/jpeg,image/png,image/gif,image/webp"
                                      className="hidden"
                                      onChange={(event) => {
                                        const file = event.target.files[0];
                                        if (file) {
                                          setEditImageFile(file);
                                          setEditImagePreview(URL.createObjectURL(file));
                                        }
                                      }}
                                    />
                                  </label>
                                  {editImagePreview && (
                                    <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-emerald-100">
                                      <img src={editImagePreview} alt="Preview" className="h-full w-full object-cover" />
                                      <button
                                        type="button"
                                        onClick={() => { setEditImageFile(null); setEditImagePreview(''); setEditingImageUrl(''); }}
                                        className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white shadow-sm"
                                      >
                                        <X className="h-2.5 w-2.5" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start gap-2.5">
                                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-emerald-100 bg-[#f4f8f3]">
                                  {category.image_url ? (
                                    <img
                                      src={category.image_url}
                                      alt={category.name}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-emerald-600/80">
                                      <Tag className="h-4 w-4" />
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-900">{category.name}</p>
                                  <p className="text-xs text-slate-500">{category.slug || '-'}</p>
                                  <p className="mt-0.5 max-w-[420px] truncate text-xs text-slate-500">
                                    {category.description || 'No description added yet.'}
                                  </p>
                                </div>
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-2.5">
                            {isEditing ? (
                              <select
                                value={editingCategoryType}
                                onChange={(event) => setEditingCategoryType(event.target.value)}
                                className="h-9 w-full rounded-lg border border-emerald-100 bg-white px-3 text-sm text-slate-700 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                              >
                                {CATEGORY_TYPE_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${typeMeta.badge}`}
                              >
                                {typeMeta.label}
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-2.5">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                                isActive
                                  ? 'border border-emerald-200 bg-emerald-100 text-emerald-800'
                                  : 'border border-slate-200 bg-slate-100 text-slate-700'
                              }`}
                            >
                              {isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>

                          <td className="px-4 py-2.5 text-sm text-slate-500">
                            {formatDate(category.updated_at || category.created_at)}
                          </td>

                          <td className="px-4 py-2.5">
                            <div className="flex items-center justify-end gap-2">
                              {isEditing ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => saveCategory(category)}
                                    disabled={isBusy}
                                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <CheckCircle2 className="h-4 w-4" />
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    onClick={cancelEditing}
                                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition-all duration-200 hover:bg-slate-50"
                                  >
                                    <X className="h-4 w-4" />
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => startEditing(category)}
                                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 text-sm font-semibold text-emerald-700 transition-all duration-200 hover:bg-emerald-50"
                                  >
                                    <Pencil className="h-4 w-4" />
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => toggleCategoryActive(category)}
                                    disabled={isBusy}
                                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition-all duration-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {isActive ? (
                                      <XCircle className="h-4 w-4" />
                                    ) : (
                                      <CheckCircle2 className="h-4 w-4" />
                                    )}
                                    {isActive ? 'Disable' : 'Enable'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => deleteCategory(category)}
                                    disabled={isBusy}
                                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-red-600 px-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center">
                        <p className="text-sm font-semibold text-slate-600">No categories found.</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Change search or filters, or create a new category.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </div>
    </AdminLayout>
  );
}
