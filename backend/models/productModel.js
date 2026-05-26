const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { dbPool, withTransaction } = require("../config/db");
const { createSlug } = require("../utils/slugify");
const { getAdminSettings } = require("../utils/adminSettings");
const { insertAdminNotifications } = require("../utils/adminNotifications");
const { fillMissingProductContent } = require("../utils/productContentDefaults");

const buildProductUrl = (productId) => {
  const frontendUrl = String(process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "");
  return `${frontendUrl}/product/${productId}`;
};

const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const buildLowStockEvent = ({
  previousStock,
  newStock,
  threshold,
  productId,
  productName,
}) => {
  if (previousStock >= threshold && newStock < threshold) {
    return {
      product_id: productId,
      product_name: productName,
      stock_quantity: newStock,
      threshold,
    };
  }

  return null;
};

const toNullableInt = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const toNullableText = (value) => {
  const text = String(value ?? "").trim();
  return text ? text : null;
};

const parseJson = (value, fallback = null) => {
  if (!value) {
    return fallback;
  }

  if (typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
};

const normalizeGalleryImages = (galleryImages) => {
  if (!Array.isArray(galleryImages)) {
    return [];
  }

  return galleryImages
    .map((entry, index) => {
      if (typeof entry === "string") {
        const imageUrl = entry.trim();
        if (!imageUrl) {
          return null;
        }

        return {
          image_url: imageUrl,
          alt_text: null,
          sort_order: index,
          is_primary: index === 0,
        };
      }

      const imageUrl = String(entry?.image_url || entry?.url || "").trim();
      if (!imageUrl) {
        return null;
      }

      return {
        image_url: imageUrl,
        alt_text: entry?.alt_text ? String(entry.alt_text).trim() : null,
        sort_order: Number.isInteger(Number(entry?.sort_order))
          ? Number(entry.sort_order)
          : index,
        is_primary: Boolean(entry?.is_primary) || index === 0,
      };
    })
    .filter(Boolean);
};

const getGalleryImageUrls = (galleryImages, imageUrl) => {
  if (galleryImages.length > 0) {
    return galleryImages.map((image) => image.image_url);
  }

  if (imageUrl) {
    return [String(imageUrl).trim()].filter(Boolean);
  }

  return [];
};

const generateUniqueSlug = async (connection, baseSlug, productId = null) => {
  const base = createSlug(baseSlug, "product");
  let candidate = base;
  let suffix = 1;

  while (true) {
    const query = productId
      ? "SELECT id FROM products WHERE slug = ? AND id <> ? LIMIT 1"
      : "SELECT id FROM products WHERE slug = ? LIMIT 1";
    const params = productId ? [candidate, productId] : [candidate];
    const [rows] = await connection.query(query, params);

    if (!rows.length) {
      return candidate;
    }

    candidate = `${base}-${suffix}`.slice(0, 120);
    suffix += 1;
  }
};

const replaceProductGallery = async (connection, productId, galleryImages) => {
  await connection.query("DELETE FROM product_images WHERE product_id = ?", [productId]);

  if (!galleryImages.length) {
    return;
  }

  const values = galleryImages.map((image) => [
    productId,
    image.image_url,
    image.alt_text,
    image.sort_order,
    image.is_primary,
  ]);

  await connection.query(
    `INSERT INTO product_images
     (product_id, image_url, alt_text, sort_order, is_primary)
     VALUES ?`,
    [values],
  );
};

const hydrateProducts = async (products) => {
  if (!products.length) {
    return products;
  }

  const productIds = products.map((product) => product.id);
  const placeholders = productIds.map(() => "?").join(", ");

  const [images] = await dbPool.query(
    `SELECT *
     FROM product_images
     WHERE product_id IN (${placeholders})
     ORDER BY product_id ASC, is_primary DESC, sort_order ASC, id ASC`,
    productIds,
  );

  const imageMap = new Map();
  for (const image of images) {
    const current = imageMap.get(image.product_id) || [];
    current.push(image);
    imageMap.set(image.product_id, current);
  }

  return products.map((product) => {
    const gallery = imageMap.get(product.id) || [];
    const jsonImages = parseJson(product.images, []);
    const primaryImage = gallery.find((entry) => entry.is_primary) || gallery[0] || null;

    return {
      ...product,
      image_url:
        product.image_url ||
        (primaryImage ? primaryImage.image_url : Array.isArray(jsonImages) ? jsonImages[0] : null),
      images:
        gallery.length > 0
          ? gallery
          : Array.isArray(jsonImages)
            ? jsonImages.map((url, index) => ({
                image_url: url,
                alt_text: null,
                sort_order: index,
                is_primary: index === 0,
              }))
            : [],
      final_price:
        safeNumber(product.price, 0) -
        (safeNumber(product.price, 0) * safeNumber(product.discount_percentage, 0)) / 100,
    };
  });
};

const listProducts = async (filters = {}) => {
  const {
    category,
    search,
    is_organic,
    is_featured,
    limit = 50,
    offset = 0,
    featuredAlias,
    includeInactive = false,
  } = filters;

  let query = `
    SELECT p.*, c.name AS category_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
  `;
  
  const conditions = [];
  const params = [];

  // Only filter by is_active if includeInactive is false
  if (!includeInactive) {
    conditions.push("p.is_active = TRUE");
  }

  if (category) {
    conditions.push("p.category_id = ?");
    params.push(category);
  }

  if (search) {
    conditions.push("(p.name LIKE ? OR p.slug LIKE ? OR p.description LIKE ? OR p.ingredients LIKE ? OR p.benefits LIKE ? OR p.`usage` LIKE ?)");
    params.push(
      `%${search}%`,
      `%${search}%`,
      `%${search}%`,
      `%${search}%`,
      `%${search}%`,
      `%${search}%`,
    );
  }

  if (String(is_organic) === "true") {
    conditions.push("p.is_organic = TRUE");
  }

  if (String(is_featured) === "true" || String(featuredAlias) === "true") {
    conditions.push("p.is_featured = TRUE");
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  query += " ORDER BY p.created_at DESC LIMIT ? OFFSET ?";
  params.push(safeNumber(limit, 50), safeNumber(offset, 0));

  const [rows] = await dbPool.query(query, params);
  return hydrateProducts(rows);
};

const listFeaturedProducts = async (maxRows = 10) => {
  const [rows] = await dbPool.query(
    `SELECT p.*, c.name AS category_name
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     WHERE p.is_featured = TRUE AND p.is_active = TRUE
     ORDER BY p.created_at DESC
     LIMIT ?`,
    [safeNumber(maxRows, 10)],
  );

  return hydrateProducts(rows);
};

const findById = async (productId) => {
  const [rows] = await dbPool.query(
    `SELECT p.*, c.name AS category_name
     FROM products p
     LEFT JOIN categories c ON p.category_id = c.id
     WHERE p.id = ?
     LIMIT 1`,
    [productId],
  );

  if (!rows.length) {
    return null;
  }

  const [product] = await hydrateProducts(rows);
  return product;
};

const createProduct = async (payload = {}) => {
  return withTransaction(async (connection) => {
    const name = String(payload.name || "").trim();
    const imageUrl = payload.image_url ? String(payload.image_url).trim() : null;
    const galleryImages = normalizeGalleryImages(payload.gallery_images);
    const slug = await generateUniqueSlug(
      connection,
      payload.slug || name,
    );
    const defaultContent = fillMissingProductContent({
      ...payload,
      name,
      slug,
    });

    const imagesJson = JSON.stringify(getGalleryImageUrls(galleryImages, imageUrl));

    const [result] = await connection.query(
      `INSERT INTO products
      (name, slug, description, ingredients, benefits, \`usage\`, price, category_id, image_url, images, stock_quantity, is_organic, is_featured, is_active, discount_percentage)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        slug,
        toNullableText(payload.description) || defaultContent.description,
        toNullableText(payload.ingredients) || defaultContent.ingredients,
        toNullableText(payload.benefits) || defaultContent.benefits,
        toNullableText(payload.usage) || defaultContent.usage,
        safeNumber(payload.price, 0),
        toNullableInt(payload.category_id),
        imageUrl,
        imagesJson,
        safeNumber(payload.stock_quantity, 0),
        Boolean(payload.is_organic),
        Boolean(payload.is_featured),
        payload.is_active === undefined ? true : Boolean(payload.is_active),
        safeNumber(payload.discount_percentage, 0),
      ],
    );

    const qrCodeUrl = buildProductUrl(result.insertId);
    await connection.query("UPDATE products SET qr_code_url = ? WHERE id = ?", [qrCodeUrl, result.insertId]);

    if (galleryImages.length > 0) {
      await replaceProductGallery(connection, result.insertId, galleryImages);
    } else if (imageUrl) {
      await replaceProductGallery(connection, result.insertId, [
        {
          image_url: imageUrl,
          alt_text: null,
          sort_order: 0,
          is_primary: true,
        },
      ]);
    }

    return result.insertId;
  });
};

const updateProduct = async (productId, payload = {}) => {
  return withTransaction(async (connection) => {
    const [existingRows] = await connection.query(
      "SELECT id, name, slug, stock_quantity FROM products WHERE id = ? LIMIT 1 FOR UPDATE",
      [productId],
    );

    if (!existingRows.length) {
      return false;
    }

    const existingProduct = existingRows[0];
    const hasOwn = (key) => Object.prototype.hasOwnProperty.call(payload, key);
    const resolvedName = hasOwn("name")
      ? String(payload.name || "").trim()
      : existingProduct.name;
    const resolvedSlug = hasOwn("slug")
      ? String(payload.slug || "").trim()
      : existingProduct.slug;
    const defaultContent = fillMissingProductContent({
      ...existingProduct,
      ...payload,
      name: resolvedName,
      slug: resolvedSlug,
    });
    const previousStock = safeNumber(existingProduct.stock_quantity, 0);
    let lowStockEvent = null;
    let shouldSendLowStockEmail = false;
    const fields = [];
    const params = [];

    if (hasOwn("name")) {
      const name = String(payload.name || "").trim();
      fields.push("name = ?");
      params.push(name);

      if (!hasOwn("slug")) {
        const nextSlug = await generateUniqueSlug(connection, name, productId);
        fields.push("slug = ?");
        params.push(nextSlug);
      }
    }

    if (hasOwn("slug")) {
      const nextSlug = await generateUniqueSlug(
        connection,
        payload.slug || existingProduct.name,
        productId,
      );
      fields.push("slug = ?");
      params.push(nextSlug);
    }

    const scalarFields = [
      ["description", "description = ?", (value) => toNullableText(value) || defaultContent.description],
      ["ingredients", "ingredients = ?", (value) => toNullableText(value) || defaultContent.ingredients],
      ["benefits", "benefits = ?", (value) => toNullableText(value) || defaultContent.benefits],
      ["usage", "`usage` = ?", (value) => toNullableText(value) || defaultContent.usage],
      ["price", "price = ?", (value) => safeNumber(value, 0)],
      ["category_id", "category_id = ?", toNullableInt],
      ["image_url", "image_url = ?", (value) => (value ? String(value).trim() : null)],
      ["stock_quantity", "stock_quantity = ?", (value) => safeNumber(value, 0)],
      ["is_organic", "is_organic = ?", (value) => Boolean(value)],
      ["is_featured", "is_featured = ?", (value) => Boolean(value)],
      ["is_active", "is_active = ?", (value) => Boolean(value)],
      ["discount_percentage", "discount_percentage = ?", (value) => safeNumber(value, 0)],
    ];

    for (const [key, clause, formatter] of scalarFields) {
      if (!hasOwn(key)) {
        continue;
      }

      fields.push(clause);
      params.push(formatter(payload[key]));
    }

    const shouldUpdateGallery = Array.isArray(payload.gallery_images);
    if (shouldUpdateGallery || hasOwn("image_url")) {
      const imageUrl = hasOwn("image_url")
        ? payload.image_url
          ? String(payload.image_url).trim()
          : null
        : null;
      const gallery = shouldUpdateGallery
        ? normalizeGalleryImages(payload.gallery_images)
        : [];
      const imagesJson = JSON.stringify(getGalleryImageUrls(gallery, imageUrl));
      fields.push("images = ?");
      params.push(imagesJson);
    }

    if (fields.length > 0) {
      params.push(productId);
      await connection.query(
        `UPDATE products SET ${fields.join(", ")} WHERE id = ?`,
        params,
      );
    }

    if (shouldUpdateGallery) {
      const gallery = normalizeGalleryImages(payload.gallery_images);
      await replaceProductGallery(connection, productId, gallery);
    }

    if (hasOwn("stock_quantity")) {
      const adminSettings = await getAdminSettings(connection);
      const lowStockThreshold = Number(adminSettings.lowStockThreshold) || 10;
      const nextStock = safeNumber(payload.stock_quantity, previousStock);

      if (adminSettings.lowStockAlerts) {
        lowStockEvent = buildLowStockEvent({
          previousStock,
          newStock: nextStock,
          threshold: lowStockThreshold,
          productId,
          productName: String(payload.name || existingProduct.name || "").trim(),
        });

        if (lowStockEvent) {
          await insertAdminNotifications(connection, {
            type: "admin_low_stock",
            title: "Low Stock Alert",
            message: `${lowStockEvent.product_name} is low on stock (${lowStockEvent.stock_quantity} left).`,
            payload: {
              product_id: lowStockEvent.product_id,
              stock_quantity: lowStockEvent.stock_quantity,
              threshold: lowStockEvent.threshold,
            },
          });
        }
      }

      shouldSendLowStockEmail =
        Boolean(adminSettings.emailNotifications) && Boolean(lowStockEvent);
    }

    const qrCodeUrl = buildProductUrl(productId);
    await connection.query("UPDATE products SET qr_code_url = ? WHERE id = ?", [qrCodeUrl, productId]);

    return {
      updated: true,
      lowStockEvent,
      shouldSendLowStockEmail,
    };
  });
};

const deleteById = async (productId) => {
  const [result] = await dbPool.query("DELETE FROM products WHERE id = ?", [productId]);
  return result.affectedRows > 0;
};

const updateStock = async (productId, stockQuantity, userId) => {
  return withTransaction(async (connection) => {
    const [rows] = await connection.query(
      "SELECT name, stock_quantity FROM products WHERE id = ? FOR UPDATE",
      [productId],
    );

    if (!rows.length) {
      return { updated: false };
    }

    const previousStock = safeNumber(rows[0].stock_quantity, 0);

    await connection.query("UPDATE products SET stock_quantity = ? WHERE id = ?", [
      stockQuantity,
      productId,
    ]);

    await connection.query(
      `INSERT INTO inventory_movements
       (product_id, movement_type, quantity_change, previous_stock, new_stock, note, created_by_user_id)
       VALUES (?, 'adjustment', ?, ?, ?, ?, ?)`,
      [
        productId,
        stockQuantity - previousStock,
        previousStock,
        stockQuantity,
        "Manual stock adjustment from admin panel",
        userId || null,
      ],
    );

    const adminSettings = await getAdminSettings(connection);
    const lowStockThreshold = Number(adminSettings.lowStockThreshold) || 10;
    let lowStockEvent = null;

    if (adminSettings.lowStockAlerts) {
      const productName = String(rows[0]?.name || "Product").trim();
      lowStockEvent = buildLowStockEvent({
        previousStock,
        newStock: stockQuantity,
        threshold: lowStockThreshold,
        productId,
        productName,
      });

      if (lowStockEvent) {
        await insertAdminNotifications(connection, {
          type: "admin_low_stock",
          title: "Low Stock Alert",
          message: `${productName} is low on stock (${lowStockEvent.stock_quantity} left).`,
          payload: {
            product_id: lowStockEvent.product_id,
            stock_quantity: lowStockEvent.stock_quantity,
            threshold: lowStockEvent.threshold,
          },
          excludeUserId: userId || null,
        });
      }
    }

    return {
      updated: true,
      lowStockEvent,
      shouldSendLowStockEmail:
        Boolean(adminSettings.emailNotifications) && Boolean(lowStockEvent),
    };
  });
};

module.exports = {
  listProducts,
  listFeaturedProducts,
  findById,
  createProduct,
  updateProduct,
  deleteById,
  updateStock,
};
