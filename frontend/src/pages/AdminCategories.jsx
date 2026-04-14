import { useCallback, useEffect, useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { categoryAPI } from '@/services/api';

export default function AdminCategories() {
 const [categories, setCategories] = useState([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState(null);
 const [newCategory, setNewCategory] = useState('');
 const [newDescription, setNewDescription] = useState('');
 const [submitting, setSubmitting] = useState(false);
 const [editingId, setEditingId] = useState(null);
 const [editingName, setEditingName] = useState('');
 const [editingDescription, setEditingDescription] = useState('');

 const fetchCategories = useCallback(async () => {
 try {
 setLoading(true);
 setError(null);
 const data = await categoryAPI.getAll();
 const list = Array.isArray(data) ? data : data.data || [];
 setCategories(list);
 } catch (err) {
 setError(err?.response?.data?.error || err.message || 'Failed to fetch categories');
 } finally {
 setLoading(false);
 }
 }, []);

 useEffect(() => {
 fetchCategories();
 }, [fetchCategories]);

 const handleAddCategory = async () => {
 const trimmed = newCategory.trim();
 if (!trimmed || submitting) return;

 try {
 setSubmitting(true);
 setError(null);
 await categoryAPI.create({
 name: trimmed,
 description: newDescription.trim() || null,
 });
 setNewCategory('');
 setNewDescription('');
 await fetchCategories();
 } catch (err) {
 setError(err?.response?.data?.error || err.message || 'Failed to add category');
 } finally {
 setSubmitting(false);
 }
 };

 const startEditing = (category) => {
 setEditingId(category.id);
 setEditingName(category.name || '');
 setEditingDescription(category.description || '');
 };

 const cancelEditing = () => {
 setEditingId(null);
 setEditingName('');
 setEditingDescription('');
 };

 const saveCategory = async (category) => {
 try {
 await categoryAPI.update(category.id, {
 name: editingName.trim(),
 description: editingDescription.trim() || null,
 image_url: category.image_url || null,
 is_active: category.is_active !== false,
 });
 cancelEditing();
 await fetchCategories();
 } catch (err) {
 setError(err?.response?.data?.error || err.message || 'Failed to update category');
 }
 };

 const toggleCategoryActive = async (category) => {
 try {
 await categoryAPI.update(category.id, {
 name: category.name,
 description: category.description || null,
 image_url: category.image_url || null,
 is_active: !(category.is_active === false || category.is_active === 0),
 });
 await fetchCategories();
 } catch (err) {
 setError(err?.response?.data?.error || err.message || 'Failed to update category status');
 }
 };

 const deleteCategory = async (category) => {
 if (!confirm(`Delete category "${category.name}"?`)) {
 return;
 }

 try {
 await categoryAPI.delete(category.id);
 await fetchCategories();
 } catch (err) {
 setError(err?.response?.data?.error || err.message || 'Failed to delete category');
 }
 };

 const handleKeyDown = (e) => {
 if (e.key === 'Enter') {
 e.preventDefault();
 handleAddCategory();
 }
 };

 return (
 <AdminLayout>
 <div className="max-w-5xl mx-auto space-y-4">
 <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Manage Categories</h1>

 {error && (
 <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl">
 Error: {error}
 </div>
 )}

 <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3">
 <input
 type="text"
 value={newCategory}
 onChange={(e) => setNewCategory(e.target.value)}
 onKeyDown={handleKeyDown}
 placeholder="Category name"
 className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
 />
 <input
 type="text"
 value={newDescription}
 onChange={(e) => setNewDescription(e.target.value)}
 onKeyDown={handleKeyDown}
 placeholder="Description (optional)"
 className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
 />
 <button
 onClick={handleAddCategory}
 disabled={submitting || !newCategory.trim()}
 className="px-4 py-2 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-50"
 >
 {submitting ? 'Saving...' : 'Add'}
 </button>
 </div>

 {loading ? (
 <div className="flex items-center justify-center min-h-[200px]">
 <p className="text-gray-600">Loading categories...</p>
 </div>
 ) : (
 <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
 <table className="w-full table-auto">
 <thead className="bg-gray-50">
 <tr>
 <th className="border px-4 py-2 text-left font-semibold text-gray-700">ID</th>
 <th className="border px-4 py-2 text-left font-semibold text-gray-700">Name</th>
 <th className="border px-4 py-2 text-left font-semibold text-gray-700">Description</th>
 <th className="border px-4 py-2 text-left font-semibold text-gray-700">Status</th>
 <th className="border px-4 py-2 text-right font-semibold text-gray-700">Actions</th>
 </tr>
 </thead>
 <tbody>
 {categories.map((category) => {
 const isEditing = editingId === category.id;
 const isActive = category.is_active === true || category.is_active === 1;

 return (
 <tr key={category.id} className="hover:bg-gray-50">
 <td className="border px-4 py-2 text-gray-600">{category.id}</td>
 <td className="border px-4 py-2 text-gray-900">
 {isEditing ? (
 <input
 value={editingName}
 onChange={(e) => setEditingName(e.target.value)}
 className="w-full border border-gray-300 rounded px-2 py-1"
 />
 ) : (
 category.name
 )}
 </td>
 <td className="border px-4 py-2 text-gray-700">
 {isEditing ? (
 <input
 value={editingDescription}
 onChange={(e) => setEditingDescription(e.target.value)}
 className="w-full border border-gray-300 rounded px-2 py-1"
 />
 ) : (
 category.description || '-'
 )}
 </td>
 <td className="border px-4 py-2">
 <span className={`px-2 py-1 rounded text-xs font-semibold ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
 {isActive ? 'Active' : 'Inactive'}
 </span>
 </td>
 <td className="border px-4 py-2">
 <div className="flex items-center justify-end gap-2">
 {isEditing ? (
 <>
 <button
 onClick={() => saveCategory(category)}
 className="px-3 py-1 rounded bg-green-600 text-white text-sm"
 >
 Save
 </button>
 <button
 onClick={cancelEditing}
 className="px-3 py-1 rounded border border-gray-300 text-sm"
 >
 Cancel
 </button>
 </>
 ) : (
 <>
 <button
 onClick={() => startEditing(category)}
 className="px-3 py-1 rounded border border-gray-300 text-sm"
 >
 Edit
 </button>
 <button
 onClick={() => toggleCategoryActive(category)}
 className="px-3 py-1 rounded border border-gray-300 text-sm"
 >
 {isActive ? 'Disable' : 'Enable'}
 </button>
 <button
 onClick={() => deleteCategory(category)}
 className="px-3 py-1 rounded bg-red-600 text-white text-sm"
 >
 Delete
 </button>
 </>
 )}
 </div>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 )}
 </div>
 </AdminLayout>
 );
}