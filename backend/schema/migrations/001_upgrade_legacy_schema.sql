-- 001_upgrade_legacy_schema.sql
-- Purpose: upgrade legacy XAMPP-era schema/data after import into MySQL 8.
-- Usage:
--   mysql -u root -p naturanza_foods < backend/schema/migrations/001_upgrade_legacy_schema.sql

USE naturanza_foods;

SET NAMES utf8mb4;

ALTER DATABASE naturanza_foods
  CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_0900_ai_ci;

ALTER TABLE users CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE categories CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE products CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE cart CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE wishlist CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE user_wishlist CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE orders CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE order_items CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE contacts CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE reviews CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE coupons CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE product_variants CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE variant_attributes CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE user_addresses CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE order_status_history CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE shipments CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE payment_transactions CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE inventory_movements CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE product_images CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE returns_requests CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE refund_transactions CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE user_sessions CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE notifications CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE audit_logs CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE tax_rates CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE payment_methods CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

ALTER TABLE categories ADD COLUMN IF NOT EXISTS slug VARCHAR(160) NULL AFTER name;
UPDATE categories
SET slug = CONCAT(
  TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER(name), '[^a-z0-9]+', '-')),
  '-',
  id
)
WHERE slug IS NULL OR slug = '';
ALTER TABLE categories MODIFY COLUMN slug VARCHAR(160) NOT NULL;
CREATE UNIQUE INDEX unique_categories_slug ON categories(slug);

ALTER TABLE products ADD COLUMN IF NOT EXISTS slug VARCHAR(200) NULL AFTER name;
ALTER TABLE products ADD COLUMN IF NOT EXISTS images JSON NULL AFTER image_url;

UPDATE products
SET slug = CONCAT(
  TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER(name), '[^a-z0-9]+', '-')),
  '-',
  id
)
WHERE slug IS NULL OR slug = '';

UPDATE products
SET images = JSON_ARRAY(image_url)
WHERE images IS NULL AND image_url IS NOT NULL;

UPDATE products
SET images = JSON_ARRAY()
WHERE images IS NULL;

ALTER TABLE products MODIFY COLUMN slug VARCHAR(200) NOT NULL;
CREATE UNIQUE INDEX unique_products_slug ON products(slug);
CREATE INDEX idx_products_category_active ON products(category_id, is_active);
CREATE INDEX idx_products_featured_active ON products(is_featured, is_active);

-- Optional: normalize booleans if imported as tinyint/text.
UPDATE users SET is_active = IF(is_active IS NULL, 1, is_active);
UPDATE categories SET is_active = IF(is_active IS NULL, 1, is_active);
UPDATE products SET is_active = IF(is_active IS NULL, 1, is_active);
