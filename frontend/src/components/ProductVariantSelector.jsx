import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, Package, AlertCircle } from 'lucide-react';
import { buttonTap } from '@/lib/animations';

/**
 * Product Variant Selector Component
 * Allows users to select product attributes (size, color, weight, etc.)
 * and displays the matching variant with stock and price info
 */
export function ProductVariantSelector({ 
  product, 
  variants = [], 
  attributes = [],
  onVariantChange 
}) {
  const [selectedAttributes, setSelectedAttributes] = useState({});
  const [selectedVariant, setSelectedVariant] = useState(null);

  useEffect(() => {
    // Find matching variant based on selected attributes
    if (Object.keys(selectedAttributes).length === attributes.length && variants.length > 0) {
      const matchingVariant = variants.find(variant => {
        const variantAttrs = variant.attributes || {};
        return Object.entries(selectedAttributes).every(
          ([key, value]) => variantAttrs[key] === value
        );
      });
      
      setSelectedVariant(matchingVariant || null);
      if (onVariantChange) {
        onVariantChange(matchingVariant);
      }
    } else {
      setSelectedVariant(null);
      if (onVariantChange) {
        onVariantChange(null);
      }
    }
  }, [selectedAttributes, variants, attributes.length, onVariantChange]);

  const handleAttributeSelect = (attributeName, value) => {
    setSelectedAttributes(prev => ({
      ...prev,
      [attributeName]: value
    }));
  };

  if (!attributes || attributes.length === 0) {
    return null;
  }

  return (
    <div className="space-y-5">
      {/* Attribute Selectors */}
      {attributes.map((attribute) => (
        <div key={attribute.id} className="space-y-3">
          <label className="block text-sm font-semibold text-gray-900">
            {attribute.attribute_name}
            {selectedAttributes[attribute.attribute_name] && (
              <span className="ml-2 text-green-600 font-normal">
                - {selectedAttributes[attribute.attribute_name]}
              </span>
            )}
          </label>
          
          <div className="flex flex-wrap gap-2">
            {(attribute.attribute_values || []).map((value) => {
              const isSelected = selectedAttributes[attribute.attribute_name] === value;
              
              return (
                <motion.button
                  key={value}
                  type="button"
                  {...buttonTap}
                  onClick={() => handleAttributeSelect(attribute.attribute_name, value)}
                  className={`
                    px-4 py-2.5 rounded-lg border-2 font-medium text-sm
                    transition-all duration-200
                    ${isSelected 
                      ? 'border-green-600 bg-green-50 text-green-700 shadow-sm' 
                      : 'border-gray-300 bg-white text-gray-700 hover:border-green-400 hover:bg-green-50'
                    }
                  `}
                >
                  {isSelected && <Check className="w-4 h-4 inline mr-1.5" />}
                  {value}
                </motion.button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Selected Variant Info */}
      {Object.keys(selectedAttributes).length === attributes.length && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`
            p-4 rounded-xl border-2 
            ${selectedVariant 
              ? 'bg-green-50 border-green-200' 
              : 'bg-amber-50 border-amber-200'
            }
          `}
        >
          {selectedVariant ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-green-600" />
                <h4 className="font-semibold text-green-900">
                  {selectedVariant.variant_name}
                </h4>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-600">SKU:</span>
                  <span className="ml-2 font-mono text-gray-900">
                    {selectedVariant.sku}
                  </span>
                </div>
                
                <div>
                  <span className="text-gray-600">Stock:</span>
                  <span className={`ml-2 font-semibold ${
                    selectedVariant.stock_quantity > 10 
                      ? 'text-green-600' 
                      : selectedVariant.stock_quantity > 0
                      ? 'text-amber-600'
                      : 'text-red-600'
                  }`}>
                    {selectedVariant.stock_quantity > 0 
                      ? `${selectedVariant.stock_quantity} available`
                      : 'Out of stock'
                    }
                  </span>
                </div>
              </div>

              {selectedVariant.price && selectedVariant.price !== product.price && (
                <div className="pt-2 border-t border-green-200">
                  <span className="text-sm text-gray-600">Variant Price:</span>
                  <span className="ml-2 text-lg font-bold text-green-700">
                    Rs. {selectedVariant.price.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-900">
                  Variant Not Available
                </p>
                <p className="text-sm text-amber-700 mt-1">
                  This combination is currently out of stock. Please try different options.
                </p>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

export default ProductVariantSelector;
