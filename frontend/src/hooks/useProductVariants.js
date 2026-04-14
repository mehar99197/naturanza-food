import { useState, useEffect } from 'react';
import api from '@/services/api';

/**
 * Custom hook for managing product variants
 * @param {number} productId - Product ID
 * @returns {object} - Variants data and loading states
 */
export function useProductVariants(productId) {
  const [variants, setVariants] = useState([]);
  const [attributes, setAttributes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!productId) {
      setLoading(false);
      return;
    }

    const fetchVariantsData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch both variants and attributes in parallel
        const [variantsResponse, attributesResponse] = await Promise.all([
          api.get(`/variants/product/${productId}`).catch(() => ({ data: { data: [] } })),
          api.get(`/variants/attributes/${productId}`).catch(() => ({ data: { data: [] } }))
        ]);

        setVariants(variantsResponse.data.data || []);
        setAttributes(attributesResponse.data.data || []);
      } catch (err) {
        console.error('Error fetching variants:', err);
        setError(err.message || 'Failed to fetch variants');
        setVariants([]);
        setAttributes([]);
      } finally {
        setLoading(false);
      }
    };

    fetchVariantsData();
  }, [productId]);

  return {
    variants,
    attributes,
    loading,
    error,
    hasVariants: variants.length > 0,
    hasAttributes: attributes.length > 0
  };
}

export default useProductVariants;
