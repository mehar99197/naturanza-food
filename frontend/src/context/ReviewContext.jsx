import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const STORAGE_KEY = 'productReviews';

const INITIAL_REVIEWS = [
 {
 id: 1001,
 productId: '1',
 rating: 5,
 comment: 'Excellent quality, pure taste and great packaging.',
 date: '2026-03-01T10:20:00.000Z',
 userName: 'Ayesha Khan',
 userAvatar: '',
 },
 {
 id: 1002,
 productId: '1',
 rating: 4,
 comment: 'Very good product. Delivery was fast and fresh.',
 date: '2026-02-20T09:10:00.000Z',
 userName: 'Hassan Ali',
 userAvatar: '',
 },
 {
 id: 1003,
 productId: '2',
 rating: 5,
 comment: 'Highly recommended. This is now part of my routine.',
 date: '2026-02-15T08:00:00.000Z',
 userName: 'Sara Ahmed',
 userAvatar: '',
 },
 {
 id: 1004,
 productId: '3',
 rating: 5,
 comment: 'Amazing texture and clean ingredients.',
 date: '2026-02-10T12:40:00.000Z',
 userName: 'Bilal Raza',
 userAvatar: '',
 },
 {
 id: 1005,
 productId: '4',
 rating: 4,
 comment: 'Calming and flavorful, my family loved it.',
 date: '2026-02-06T18:35:00.000Z',
 userName: 'Nimra Tariq',
 userAvatar: '',
 },
 {
 id: 1006,
 productId: '5',
 rating: 5,
 comment: 'Great value and quality, will buy again.',
 date: '2026-02-01T14:15:00.000Z',
 userName: 'Usman Shah',
 userAvatar: '',
 },
];

const normalizeFromLegacyStore = (legacyObject) => {
 if (!legacyObject || typeof legacyObject !== 'object') return [];

 const flattened = [];
 Object.entries(legacyObject).forEach(([productId, items]) => {
 if (!Array.isArray(items)) return;
 items.forEach((item) => {
 flattened.push({
 id: item.id || Date.now() + Math.floor(Math.random() * 10000),
 productId: String(productId),
 rating: Number(item.rating || 0),
 comment: item.comment || '',
 date: item.date || item.createdAt || new Date().toISOString(),
 userName: item.userName || item.name || 'Guest User',
 userAvatar: item.userAvatar || item.avatar || item.profileImage || '',
 });
 });
 });

 return flattened;
};

const loadInitialReviews = () => {
 try {
 const stored = localStorage.getItem(STORAGE_KEY);
 if (stored) {
 const parsed = JSON.parse(stored);
 if (Array.isArray(parsed)) return parsed;
 }

 const legacy = localStorage.getItem('product_reviews');
 if (legacy) {
 const parsedLegacy = JSON.parse(legacy);
 const normalizedLegacy = normalizeFromLegacyStore(parsedLegacy);
 if (normalizedLegacy.length > 0) {
 localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedLegacy));
 return normalizedLegacy;
 }
 }
 } catch (error) {
 }

 return INITIAL_REVIEWS;
};

const calculateStatsForProduct = (reviews, productId) => {
 const targetId = String(productId);
 const productReviews = reviews.filter((review) => String(review.productId) === targetId);
 const reviewCount = productReviews.length;
 const averageRating = reviewCount
 ? Number(
 (
 productReviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviewCount
 ).toFixed(1),
 )
 : 0;

 return { reviewCount, averageRating };
};

const buildStatsMap = (reviews) => {
 const map = {};
 reviews.forEach((review) => {
 const targetId = String(review.productId);
 if (!map[targetId]) {
 map[targetId] = calculateStatsForProduct(reviews, targetId);
 }
 });
 return map;
};

const ReviewContext = createContext(null);

export const useReviews = () => {
 const context = useContext(ReviewContext);
 if (!context) {
 throw new Error('useReviews must be used within a ReviewProvider');
 }
 return context;
};

export const ReviewProvider = ({ children }) => {
 const [reviews, setReviews] = useState(() => loadInitialReviews());
 const [reviewStats, setReviewStats] = useState(() => buildStatsMap(loadInitialReviews()));

 const addReview = useCallback((productId, reviewData) => {
 const targetId = String(productId);

 setReviews((prev) => {
 const nextReview = {
 id: reviewData.id || Date.now(),
 productId: targetId,
 rating: Number(reviewData.rating || 0),
 comment: reviewData.comment || '',
 date: reviewData.date || new Date().toISOString(),
 userName: reviewData.userName || 'Guest User',
 userAvatar: reviewData.userAvatar || reviewData.avatar || reviewData.profileImage || '',
 };

 const updatedReviews = [nextReview, ...prev];

 const statsForProduct = calculateStatsForProduct(updatedReviews, targetId);
 setReviewStats((prevStats) => ({
 ...prevStats,
 [targetId]: statsForProduct,
 }));

 localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedReviews));
 return updatedReviews;
 });
 }, []);

 const getProductReviews = useCallback(
 (productId) => {
 const targetId = String(productId);
 return reviews
 .filter((review) => String(review.productId) === targetId)
 .sort((a, b) => new Date(b.date) - new Date(a.date));
 },
 [reviews],
 );

 const getProductReviewStats = useCallback(
 (productId) => {
 const targetId = String(productId);
 return reviewStats[targetId] || { reviewCount: 0, averageRating: 0 };
 },
 [reviewStats],
 );

 const value = useMemo(
 () => ({
 reviews,
 addReview,
 getProductReviews,
 getProductReviewStats,
 }),
 [reviews, addReview, getProductReviews, getProductReviewStats],
 );

 return <ReviewContext.Provider value={value}>{children}</ReviewContext.Provider>;
};
