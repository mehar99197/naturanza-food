-- Migration 034: Reconcile orphaned reserved_stock, store settings, and About Us content
--
-- 1. Reconcile products.reserved_stock against active ('held') rows in stock_reservations
--    so orphaned holds (e.g. from out-of-band order deletion) return to available stock.
-- 2. Turn off store_discount_active when store_discount_percentage <= 0, and align legacy
--    admin_settings.tax_rate = 18.00 with checkout's tax = 0 calculation.
-- 3. Align about_content hero subtitle and active product count with the store's actual
--    history (3+ Years Experience) and 5 active organic products.
--
-- Re-runnable and idempotent across MySQL 8 and MariaDB.

UPDATE products p
LEFT JOIN (
  SELECT product_id, SUM(quantity) AS held_qty
    FROM stock_reservations
   WHERE state = 'held'
   GROUP BY product_id
) sr ON sr.product_id = p.id
SET p.reserved_stock = COALESCE(sr.held_qty, 0)
WHERE COALESCE(p.reserved_stock, 0) <> COALESCE(sr.held_qty, 0);

UPDATE admin_settings
SET store_discount_active = FALSE
WHERE store_discount_active = TRUE
  AND COALESCE(store_discount_percentage, 0) <= 0;

UPDATE admin_settings
SET tax_rate = 0.00
WHERE id = 1
  AND tax_rate = 18.00;

UPDATE about_content
SET content = JSON_SET(
  content,
  '$.hero.subtitle',
  'We are on a mission to bring the healing power of nature to every home across Pakistan, one pure organic product at a time.'
)
WHERE id = 1
  AND JSON_VALID(content)
  AND JSON_UNQUOTE(JSON_EXTRACT(content, '$.hero.subtitle')) LIKE '%Since 2010%';

UPDATE about_content
SET content = JSON_SET(
  content,
  REPLACE(
    JSON_UNQUOTE(JSON_SEARCH(content, 'one', 'Organic Products', NULL, '$.stats[*].label')),
    '.label',
    '.value'
  ),
  5
)
WHERE id = 1
  AND JSON_VALID(content)
  AND JSON_SEARCH(content, 'one', 'Organic Products', NULL, '$.stats[*].label') IS NOT NULL
  AND CAST(
    JSON_UNQUOTE(
      JSON_EXTRACT(
        content,
        REPLACE(
          JSON_UNQUOTE(JSON_SEARCH(content, 'one', 'Organic Products', NULL, '$.stats[*].label')),
          '.label',
          '.value'
        )
      )
    ) AS UNSIGNED
  ) < 5;
