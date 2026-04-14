import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
 LayoutDashboard, 
 Package, 
 ShoppingCart, 
 Users, 
 Settings, 
 Plus, 
 Edit, 
 Trash2, 
 Search,
 ArrowLeft,
 TrendingUp,
 DollarSign,
 UserPlus,
 Box,
 Upload,
 X,
 Save,
 Eye,
 ChevronDown,
 ChevronUp,
 Truck
} from 'lucide-react';
import { productAPI } from '@/services/api';
import { useOrders } from '@/context/OrderContext';
import { OrderTracker } from '@/components/OrderTracker';
import { useSettings } from '@/context/SettingsContext';
import { formatPrice } from '@/lib/utils';

export function Admin() {
 const { settings } = useSettings();
 const { orders, updateOrderStatus } = useOrders();
 const [activeTab, setActiveTab] = useState('dashboard');
 const [searchQuery, setSearchQuery] = useState('');
 const [showAddModal, setShowAddModal] = useState(false);
 const [showEditModal, setShowEditModal] = useState(false);
 const [products, setProducts] = useState([]);
 const [selectedProduct, setSelectedProduct] = useState(null);
 const [imagePreview, setImagePreview] = useState('');
 
 // Load products from API
 useEffect(() => {
 const loadProducts = async () => {
 try {
 const data = await productAPI.getAll();
 setProducts(data);
 } catch (error) {
 }
 };
 loadProducts();
 }, []);
 
 const [formData, setFormData] = useState({
 name: '',
 description: '',
 price: '',
 originalPrice: '',
 category: 'herbal-oils',
 image: '',
 rating: 5,
 reviews: 0,
 inStock: true,
 badge: '',
 ingredients: '',
 benefits: '',
 usage: ''
 });

 // Order management state
 const [selectedOrder, setSelectedOrder] = useState(null);
 const [expandedOrderId, setExpandedOrderId] = useState(null);
 const [orderFilter, setOrderFilter] = useState('all');
 const [orderSearchQuery, setOrderSearchQuery] = useState('');

 const filteredProducts = products.filter(p => 
 p.name.toLowerCase().includes(searchQuery.toLowerCase())
 );

 const handleImageUpload = (e) => {
 const file = e.target.files[0];
 if (file) {
 const reader = new FileReader();
 reader.onloadend = () => {
 setImagePreview(reader.result);
 setFormData({ ...formData, image: reader.result });
 };
 reader.readAsDataURL(file);
 }
 };

 const handleAddProduct = async () => {
 try {
 const newProduct = {
 name: formData.name,
 description: formData.description,
 price: parseFloat(formData.price),
 originalPrice: formData.originalPrice ? parseFloat(formData.originalPrice) : null,
 image: formData.image || '/images/products/powder.webp',
 category: formData.category,
 rating: parseFloat(formData.rating),
 reviewCount: parseInt(formData.reviews) || 0,
 stock: formData.inStock ? 100 : 0,
 isActive: true,
 badge: formData.badge || null,
 ingredients: formData.ingredients || null,
 benefits: formData.benefits || null,
 usage: formData.usage || null
 };
 
 const result = await productAPI.create(newProduct);
 
 if (result.success) {
 alert('Product added successfully!');
 const updatedProducts = await productAPI.getAll();
 setProducts(updatedProducts);
 resetForm();
 setShowAddModal(false);
 } else {
 throw new Error(result.message || 'Failed to add product');
 }
 } catch (error) {
 alert(`Failed to add product: ${error.message}`);
 }
 };

 const handleEditProduct = async () => {
 try {
 const updatedProduct = {
 name: formData.name,
 description: formData.description,
 price: parseFloat(formData.price),
 originalPrice: formData.originalPrice ? parseFloat(formData.originalPrice) : null,
 image: formData.image,
 category: formData.category,
 rating: parseFloat(formData.rating),
 reviewCount: parseInt(formData.reviews) || 0,
 stock: formData.inStock ? 100 : 0,
 isActive: true,
 badge: formData.badge || null,
 ingredients: formData.ingredients || null,
 benefits: formData.benefits || null,
 usage: formData.usage || null
 };
 
 const result = await productAPI.update(selectedProduct.id, updatedProduct);
 
 if (result.success) {
 alert('Product updated successfully!');
 const updatedProducts = await productAPI.getAll();
 setProducts(updatedProducts);
 resetForm();
 setShowEditModal(false);
 setSelectedProduct(null);
 } else {
 throw new Error(result.message || 'Failed to update product');
 }
 } catch (error) {
 alert(`Failed to update product: ${error.message}`);
 }
 };

 const handleDeleteProduct = async (productId) => {
 if (window.confirm('Are you sure you want to delete this product?')) {
 try {
 const result = await productAPI.delete(productId);
 
 if (result.success) {
 alert('Product deleted successfully!');
 const updatedProducts = await productAPI.getAll();
 setProducts(updatedProducts);
 } else {
 throw new Error(result.message || 'Failed to delete product');
 }
 } catch (error) {
 alert(`Failed to delete product: ${error.message}`);
 }
 }
 };

 // Order management functions
 const handleUpdateOrderStatus = async (orderId, newStatus) => {
 try {
 await updateOrderStatus(orderId, newStatus);
 } catch (error) {
 alert('Failed to update order status');
 }
 };

 const handleUpdateTrackingNumber = async (orderId, trackingNumber) => {
 // This would require an additional API endpoint
 // For now, just update the local state
 };

 const toggleOrderExpansion = (orderId) => {
 setExpandedOrderId(expandedOrderId === orderId ? null : orderId);
 };

 const filteredOrders = orders.filter(order => {
 const matchesSearch = 
 order.id.toLowerCase().includes(orderSearchQuery.toLowerCase()) ||
 (order.customerName && order.customerName.toLowerCase().includes(orderSearchQuery.toLowerCase())) ||
 (order.email && order.email.toLowerCase().includes(orderSearchQuery.toLowerCase()));
 
 const matchesFilter = orderFilter === 'all' || order.status === orderFilter;
 
 return matchesSearch && matchesFilter;
 });

 const getOrderStats = () => {
 return {
 total: orders.length,
 pending: orders.filter(o => o.status === 'pending').length,
 processing: orders.filter(o => o.status === 'processing').length,
 shipped: orders.filter(o => o.status === 'shipped').length,
 delivered: orders.filter(o => o.status === 'delivered').length
 };
 };

 const openEditModal = (product) => {
 setSelectedProduct(product);
 setFormData({
 name: product.name,
 description: product.description,
 price: product.price.toString(),
 originalPrice: product.originalPrice?.toString() || '',
 category: product.category,
 image: product.image_url || product.image,
 rating: product.rating,
 reviews: (product.reviewCount || product.reviews || 0).toString(),
 inStock: product.stock > 0 || product.inStock || false,
 badge: product.badge || '',
 ingredients: product.ingredients || '',
 benefits: product.benefits || '',
 usage: product.usage || ''
 });
 setImagePreview(product.image_url || product.image);
 setShowEditModal(true);
 };

 const resetForm = () => {
 setFormData({
 name: '',
 description: '',
 price: '',
 originalPrice: '',
 category: 'herbal-oils',
 image: '',
 rating: 5,
 reviews: 0,
 inStock: true,
 badge: '',
 ingredients: '',
 benefits: '',
 usage: ''
 });
 setImagePreview('');
 };

 const stats = [
 { label: 'Total Sales', value: '$24,580', change: '+18%', icon: DollarSign, color: 'bg-green-100 text-green-600' },
 { label: 'Total Orders', value: '312', change: '+12%', icon: ShoppingCart, color: 'bg-blue-100 text-blue-600' },
 { label: 'Products', value: products.length.toString(), change: '+0', icon: Box, color: 'bg-purple-100 text-purple-600' },
 { label: 'New Customers', value: '48', change: '+24%', icon: UserPlus, color: 'bg-orange-100 text-orange-600' }
 ];

 const recentOrders = [
 { id: '#ORD-001', customer: 'John Doe', total: 89.99, status: 'delivered', date: '2024-01-20' },
 { id: '#ORD-002', customer: 'Jane Smith', total: 124.50, status: 'processing', date: '2024-01-19' },
 { id: '#ORD-003', customer: 'Mike Johnson', total: 45.00, status: 'shipped', date: '2024-01-19' },
 { id: '#ORD-004', customer: 'Sarah Williams', total: 199.99, status: 'pending', date: '2024-01-18' },
 { id: '#ORD-005', customer: 'David Brown', total: 67.50, status: 'delivered', date: '2024-01-17' }
 ];

 const salesData = [
 { month: 'Jan', sales: 4200 },
 { month: 'Feb', sales: 5100 },
 { month: 'Mar', sales: 4800 },
 { month: 'Apr', sales: 6200 },
 { month: 'May', sales: 5800 },
 { month: 'Jun', sales: 7450 }
 ];

 const ProductModal = ({ isEdit = false, onClose, onSave }) => (
 <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
 <div className="bg-white rounded-2xl max-w-3xl w-full p-6 my-8 max-h-[90vh] overflow-y-auto">
 <div className="flex items-center justify-between mb-6 sticky top-0 bg-white pb-4 border-b z-10">
 <h2 className="text-xl font-bold text-gray-900">{isEdit ? 'Edit Product' : 'Add New Product'}</h2>
 <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
 <X className="w-5 h-5" />
 </button>
 </div>
 
 <div className="grid md:grid-cols-2 gap-6">
 {/* Left Column */}
 <div className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-2">Product Name *</label>
 <input 
 type="text" 
 value={formData.name}
 onChange={(e) => setFormData({ ...formData, name: e.target.value })}
 className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:border-green-500" 
 placeholder="e.g., Organic Honey"
 />
 </div>
 
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
 <textarea 
 rows={3} 
 value={formData.description}
 onChange={(e) => setFormData({ ...formData, description: e.target.value })}
 className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:border-green-500" 
 placeholder="Product description..."
 />
 </div>
 
 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-2">Price *</label>
 <input 
 type="number" 
 step="0.01"
 value={formData.price}
 onChange={(e) => setFormData({ ...formData, price: e.target.value })}
 className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:border-green-500" 
 placeholder="24.99"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-2">Original Price</label>
 <input 
 type="number" 
 step="0.01"
 value={formData.originalPrice}
 onChange={(e) => setFormData({ ...formData, originalPrice: e.target.value })}
 className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:border-green-500" 
 placeholder="29.99"
 />
 </div>
 </div>
 
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
 <select 
 value={formData.category}
 onChange={(e) => setFormData({ ...formData, category: e.target.value })}
 className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:border-green-500"
 >
 <option value="herbal-oils">Herbal Oils</option>
 <option value="organic-powders">Organic Powders</option>
 <option value="herbal-teas">Herbal Teas</option>
 <option value="supplements">Supplements</option>
 </select>
 </div>
 
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-2">Badge</label>
 <input 
 type="text" 
 value={formData.badge}
 onChange={(e) => setFormData({ ...formData, badge: e.target.value })}
 className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:border-green-500" 
 placeholder="e.g., Bestseller, New"
 />
 </div>
 
 <div className="flex items-center gap-4">
 <label className="flex items-center gap-2">
 <input 
 type="checkbox" 
 checked={formData.inStock}
 onChange={(e) => setFormData({ ...formData, inStock: e.target.checked })}
 className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500" 
 />
 <span className="text-sm font-medium text-gray-700">In Stock</span>
 </label>
 </div>
 </div>
 
 {/* Right Column */}
 <div className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-2">Product Image</label>
 <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-green-500">
 {imagePreview ? (
 <div className="relative">
 <img src={imagePreview} alt="Preview" className="w-full h-48 object-contain rounded-lg" />
 <button 
 onClick={() => {
 setImagePreview('');
 setFormData({ ...formData, image: '' });
 }}
 className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
 >
 <X className="w-4 h-4" />
 </button>
 </div>
 ) : (
 <div>
 <Upload className="w-12 h-12 mx-auto text-gray-400 mb-2" />
 <p className="text-sm text-gray-600 mb-2">Click to upload or drag and drop</p>
 </div>
 )}
 <input 
 type="file" 
 accept="image/*"
 onChange={handleImageUpload}
 className="hidden" 
 id="image-upload"
 />
 <label htmlFor="image-upload" className="cursor-pointer inline-block mt-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 text-sm font-medium">
 Choose File
 </label>
 </div>
 </div>
 
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-2">Ingredients (comma separated)</label>
 <textarea 
 rows={2}
 value={formData.ingredients}
 onChange={(e) => setFormData({ ...formData, ingredients: e.target.value })}
 className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:border-green-500" 
 placeholder="Honey, Pollen, Royal Jelly"
 />
 </div>
 
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-2">Benefits (comma separated)</label>
 <textarea 
 rows={2}
 value={formData.benefits}
 onChange={(e) => setFormData({ ...formData, benefits: e.target.value })}
 className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:border-green-500" 
 placeholder="Energy boost, Immunity support"
 />
 </div>
 
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-2">Usage Instructions</label>
 <textarea 
 rows={3}
 value={formData.usage}
 onChange={(e) => setFormData({ ...formData, usage: e.target.value })}
 className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:border-green-500" 
 placeholder="Take 1-2 tablespoons daily..."
 />
 </div>
 </div>
 </div>
 
 <div className="flex gap-4 mt-6 pt-6 border-t sticky bottom-0 bg-white">
 <button
 onClick={onClose}
 className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50"
 >
 Cancel
 </button>
 <button
 onClick={onSave}
 className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-medium hover:shadow-lg flex items-center justify-center gap-2"
 >
 <Save className="w-4 h-4" />
 {isEdit ? 'Update Product' : 'Add Product'}
 </button>
 </div>
 </div>
 </div>
 );

 return (
 <div className="min-h-screen bg-gray-50">
 {/* Sidebar */}
 <aside className="fixed left-0 top-0 h-full w-64 bg-gradient-to-b from-green-800 to-green-900 text-white z-50 hidden lg:block shadow-xl">
 <div className="p-6">
 <Link to="/" className="flex items-center gap-3">
 <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg">
 <span className="text-green-700 font-bold text-lg">N</span>
 </div>
 <div>
 <span className="font-bold text-lg block">Naturanza</span>
 <span className="text-xs text-green-200">Admin Panel</span>
 </div>
 </Link>
 </div>

 <nav className="px-4 py-4">
 {[
 { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
 { id: 'products', label: 'Products', icon: Package },
 { id: 'orders', label: 'Orders', icon: ShoppingCart },
 { id: 'customers', label: 'Customers', icon: Users },
 { id: 'analytics', label: 'Analytics', icon: TrendingUp }
 ].map((item) => (
 <button
 key={item.id}
 onClick={() => setActiveTab(item.id)}
 className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl mt-2 ${
 activeTab === item.id 
 ? 'bg-white text-green-700 shadow-lg font-medium' 
 : 'hover:bg-white/10'
 }`}
 >
 <item.icon className="w-5 h-5" />
 <span className="text-sm">{item.label}</span>
 </button>
 ))}
 <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl mt-2 hover:bg-white/10">
 <Settings className="w-5 h-5" />
 <span className="text-sm">Settings</span>
 </button>
 </nav>

 <div className="absolute bottom-0 left-0 right-0 p-4">
 <Link
 to="/"
 className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/10 border border-white/20"
 >
 <ArrowLeft className="w-5 h-5" />
 <span className="text-sm">Back to Site</span>
 </Link>
 </div>
 </aside>

 {/* Main Content */}
 <main className="lg:ml-64 min-h-screen">
 {/* Header */}
 <header className="bg-white shadow-sm px-6 py-4 flex items-center justify-between sticky top-0 z-40">
 <div>
 <h1 className="text-xl font-bold text-gray-900 capitalize">{activeTab}</h1>
 <p className="text-sm text-gray-500">Manage your store efficiently</p>
 </div>
 <div className="flex items-center gap-4">
 <div className="w-10 h-10 bg-gradient-to-br from-green-600 to-green-800 rounded-xl flex items-center justify-center text-white font-semibold shadow-lg">
 A
 </div>
 </div>
 </header>

 {/* Content */}
 <div className="p-6">
 {activeTab === 'dashboard' && (
 <div className="space-y-6">
 {/* Stats */}
 <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
 {stats.map((stat) => (
 <div key={stat.label} className="bg-white rounded-2xl p-6 shadow-md hover:shadow-xl border border-gray-100 hover:border-green-200">
 <div className={`w-12 h-12 ${stat.color} rounded-xl flex items-center justify-center mb-4`}>
 <stat.icon className="w-6 h-6" />
 </div>
 <p className="text-gray-600 text-sm">{stat.label}</p>
 <p className="text-2xl font-bold text-gray-900 mt-1">
 {stat.value}
 </p>
 <span className="text-green-600 text-sm font-medium">{stat.change} from last month</span>
 </div>
 ))}
 </div>

 {/* Charts & Recent Orders */}
 <div className="grid lg:grid-cols-2 gap-6">
 {/* Sales Chart */}
 <div className="bg-white rounded-2xl shadow-md p-6">
 <h2 className="font-bold text-lg mb-6">Sales Overview</h2>
 <div className="h-64 flex items-end gap-4">
 {salesData.map((data) => (
 <div key={data.month} className="flex-1 flex flex-col items-center gap-2">
 <div 
 className="w-full bg-gradient-to-t from-green-600 to-green-400 rounded-t-lg hover:opacity-80"
 style={{ height: `${(data.sales / 8000) * 100}%` }}
 />
 <span className="text-xs text-gray-600 font-medium">{data.month}</span>
 </div>
 ))}
 </div>
 </div>

 {/* Recent Orders */}
 <div className="bg-white rounded-2xl shadow-md overflow-hidden">
 <div className="p-6 border-b">
 <h2 className="font-bold text-lg">Recent Orders</h2>
 </div>
 <div className="overflow-x-auto">
 <table className="w-full">
 <thead className="bg-gray-50">
 <tr>
 <th className="px-6 py-3 text-left text-xs font-medium text-gray-600">Order ID</th>
 <th className="px-6 py-3 text-left text-xs font-medium text-gray-600">Customer</th>
 <th className="px-6 py-3 text-left text-xs font-medium text-gray-600">Total</th>
 <th className="px-6 py-3 text-left text-xs font-medium text-gray-600">Status</th>
 </tr>
 </thead>
 <tbody>
 {recentOrders.slice(0, 4).map((order) => (
 <tr key={order.id} className="border-b hover:bg-gray-50">
 <td className="px-6 py-4 font-medium text-sm">{order.id}</td>
 <td className="px-6 py-4 text-sm">{order.customer}</td>
 <td className="px-6 py-4 text-sm">{formatPrice(order.total, settings.currency)}</td>
 <td className="px-6 py-4">
 <span className={`px-2 py-1 rounded-full text-xs font-medium ${
 order.status === 'delivered' ? 'bg-green-100 text-green-700' :
 order.status === 'processing' ? 'bg-blue-100 text-blue-700' :
 order.status === 'shipped' ? 'bg-purple-100 text-purple-700' :
 'bg-yellow-100 text-yellow-700'
 }`}>
 {order.status}
 </span>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 </div>
 </div>
 )}

 {activeTab === 'products' && (
 <div className="space-y-6">
 {/* Toolbar */}
 <div className="flex flex-wrap items-center justify-between gap-4 bg-white rounded-2xl p-4 shadow-md">
 <div className="relative flex-1 max-w-md">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
 <input
 type="text"
 placeholder="Search products..."
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="pl-10 pr-4 py-2.5 border rounded-xl focus:outline-none focus:border-green-500 w-full"
 />
 </div>
 <button
 onClick={() => {
 resetForm();
 setShowAddModal(true);
 }}
 className="btn-3d flex items-center gap-2 bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-2.5 rounded-xl font-medium shadow-lg hover:shadow-xl"
 >
 <Plus className="w-4 h-4" />
 Add Product
 </button>
 </div>

 {/* Products Grid */}
 <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
 {filteredProducts.map((product) => (
 <div key={product.id} className="bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-2xl group border border-gray-100 hover:border-green-200">
 <div className="aspect-square bg-gray-100 flex items-center justify-center p-4 relative overflow-hidden">
 <img
 src={product.image_url || product.image}
 alt={product.name}
 className="w-full h-full object-contain group-"
 />
 {product.badge && (
 <span className="absolute top-2 left-2 bg-green-600 text-white px-2 py-1 rounded-lg text-xs font-medium">
 {product.badge}
 </span>
 )}
 </div>
 <div className="p-4">
 <h3 className="font-semibold text-sm text-gray-900 mb-1 truncate">{product.name}</h3>
 <p className="text-xs text-gray-500 capitalize mb-2">{product.category.replace('-', ' ')}</p>
 <div className="flex items-center justify-between mb-3">
 <span className="text-lg font-bold text-green-700">{formatPrice(product.price, settings.currency)}</span>
 <span className={`px-2 py-1 rounded-full text-xs font-medium ${
 (product.stock > 0 || product.inStock) ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
 }`}>
 {(product.stock > 0 || product.inStock) ? 'In Stock' : 'Out of Stock'}
 </span>
 </div>
 <div className="flex gap-2">
 <button 
 onClick={() => openEditModal(product)}
 className="flex-1 p-2 hover:bg-blue-50 rounded-lg text-blue-600 flex items-center justify-center gap-1 text-sm font-medium"
 >
 <Edit className="w-4 h-4" />
 Edit
 </button>
 <button 
 onClick={() => handleDeleteProduct(product.id)}
 className="flex-1 p-2 hover:bg-red-50 rounded-lg text-red-600 flex items-center justify-center gap-1 text-sm font-medium"
 >
 <Trash2 className="w-4 h-4" />
 Delete
 </button>
 </div>
 </div>
 </div>
 ))}
 </div>
 
 {filteredProducts.length === 0 && (
 <div className="bg-white rounded-2xl shadow-md p-12 text-center">
 <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
 <h3 className="text-lg font-semibold text-gray-900 mb-2">No products found</h3>
 <p className="text-gray-500">Try adjusting your search or add a new product</p>
 </div>
 )}
 </div>
 )}

 {activeTab === 'orders' && (
 <div className="space-y-6">
 {/* Order Stats */}
 <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
 {[
 { label: 'Total Orders', value: getOrderStats().total, color: 'bg-blue-100 text-blue-700' },
 { label: 'Pending', value: getOrderStats().pending, color: 'bg-yellow-100 text-yellow-700' },
 { label: 'Processing', value: getOrderStats().processing, color: 'bg-blue-100 text-blue-700' },
 { label: 'Shipped', value: getOrderStats().shipped, color: 'bg-purple-100 text-purple-700' },
 { label: 'Delivered', value: getOrderStats().delivered, color: 'bg-green-100 text-green-700' }
 ].map((stat, idx) => (
 <div key={idx} className="bg-white rounded-2xl shadow-md p-4">
 <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
 <p className={`text-2xl font-bold ${stat.color.split(' ')[1]}`}>{stat.value}</p>
 </div>
 ))}
 </div>

 {/* Orders Toolbar */}
 <div className="flex flex-wrap items-center gap-4 bg-white rounded-2xl p-4 shadow-md">
 <div className="relative flex-1 max-w-md">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
 <input
 type="text"
 placeholder="Search by Order ID, Customer, Email..."
 value={orderSearchQuery}
 onChange={(e) => setOrderSearchQuery(e.target.value)}
 className="pl-10 pr-4 py-2.5 border rounded-xl focus:outline-none focus:border-green-500 w-full"
 />
 </div>
 <select
 value={orderFilter}
 onChange={(e) => setOrderFilter(e.target.value)}
 className="px-4 py-2.5 border rounded-xl focus:outline-none focus:border-green-500"
 >
 <option value="all">All Statuses</option>
 <option value="pending">Pending</option>
 <option value="processing">Processing</option>
 <option value="shipped">Shipped</option>
 <option value="outForDelivery">Out for Delivery</option>
 <option value="delivered">Delivered</option>
 </select>
 </div>

 {/* Orders List */}
 <div className="bg-white rounded-2xl shadow-md overflow-hidden">
 {filteredOrders.length === 0 ? (
 <div className="p-12 text-center">
 <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
 <h3 className="text-lg font-semibold text-gray-900 mb-2">No orders found</h3>
 <p className="text-gray-500">
 {orders.length === 0 ? 'No orders have been placed yet.' : 'Try adjusting your search or filter.'}
 </p>
 </div>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full">
 <thead className="bg-gray-50 border-b">
 <tr>
 <th className="px-6 py-3 text-left text-xs font-medium text-gray-600">Order Details</th>
 <th className="px-6 py-3 text-left text-xs font-medium text-gray-600">Customer</th>
 <th className="px-6 py-3 text-left text-xs font-medium text-gray-600">Total</th>
 <th className="px-6 py-3 text-left text-xs font-medium text-gray-600">Status</th>
 <th className="px-6 py-3 text-left text-xs font-medium text-gray-600">Actions</th>
 </tr>
 </thead>
 <tbody className="divide-y">
 {filteredOrders.map((order) => (
 <>
 <tr key={order.id} className="hover:bg-gray-50">
 <td className="px-6 py-4">
 <div className="flex flex-col">
 <span className="font-medium text-sm">{order.id}</span>
 <span className="text-xs text-gray-600">{new Date(order.createdAt).toLocaleString()}</span>
 {order.paymentMethod && (
 <span className="text-xs text-gray-500 mt-1">
 Payment: {order.paymentMethod.toUpperCase()}
 </span>
 )}
 </div>
 </td>
 <td className="px-6 py-4">
 <div className="flex flex-col">
 <span className="text-sm font-medium">{order.customerName || 'N/A'}</span>
 <span className="text-xs text-gray-600">{order.email || 'N/A'}</span>
 <span className="text-xs text-gray-500">{order.phone || 'N/A'}</span>
 </div>
 </td>
 <td className="px-6 py-4">
 <span className="font-semibold text-sm">{formatPrice(order.total || 0, settings.currency)}</span>
 </td>
 <td className="px-6 py-4">
 <select
 value={order.status}
 onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
 className={`px-3 py-1.5 rounded-full text-xs font-medium border-2 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
 order.status === 'delivered' ? 'bg-green-50 text-green-700 border-green-200' :
 order.status === 'outForDelivery' ? 'bg-orange-50 text-orange-700 border-orange-200' :
 order.status === 'shipped' ? 'bg-purple-50 text-purple-700 border-purple-200' :
 order.status === 'processing' ? 'bg-blue-50 text-blue-700 border-blue-200' :
 'bg-yellow-50 text-yellow-700 border-yellow-200'
 }`}
 >
 <option value="pending">Pending</option>
 <option value="processing">Processing</option>
 <option value="shipped">Shipped</option>
 <option value="outForDelivery">Out for Delivery</option>
 <option value="delivered">Delivered</option>
 </select>
 </td>
 <td className="px-6 py-4">
 <button
 onClick={() => toggleOrderExpansion(order.id)}
 className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-50 rounded-lg"
 >
 <Eye className="w-4 h-4" />
 {expandedOrderId === order.id ? (
 <>
 Hide
 <ChevronUp className="w-4 h-4" />
 </>
 ) : (
 <>
 View
 <ChevronDown className="w-4 h-4" />
 </>
 )}
 </button>
 </td>
 </tr>
 {expandedOrderId === order.id && (
 <tr className="bg-gray-50">
 <td colSpan="5" className="px-6 py-6">
 <div className="grid lg:grid-cols-2 gap-6">
 {/* Left Column - Order Details */}
 <div className="space-y-4">
 <h3 className="font-bold text-lg mb-4">Order Details</h3>
 
 {/* Items */}
 <div className="bg-white rounded-xl p-4 shadow-sm">
 <h4 className="font-semibold mb-3">Items ({order.items?.length || 0})</h4>
 <div className="space-y-3">
 {order.items?.map((item, idx) => (
 <div key={idx} className="flex justify-between items-center">
 <div className="flex-1">
 <p className="font-medium text-sm">{item.name}</p>
 <p className="text-xs text-gray-600">Qty: {item.quantity}</p>
 </div>
 <span className="font-semibold text-sm">{formatPrice(item.price * item.quantity, settings.currency)}</span>
 </div>
 ))}
 </div>
 </div>

 {/* Shipping Address */}
 <div className="bg-white rounded-xl p-4 shadow-sm">
 <h4 className="font-semibold mb-2">Shipping Address</h4>
 <p className="text-sm text-gray-700">{order.address}</p>
 <p className="text-sm text-gray-700">{order.city}, {order.postalCode}</p>
 </div>

 {/* Tracking Number */}
 <div className="bg-white rounded-xl p-4 shadow-sm">
 <label className="block font-semibold mb-2">Tracking Number</label>
 <div className="flex gap-2">
 <Truck className="w-5 h-5 text-gray-400 mt-2" />
 <input
 type="text"
 value={order.trackingNumber || ''}
 onChange={(e) => handleUpdateTrackingNumber(order.id, e.target.value)}
 placeholder="Enter tracking number..."
 className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:border-green-500"
 />
 </div>
 </div>
 </div>

 {/* Right Column - Order Progress */}
 <div className="space-y-4">
 <h3 className="font-bold text-lg mb-4">Order Progress</h3>
 <div className="bg-white rounded-xl p-4 shadow-sm">
 <OrderTracker currentStatus={order.status} />
 </div>

 {/* Summary */}
 <div className="bg-white rounded-xl p-4 shadow-sm">
 <h4 className="font-semibold mb-3">Payment Summary</h4>
 <div className="space-y-2 text-sm">
 <div className="flex justify-between">
 <span className="text-gray-600">Subtotal:</span>
 <span className="font-medium">{formatPrice(order.total - (order.shippingCost || 0), settings.currency)}</span>
 </div>
 <div className="flex justify-between">
 <span className="text-gray-600">Shipping:</span>
 <span className="font-medium">{formatPrice(order.shippingCost || 0, settings.currency)}</span>
 </div>
 <div className="flex justify-between pt-2 border-t font-bold">
 <span>Total:</span>
 <span className="text-green-600">{formatPrice(order.total || 0, settings.currency)}</span>
 </div>
 </div>
 </div>
 </div>
 </div>
 </td>
 </tr>
 )}
 </>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </div>
 </div>
 )}

 {(activeTab === 'customers' || activeTab === 'analytics') && (
 <div className="bg-white rounded-2xl shadow-md p-12 text-center">
 <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
 <TrendingUp className="w-8 h-8 text-gray-400" />
 </div>
 <h2 className="text-xl font-bold text-gray-900 mb-2">
 Coming Soon
 </h2>
 <p className="text-gray-600">
 This feature is under development.
 </p>
 </div>
 )}
 </div>
 </main>

 {/* Modals */}
 {showAddModal && (
 <ProductModal 
 onClose={() => {
 setShowAddModal(false);
 resetForm();
 }} 
 onSave={handleAddProduct} 
 />
 )}
 
 {showEditModal && (
 <ProductModal 
 isEdit={true}
 onClose={() => {
 setShowEditModal(false);
 setSelectedProduct(null);
 resetForm();
 }} 
 onSave={handleEditProduct} 
 />
 )}
 </div>
 );
}
