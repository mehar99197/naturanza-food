import type { ProductWithCategory } from "@/types/catalog";

import type { ProductActionsProduct } from "./useProductActions";

/**
 * Narrows a catalog row to the fields the buy panel actually needs before it
 * crosses the server/client boundary.
 *
 * Props passed into a Client Component are serialised into the RSC payload and
 * shipped with the document, so handing the panel the whole row would put the
 * full description, the ingredient text and the images array into the HTML a
 * second time. Six fields is what add-to-cart, wishlist and share read.
 */
export const toActionsProduct = (product: ProductWithCategory): ProductActionsProduct => ({
  id: product.id,
  name: product.name,
  description: product.description,
  price: product.price,
  discountPercentage: product.discountPercentage,
  imageUrl: product.imageUrl,
  isInStock: product.isInStock,
});
