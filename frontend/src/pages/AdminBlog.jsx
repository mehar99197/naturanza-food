import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { blogAPI } from "@/services/api";
import { getAbsoluteImageUrl } from "@/lib/imageUtils";

const EMPTY_FORM = {
  id: null,
  title: "",
  slug: "",
  category: "",
  excerpt: "",
  content: "",
  author: "Naturanza Food Team",
  read_time: "",
  keywords: "",
  image_url: "",
  featured: false,
  is_published: true,
};

const inputClass =
  "mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-slate-800 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-100";
const labelClass = "block text-xs font-semibold uppercase tracking-wide text-slate-600";

export function AdminBlog() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const rows = await blogAPI.getAllAdmin();
      setPosts(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to load posts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(""), 2500);
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setError("");
    setShowForm(true);
  };

  const openEdit = (post) => {
    setForm({
      id: post.id,
      title: post.title || "",
      slug: post.slug || "",
      category: post.category || "",
      excerpt: post.excerpt || "",
      content: post.content || "",
      author: post.author || "Naturanza Food Team",
      read_time: post.read_time || "",
      keywords: post.keywords || "",
      image_url: post.image_url || "",
      featured: Boolean(post.featured),
      is_published: post.is_published === undefined ? true : Boolean(post.is_published),
    });
    setError("");
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setForm(EMPTY_FORM);
  };

  const handleChange = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const res = await blogAPI.uploadImage(file);
      if (res?.imageUrl) handleChange("image_url", res.imageUrl);
    } catch (err) {
      setError(err?.response?.data?.error || "Image upload failed");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      setError("Title and content are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        title: form.title.trim(),
        slug: form.slug.trim() || undefined,
        category: form.category.trim() || null,
        excerpt: form.excerpt.trim() || null,
        content: form.content,
        author: form.author.trim() || "Naturanza Food Team",
        read_time: form.read_time.trim() || null,
        keywords: form.keywords.trim() || null,
        image_url: form.image_url || null,
        featured: form.featured,
        is_published: form.is_published,
      };
      if (form.id) {
        await blogAPI.update(form.id, payload);
        showToast("Post updated");
      } else {
        await blogAPI.create(payload);
        showToast("Post created");
      }
      closeForm();
      await load();
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to save post");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (post) => {
    if (!window.confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
    try {
      await blogAPI.delete(post.id);
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      showToast("Post deleted");
    } catch (err) {
      setError(err?.response?.data?.error || "Failed to delete post");
    }
  };

  return (
    <AdminLayout>
      <div className="mx-auto w-full max-w-[1100px] space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Blog</h1>
            <p className="text-sm text-slate-600">Write and manage articles shown on the public blog.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-green-600 px-4 text-sm font-semibold text-white hover:bg-green-700"
            >
              <Plus className="h-4 w-4" />
              New Post
            </button>
          </div>
        </div>

        {error && !showForm && (
          <div className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-green-600" />
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-2xl border border-emerald-100 bg-white p-12 text-center text-slate-500">
            <p className="font-semibold text-slate-700">No posts yet</p>
            <p className="mt-1 text-sm">Click "New Post" to write your first article.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {posts.map((post) => (
              <div
                key={post.id}
                className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-white p-3.5 shadow-sm"
              >
                <div className="h-14 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-emerald-50">
                  {post.image_url ? (
                    <img
                      src={getAbsoluteImageUrl(post.image_url, { defaultFolder: "blog" })}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xl">📝</div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-semibold text-slate-900">{post.title}</p>
                    {post.featured ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        <Star className="h-3 w-3" /> Featured
                      </span>
                    ) : null}
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        post.is_published ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {post.is_published ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      {post.is_published ? "Published" : "Draft"}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {post.category || "Uncategorized"} • {post.date} • /blog/{post.slug}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEdit(post)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(post)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-100 text-red-600 hover:bg-red-50"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast &&
        createPortal(
          <div className="fixed bottom-6 left-1/2 z-[120] -translate-x-1/2 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-xl">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            {toast}
          </div>,
          document.body,
        )}

      {showForm &&
        createPortal(
          <div className="fixed inset-0 z-[110] flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8">
            <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
              <div className="sticky top-0 flex items-center justify-between rounded-t-2xl border-b border-gray-100 bg-white px-5 py-3.5">
                <h2 className="text-lg font-bold text-slate-900">{form.id ? "Edit Post" : "New Post"}</h2>
                <button type="button" onClick={closeForm} className="rounded-lg p-1.5 text-slate-400 hover:bg-gray-100">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
                )}

                <label className="block">
                  <span className={labelClass}>Title *</span>
                  <input className={inputClass} value={form.title} onChange={(e) => handleChange("title", e.target.value)} placeholder="Post title" />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className={labelClass}>Category</span>
                    <input className={inputClass} value={form.category} onChange={(e) => handleChange("category", e.target.value)} placeholder="e.g. Honey" />
                  </label>
                  <label className="block">
                    <span className={labelClass}>Read time</span>
                    <input className={inputClass} value={form.read_time} onChange={(e) => handleChange("read_time", e.target.value)} placeholder="e.g. 5 min read" />
                  </label>
                </div>

                <label className="block">
                  <span className={labelClass}>Slug (optional — auto from title)</span>
                  <input className={inputClass} value={form.slug} onChange={(e) => handleChange("slug", e.target.value)} placeholder="auto-generated if empty" />
                </label>

                <label className="block">
                  <span className={labelClass}>Excerpt (short summary)</span>
                  <textarea className={`${inputClass} min-h-[60px]`} value={form.excerpt} onChange={(e) => handleChange("excerpt", e.target.value)} placeholder="One or two lines shown on the blog list" />
                </label>

                <label className="block">
                  <span className={labelClass}>Content (Markdown)</span>
                  <textarea
                    className={`${inputClass} min-h-[260px] font-mono text-[13px] leading-6`}
                    value={form.content}
                    onChange={(e) => handleChange("content", e.target.value)}
                    placeholder={"## Heading\n\nWrite with **bold**, lists, [links](/shop), and | tables |."}
                  />
                  <span className="mt-1 block text-[11px] text-slate-400">
                    Supports Markdown: ## headings, **bold**, - lists, 1. numbered, [text](/link), and | tables |.
                  </span>
                </label>

                {/* Cover image */}
                <div>
                  <span className={labelClass}>Cover image</span>
                  <div className="mt-1.5 flex items-center gap-3">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">
                      <Upload className="h-4 w-4" />
                      {uploading ? "Uploading..." : "Upload image"}
                      <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploading} className="hidden" />
                    </label>
                    {form.image_url ? (
                      <div className="relative">
                        <img
                          src={getAbsoluteImageUrl(form.image_url, { defaultFolder: "blog" })}
                          alt=""
                          className="h-14 w-24 rounded-lg border border-emerald-100 object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleChange("image_url", "")}
                          className="absolute -right-2 -top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className={labelClass}>Author</span>
                    <input className={inputClass} value={form.author} onChange={(e) => handleChange("author", e.target.value)} />
                  </label>
                  <label className="block">
                    <span className={labelClass}>SEO keywords (comma separated)</span>
                    <input className={inputClass} value={form.keywords} onChange={(e) => handleChange("keywords", e.target.value)} placeholder="pure honey, benefits" />
                  </label>
                </div>

                <div className="flex flex-wrap gap-5 pt-1">
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input type="checkbox" checked={form.featured} onChange={(e) => handleChange("featured", e.target.checked)} className="h-4 w-4 rounded accent-green-600" />
                    Featured
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input type="checkbox" checked={form.is_published} onChange={(e) => handleChange("is_published", e.target.checked)} className="h-4 w-4 rounded accent-green-600" />
                    Published
                  </label>
                </div>
              </div>

              <div className="sticky bottom-0 flex justify-end gap-2 rounded-b-2xl border-t border-gray-100 bg-white px-5 py-3.5">
                <button type="button" onClick={closeForm} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-green-600 px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {form.id ? "Save Changes" : "Create Post"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </AdminLayout>
  );
}

export default AdminBlog;
