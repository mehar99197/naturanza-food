import { useState } from 'react';
import { AdminLayout } from '@/components/AdminLayout';
import { 
 Plus, 
 Edit, 
 Trash2, 
 Search,
 Upload,
 X,
 Save,
 AlertCircle
} from 'lucide-react';
import { useAdminData } from '@/context/AdminDataContext';
import { useSettings } from '@/context/SettingsContext';
import { formatPrice } from '@/lib/utils';

export function AdminProducts() {
 const { products, categories, addProduct, updateProduct, deleteProduct } = useAdminData();
 const { settings } = useSettings();
 const [searchQuery, setSearchQuery] = useState('');
 const [showModal, setShowModal] = useState(false);
 const [editingProduct, setEditingProduct] = useState(null);
 const [imagePreview, setImagePreview] = useState('');
 const [showSuccessToast, setShowSuccessToast] = useState(false);
 const [toastMessage, setToastMessage] = useState('');
 
 const [formData, setFormData] = useState({
 name: '',
 description: '',
 price: '',
 category_id: 1,
 image_url: '',
 stock_quantity: 0,
 status: 'active'
 });

 const resetForm = () => {
 setFormData({
 name: '',
 description: '',
 price: '',
 category_id: 1,
 image_url: '',
 stock_quantity: 0,
 status: 'active'
 });
 setImagePreview('');
 setEditingProduct(null);
 };

 const handleOpenAddModal = () => {
 resetForm();
 setShowModal(true);
 };

 const handleOpenEditModal = (product) => {
 setEditingProduct(product);
 setFormData({
 name: product.name,
 description: product.description,
 price: product.price.toString(),
 category_id: product.category_id,
 image_url: product.image_url || '',
 stock_quantity: product.stock_quantity || 0,
 status: product.status || 'active'
 });
 setImagePreview(product.image_url || '');
 setShowModal(true);
 };

 const handleCloseModal = () => {
 setShowModal(false);
 resetForm();
 };

 const handleImageUpload = (e) => {
 const file = e.target.files?.[0];
 if (file) {
 const reader = new FileReader();
 reader.onloadend = () => {
 setImagePreview(reader.result);
 setFormData({ ...formData, image_url: reader.result });
 };
 reader.readAsDataURL(file);
 }
 };

 const validateForm = () => {
 if (!formData.name || !formData.description || !formData.price) {
 alert('Please fill in all required fields (Name, Description, Price)');
 return false;
 }
 if (parseFloat(formData.price) <= 0) {
 alert('Price must be greater than 0');
 return false;
 }
 return true;
 };

 const handleSave = () => {
 if (!validateForm()) return;

 const categoryData = categories.find(c => c.id === parseInt(formData.category_id));
 const productData = {
 ...formData,
 price: parseFloat(formData.price),
 stock_quantity: parseInt(formData.stock_quantity) || 0,
 category_id: parseInt(formData.category_id),
 category_name: categoryData?.name || 'Uncategorized'
 };

 if (editingProduct) {
 updateProduct(editingProduct.id, productData);
 setToastMessage('Product updated successfully!');
 } else {
 addProduct(productData);
 setToastMessage('Product added successfully!');
 }

 setShowSuccessToast(true);
 setTimeout(() => setShowSuccessToast(false), 3000);
 handleCloseModal();
 };

 const handleDelete = (productId) => {
 if (confirm('Are you sure you want to delete this product?')) {
 deleteProduct(productId);
 setToastMessage('Product deleted successfully!');
 setShowSuccessToast(true);
 setTimeout(() => setShowSuccessToast(false), 3000);
 }
 };

 const filteredProducts = products.filter(product =>
 product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
 product.description.toLowerCase().includes(searchQuery.toLowerCase())
 );

 return (
 <AdminLayout>
 <div className="max-w-7xl mx-auto">
 {/* Success Toast */}
 {showSuccessToast && (
 <div className="fixed top-4 right-4 z-50 bg-green-600 text-white px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 animate-slide-in">
 <AlertCircle className="w-6 h-6" />
 <p className="font-semibold">{toastMessage}</p>
 </div>
 )}

 {/* Header */}
 <div className="mb-8 flex items-center justify-between">
 <div>
 <h1 className="text-3xl font-bold text-gray-900 mb-2">Products</h1>
 <p className="text-gray-600">Manage your product inventory</p>
 </div>
 <button
 onClick={handleOpenAddModal}
 className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 shadow-lg"
 >
 <Plus className="w-5 h-5" />
 Add New Product
 </button>
 </div>

 {/* Search Bar */}
 <div className="mb-6 relative">
 <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
 <input
 type="text"
 placeholder="Search products..."
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-green-500"
 />
 </div>

 {/* Products Grid */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
 {filteredProducts.length === 0 ? (
 <div className="col-span-full text-center py-12 bg-white rounded-2xl border-2 border-dashed border-gray-200">
 <p className="text-gray-500">No products found</p>
 </div>
 ) : (
 filteredProducts.map((product) => (
 <div key={product.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
 <div className="relative h-48 bg-gray-100">
 {product.image_url ? (
 <img
 src={product.image_url}
 alt={product.name}
 className="w-full h-full object-cover"
 />
 ) : (
 <div className="w-full h-full flex items-center justify-center text-gray-400">
 <Upload className="w-12 h-12" />
 </div>
 )}
 <span className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-semibold ${
 product.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
 }`}>
 {product.status}
 </span>
 </div>
 
 <div className="p-4">
 <div className="mb-2">
 <h3 className="font-bold text-gray-900 text-lg">{product.name}</h3>
 <span className="text-xs text-gray-500">{product.category_name}</span>
 </div>
 
 <p className="text-sm text-gray-600 mb-3 line-clamp-2">{product.description}</p>
 
 <div className="flex items-center justify-between mb-4">
 <div>
 <p className="text-2xl font-bold text-green-600">{formatPrice(product.price, settings.currency)}</p>
 <p className="text-xs text-gray-500">Stock: {product.stock_quantity || 0}</p>
 </div>
 </div>
 
 <div className="flex gap-2">
 <button
 onClick={() => handleOpenEditModal(product)}
 className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg font-medium hover:bg-blue-100"
 >
 <Edit className="w-4 h-4" />
 Edit
 </button>
 <button
 onClick={() => handleDelete(product.id)}
 className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg font-medium hover:bg-red-100"
 >
 <Trash2 className="w-4 h-4" />
 Delete
 </button>
 </div>
 </div>
 </div>
 ))
 )}
 </div>

 {/* Product Modal */}
 {showModal && (
 <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
 <div className="bg-white rounded-2xl max-w-2xl w-full p-6 my-8 max-h-[90vh] overflow-y-auto">
 <div className="flex items-center justify-between mb-6 pb-4 border-b">
 <h2 className="text-xl font-bold text-gray-900">
 {editingProduct ? 'Edit Product' : 'Add New Product'}
 </h2>
 <button onClick={handleCloseModal} className="p-2 hover:bg-gray-100 rounded-lg">
 <X className="w-5 h-5" />
 </button>
 </div>
 
 <div className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-2">Product Name *</label>
 <input 
 type="text" 
 value={formData.name}
 onChange={(e) => setFormData({ ...formData, name: e.target.value })}
 className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-green-500" 
 placeholder="e.g., Organic Honey"
 />
 </div>
 
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
 <textarea 
 rows={3} 
 value={formData.description}
 onChange={(e) => setFormData({ ...formData, description: e.target.value })}
 className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-green-500" 
 placeholder="Product description..."
 />
 </div>
 
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-2">Price * (USD)</label>
 <input 
 type="number" 
 step="0.01"
 value={formData.price}
 onChange={(e) => setFormData({ ...formData, price: e.target.value })}
 className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-green-500" 
 placeholder="24.99"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-2">Stock Quantity</label>
 <input 
 type="number"
 value={formData.stock_quantity}
 onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
 className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-green-500" 
 placeholder="100"
 />
 </div>
 </div>
 
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
 <select 
 value={formData.category_id}
 onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
 className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-green-500"
 >
 {categories.map(cat => (
 <option key={cat.id} value={cat.id}>{cat.name}</option>
 ))}
 </select>
 </div>

 <div>
 <label className="block text-sm font-medium text-gray-700 mb-2">Product Image</label>
 <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center">
 {imagePreview ? (
 <div className="relative">
 <img src={imagePreview} alt="Preview" className="w-full h-48 object-cover rounded-lg mb-2" />
 <button
 type="button"
 onClick={() => {
 setImagePreview('');
 setFormData({ ...formData, image_url: '' });
 }}
 className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
 >
 <X className="w-4 h-4" />
 </button>
 </div>
 ) : (
 <div className="py-8">
 <Upload className="w-12 h-12 mx-auto text-gray-400 mb-2" />
 <p className="text-sm text-gray-500">Upload product image</p>
 </div>
 )}
 <input 
 type="file" 
 accept="image/*"
 onChange={handleImageUpload}
 className="hidden" 
 id="product-image"
 />
 <label 
 htmlFor="product-image" 
 className="mt-2 inline-block px-4 py-2 bg-gray-100 text-gray-700 rounded-lg cursor-pointer hover:bg-gray-200"
 >
 Choose File
 </label>
 </div>
 </div>
 </div>
 
 <div className="flex gap-3 mt-6 pt-6 border-t">
 <button 
 onClick={handleCloseModal}
 className="flex-1 px-6 py-3 border-2 border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50"
 >
 Cancel
 </button>
 <button 
 onClick={handleSave}
 className="flex-1 px-6 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 flex items-center justify-center gap-2"
 >
 <Save className="w-5 h-5" />
 {editingProduct ? 'Update Product' : 'Add Product'}
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 </AdminLayout>
 );
}
