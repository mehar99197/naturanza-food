import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { reviewAPI } from '@/services/api';

const ReviewContext = createContext(null);

export const useReviews = () => {
 const context = useContext(ReviewContext);
 if (!context) {
 throw new Error('useReviews must be used within a ReviewProvider');
 }
 return context;
};

const statsFromReviews = (reviews, productId) => {
 const targetId = String(productId);
 const productReviews = reviews.filter((r) => String(r.productId) === targetId);
 const reviewCount = productReviews.length;
 const averageRating = reviewCount
 ? Number((productReviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / reviewCount).toFixed(1))
 : 0;
 return { reviewCount, averageRating };
};

const buildStatsMap = (reviews) => {
 const map = {};
 for (const r of reviews) {
 const id = String(r.productId);
 if (!map[id]) map[id] = statsFromReviews(reviews, id);
 }
 return map;
};

export const ReviewProvider = ({ children }) => {
 const [reviews, setReviews] = useState([]);
 const [reviewStats, setReviewStats] = useState({});
 const fetchedRef = useRef({});

 const ensureFetched = useCallback(async (productId) => {
 const pid = String(productId);
 if (fetchedRef.current[pid]) return;
 fetchedRef.current[pid] = true;

 try {
 const data = await reviewAPI.getProductReviews(productId);
 const normalized = (data || []).map((r) => ({
 id: r.id,
 productId: pid,
 rating: Number(r.rating || 0),
 comment: r.comment || '',
 date: r.created_at,
 userName: r.customer_name || 'Guest User',
 userAvatar: r.customer_image || '',
 }));
 setReviews((prev) => {
 const existing = new Set(prev.map((r) => r.id));
 const merged = [...prev, ...normalized.filter((r) => !existing.has(r.id))];
 setReviewStats(buildStatsMap(merged));
 return merged;
 });
 } catch {
 fetchedRef.current[pid] = false;
 }
 }, []);

 const addReview = useCallback((productId, reviewData) => {
 const targetId = String(productId);
 const nextReview = {
 id: reviewData.id || Date.now(),
 productId: targetId,
 rating: Number(reviewData.rating || 0),
 comment: reviewData.comment || '',
 date: reviewData.date || new Date().toISOString(),
 userName: reviewData.userName || 'Guest User',
 userAvatar: reviewData.userAvatar || '',
 };
 setReviews((prev) => {
 const updated = [nextReview, ...prev];
 setReviewStats(buildStatsMap(updated));
 return updated;
 });
 }, []);

 const getProductReviews = useCallback(
 (productId) => {
 const pid = String(productId);
 ensureFetched(productId);
 return reviews
 .filter((r) => String(r.productId) === pid)
 .sort((a, b) => new Date(b.date) - new Date(a.date));
 },
 [reviews, ensureFetched],
 );

 const getProductReviewStats = useCallback(
 (productId) => {
 ensureFetched(productId);
 return reviewStats[String(productId)] || { reviewCount: 0, averageRating: 0 };
 },
 [reviewStats, ensureFetched],
 );

 useEffect(() => {
 return () => { fetchedRef.current = {}; };
 }, []);

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
