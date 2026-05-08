ALTER TABLE categories
    ADD COLUMN IF NOT EXISTS category_type ENUM('shop', 'shop_by_category', 'both') NOT NULL DEFAULT 'both' AFTER image_url;

UPDATE categories
SET category_type = 'both'
WHERE category_type IS NULL OR category_type = '';
