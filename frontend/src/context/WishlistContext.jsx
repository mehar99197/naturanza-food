import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from 'react';
import { wishlistAPI } from '@/services/api';
import { reviewEvents, REVIEW_EVENTS } from '@/utils/reviewEvents';
import { useAuth } from './AuthContext';

const WishlistContext = createContext(undefined);

const normalizeProductId = (value) => String(value ?? '').trim();

const extractItemProductId = (item) =>
	normalizeProductId(item?.product_id ?? item?.id);

const emitWishlistUpdated = () => {
	window.dispatchEvent(new Event('wishlistUpdated'));
};

export function WishlistProvider({ children }) {
	const { isAuthenticated, loading: authLoading } = useAuth();
	const [items, setItems] = useState([]);
	const [showToast, setShowToast] = useState(false);
	const [toastMessage, setToastMessage] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(null);
	const [updatingIds, setUpdatingIds] = useState(() => new Set());
	const toastTimeoutRef = useRef(null);

	const showTransientToast = useCallback((message) => {
		setToastMessage(message);
		setShowToast(true);

		if (toastTimeoutRef.current) {
			clearTimeout(toastTimeoutRef.current);
		}

		toastTimeoutRef.current = setTimeout(() => {
			setShowToast(false);
		}, 3000);
	}, []);

	const fetchWishlist = useCallback(async ({ silent = false } = {}) => {
		if (!isAuthenticated) {
			setItems([]);
			return [];
		}

		try {
			if (!silent) {
				setLoading(true);
			}
			setError(null);
			const data = await wishlistAPI.get();
			const nextItems = Array.isArray(data?.items) ? data.items : [];
			setItems(nextItems);
			return nextItems;
		} catch (err) {
			const message = err.response?.data?.error || err.message || 'Failed to load wishlist';
			setError(message);
			setItems([]);
			return [];
		} finally {
			if (!silent) {
				setLoading(false);
			}
		}
	}, [isAuthenticated]);

	useEffect(() => {
		// Don't fetch while auth is loading
		if (authLoading) {
			return;
		}
		
		if (isAuthenticated) {
			void fetchWishlist();
			return;
		}

		setItems([]);
		setError(null);
		setUpdatingIds(new Set());
	}, [isAuthenticated, authLoading, fetchWishlist]);

	useEffect(() => {
		const handleWishlistUpdated = () => {
			if (!isAuthenticated) {
				return;
			}

			void fetchWishlist({ silent: true });
		};

		window.addEventListener('wishlistUpdated', handleWishlistUpdated);

		return () => {
			window.removeEventListener('wishlistUpdated', handleWishlistUpdated);
		};
	}, [fetchWishlist, isAuthenticated]);

	useEffect(() => {
		if (!isAuthenticated) {
			return undefined;
		}

		const refreshLiveWishlist = () => {
			if (document.visibilityState === 'visible') {
				void fetchWishlist({ silent: true });
			}
		};

		const intervalId = window.setInterval(refreshLiveWishlist, 15000);
		const handleWindowFocus = () => refreshLiveWishlist();
		const handleVisibilityChange = () => refreshLiveWishlist();
		const unsubscribeSubmitted = reviewEvents.on(REVIEW_EVENTS.REVIEW_SUBMITTED, refreshLiveWishlist);
		const unsubscribeUpdated = reviewEvents.on(REVIEW_EVENTS.REVIEW_UPDATED, refreshLiveWishlist);
		const unsubscribeDeleted = reviewEvents.on(REVIEW_EVENTS.REVIEW_DELETED, refreshLiveWishlist);

		window.addEventListener('focus', handleWindowFocus);
		document.addEventListener('visibilitychange', handleVisibilityChange);

		return () => {
			window.clearInterval(intervalId);
			window.removeEventListener('focus', handleWindowFocus);
			document.removeEventListener('visibilitychange', handleVisibilityChange);
			unsubscribeSubmitted();
			unsubscribeUpdated();
			unsubscribeDeleted();
		};
	}, [fetchWishlist, isAuthenticated]);

	useEffect(() => {
		return () => {
			if (toastTimeoutRef.current) {
				clearTimeout(toastTimeoutRef.current);
			}
		};
	}, []);

	const isInWishlist = useCallback(
		(productId) => {
			const normalizedProductId = normalizeProductId(productId);
			if (!normalizedProductId) {
				return false;
			}

			return items.some((item) => extractItemProductId(item) === normalizedProductId);
		},
		[items],
	);

	const isUpdating = useCallback(
		(productId) => updatingIds.has(normalizeProductId(productId)),
		[updatingIds],
	);

	const addToWishlist = useCallback(
		async (product) => {
			if (!isAuthenticated) {
				showTransientToast('Please login to add items to wishlist');
				return { success: false, requiresAuth: true };
			}

			const normalizedProductId = normalizeProductId(
				product?.id ?? product?.product_id,
			);

			if (!normalizedProductId) {
				showTransientToast('Unable to identify this product');
				return { success: false };
			}

			if (updatingIds.has(normalizedProductId) || isInWishlist(normalizedProductId)) {
				return { success: true };
			}

			const optimisticItem = {
				...product,
				id: product?.id ?? normalizedProductId,
				product_id: product?.product_id ?? product?.id ?? normalizedProductId,
			};

			setUpdatingIds((prev) => {
				const next = new Set(prev);
				next.add(normalizedProductId);
				return next;
			});

			setItems((prev) => [optimisticItem, ...prev]);

			try {
				setError(null);
				await wishlistAPI.add(normalizedProductId);
				showTransientToast(`${product?.name || 'Product'} added to wishlist`);
				emitWishlistUpdated();
				return { success: true };
			} catch (err) {
				const message = err.response?.data?.error || 'Failed to add to wishlist';
				setError(message);
				showTransientToast(message);
				setItems((prev) =>
					prev.filter((item) => extractItemProductId(item) !== normalizedProductId),
				);
				void fetchWishlist();
				return { success: false, message };
			} finally {
				setUpdatingIds((prev) => {
					const next = new Set(prev);
					next.delete(normalizedProductId);
					return next;
				});
			}
		},
		[fetchWishlist, isAuthenticated, isInWishlist, showTransientToast, updatingIds],
	);

	const removeFromWishlist = useCallback(
		async (productId) => {
			if (!isAuthenticated) {
				return { success: false, requiresAuth: true };
			}

			const normalizedProductId = normalizeProductId(productId);
			if (!normalizedProductId || updatingIds.has(normalizedProductId)) {
				return { success: false };
			}

			const product = items.find(
				(item) => extractItemProductId(item) === normalizedProductId,
			);

			setUpdatingIds((prev) => {
				const next = new Set(prev);
				next.add(normalizedProductId);
				return next;
			});

			setItems((prev) =>
				prev.filter((item) => extractItemProductId(item) !== normalizedProductId),
			);

			try {
				setError(null);
				await wishlistAPI.remove(normalizedProductId);
				showTransientToast(`${product?.name || 'Product'} removed from wishlist`);
				emitWishlistUpdated();
				return { success: true };
			} catch (err) {
				const message = err.response?.data?.error || 'Failed to remove from wishlist';
				setError(message);
				showTransientToast(message);
				void fetchWishlist();
				return { success: false, message };
			} finally {
				setUpdatingIds((prev) => {
					const next = new Set(prev);
					next.delete(normalizedProductId);
					return next;
				});
			}
		},
		[fetchWishlist, isAuthenticated, items, showTransientToast, updatingIds],
	);

	const toggleWishlist = useCallback(
		async (product) => {
			const normalizedProductId = normalizeProductId(
				product?.id ?? product?.product_id,
			);

			if (!normalizedProductId) {
				return { success: false };
			}

			if (isInWishlist(normalizedProductId)) {
				return removeFromWishlist(normalizedProductId);
			}

			return addToWishlist(product);
		},
		[addToWishlist, isInWishlist, removeFromWishlist],
	);

	const clearWishlist = useCallback(async () => {
		if (!isAuthenticated) {
			return { success: false, requiresAuth: true };
		}

		const previousItems = items;
		setItems([]);

		try {
			setError(null);
			await wishlistAPI.clear();
			showTransientToast('Wishlist cleared');
			emitWishlistUpdated();
			return { success: true };
		} catch (err) {
			const message = err.response?.data?.error || 'Failed to clear wishlist';
			setError(message);
			showTransientToast(message);
			setItems(previousItems);
			return { success: false, message };
		}
	}, [isAuthenticated, items, showTransientToast]);

	const value = {
		items,
		totalItems: items.length,
		isInWishlist,
		isUpdating,
		addToWishlist,
		removeFromWishlist,
		toggleWishlist,
		clearWishlist,
		refreshWishlist: fetchWishlist,
		showToast,
		toastMessage,
		loading,
		error,
	};

	return (
		<WishlistContext.Provider value={value}>
			{children}
		</WishlistContext.Provider>
	);
}

export function useWishlist() {
	const context = useContext(WishlistContext);
	if (context === undefined) {
		throw new Error('useWishlist must be used within a WishlistProvider');
	}
	return context;
}
