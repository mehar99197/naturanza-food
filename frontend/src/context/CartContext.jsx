import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { cartAPI } from '@/services/api';
import { useAuth } from './AuthContext';

const CartContext = createContext(undefined);

const resolveProductId = (product) => {
 if (!product || typeof product !== 'object') return null;
 return product.product_id ?? product.id ?? product.productId ?? null;
};

export function CartProvider({ children }) {
 const { isAuthenticated } = useAuth();
 const [items, setItems] = useState([]);
 const [isCartOpen, setIsCartOpen] = useState(false);
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState(null);

 const fetchCart = useCallback(async () => {
 if (!isAuthenticated) return;
 try {
 setLoading(true);
 setError(null);
 const data = await cartAPI.get();
 setItems(Array.isArray(data.items) ? data.items : []);
 } catch (err) {
 setError(err.message);
 setItems([]);
 } finally {
 setLoading(false);
 }
 }, [isAuthenticated]);

 // Fetch cart from API when authenticated
 useEffect(() => {
 if (isAuthenticated) {
 fetchCart();
 } else {
 setItems([]);
 }
 }, [isAuthenticated, fetchCart]);

 const addToCart = useCallback(async (product, quantity = 1) => {
 if (!isAuthenticated) {
 const message = 'Please login to add items to cart';
 setError(message);
 return { success: false, error: message };
 }

 const productId = resolveProductId(product);
 if (!productId) {
 const message = 'Invalid product. Please refresh and try again.';
 setError(message);
 return { success: false, error: message };
 }

 const safeQuantity = Math.max(1, Number(quantity) || 1);

 try {
 setError(null);
 await cartAPI.add(productId, safeQuantity);
 await fetchCart();
 return { success: true };
 } catch (err) {
 const message = err.response?.data?.error || 'Failed to add to cart';
 setError(message);
 return { success: false, error: message };
 }
 }, [isAuthenticated, fetchCart]);

 const removeFromCart = useCallback(async (productId) => {
 if (!isAuthenticated) return;

 try {
 setError(null);
 await cartAPI.remove(productId);
 await fetchCart();
 } catch (err) {
 setError(err.response?.data?.error || 'Failed to remove from cart');
 }
 }, [isAuthenticated, fetchCart]);

 const updateQuantity = useCallback(async (productId, quantity) => {
 if (!isAuthenticated) return;

 if (quantity <= 0) {
 await removeFromCart(productId);
 return;
 }

 try {
 setError(null);
 await cartAPI.update(productId, quantity);
 await fetchCart();
 } catch (err) {
 setError(err.response?.data?.error || 'Failed to update quantity');
 }
 }, [isAuthenticated, removeFromCart, fetchCart]);

 const clearCart = useCallback(async () => {
 if (!isAuthenticated) return;

 try {
 setError(null);
 await cartAPI.clear();
 setItems([]);
 } catch (err) {
 setError(err.response?.data?.error || 'Failed to clear cart');
 }
 }, [isAuthenticated]);

 const totalItems = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
 const totalPrice = items.reduce((sum, item) => {
 const unitPrice = Number(item.final_price ?? item.price ?? 0);
 const qty = Number(item.quantity) || 0;
 return sum + (unitPrice * qty);
 }, 0);

 return (
 <CartContext.Provider
 value={{
 items,
 addToCart,
 removeFromCart,
 updateQuantity,
 clearCart,
 totalItems,
 totalPrice,
 isCartOpen,
 setIsCartOpen,
 loading,
 error,
 fetchCart
 }}
 >
 {children}
 </CartContext.Provider>
 );
}

export function useCart() {
 const context = useContext(CartContext);
 if (context === undefined) {
 throw new Error('useCart must be used within a CartProvider');
 }
 return context;
}
