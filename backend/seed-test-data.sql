-- Seed data for local development
-- Safe to run multiple times.
-- Ensure a default admin user exists (password: Admin@123)
INSERT INTO users (name, email, password, role)
SELECT 'Default Admin',
    'meharahmad6599197@gmail.com',
    '$2a$10$HxoyBFcWF.KZLB94pIqqwOnv4q89xEi29mGUEjnsL6vyiCGSYGL2G',
    'admin'
WHERE NOT EXISTS (
        SELECT 1
        FROM users
        WHERE email = 'meharahmad6599197@gmail.com'
    );
-- Default categories
INSERT INTO categories (name, slug, description, image_url)
SELECT 'Fruits',
    'fruits',
    'Fresh organic fruits',
    '/images/products/fruits.webp'
WHERE NOT EXISTS (
        SELECT 1
        FROM categories
        WHERE name = 'Fruits'
    );
INSERT INTO categories (name, slug, description, image_url)
SELECT 'Vegetables',
    'vegetables',
    'Farm-fresh vegetables',
    '/images/products/vegetables.webp'
WHERE NOT EXISTS (
        SELECT 1
        FROM categories
        WHERE name = 'Vegetables'
    );
INSERT INTO categories (name, slug, description, image_url)
SELECT 'Grains',
    'grains',
    'Organic grains and cereals',
    '/images/products/grains.webp'
WHERE NOT EXISTS (
        SELECT 1
        FROM categories
        WHERE name = 'Grains'
    );
INSERT INTO categories (name, slug, description, image_url)
SELECT 'Dairy',
    'dairy',
    'Natural dairy products',
    '/images/products/dairy.webp'
WHERE NOT EXISTS (
        SELECT 1
        FROM categories
        WHERE name = 'Dairy'
    );
-- Sample products
INSERT INTO products (
        name,
        slug,
        description,
        price,
        category_id,
        image_url,
        images,
        stock_quantity,
        is_organic,
        is_featured,
        is_active,
        discount_percentage
    )
SELECT 'Organic Honey',
    'organic-honey',
    'Pure natural honey from mountain farms',
    24.99,
    (
        SELECT id
        FROM categories
        WHERE name = 'Dairy'
        LIMIT 1
    ), '/images/products/honey.webp', JSON_ARRAY('/images/products/honey.webp'), 120, TRUE,
    TRUE,
    TRUE,
    10
WHERE NOT EXISTS (
        SELECT 1
        FROM products
        WHERE name = 'Organic Honey'
    );
INSERT INTO products (
        name,
        slug,
        description,
        price,
        category_id,
        image_url,
        images,
        stock_quantity,
        is_organic,
        is_featured,
        is_active,
        discount_percentage
    )
SELECT 'Green Tea',
    'green-tea',
    'Premium antioxidant-rich tea leaves',
    18.50,
    (
        SELECT id
        FROM categories
        WHERE name = 'Grains'
        LIMIT 1
    ), '/images/products/green-tea.webp', JSON_ARRAY('/images/products/green-tea.webp'), 85, TRUE,
    TRUE,
    TRUE,
    5
WHERE NOT EXISTS (
        SELECT 1
        FROM products
        WHERE name = 'Green Tea'
    );
INSERT INTO products (
        name,
        slug,
        description,
        price,
        category_id,
        image_url,
        images,
        stock_quantity,
        is_organic,
        is_featured,
        is_active,
        discount_percentage
    )
SELECT 'Turmeric Powder',
    'turmeric-powder',
    'Stone-ground turmeric powder, no additives',
    12.75,
    (
        SELECT id
        FROM categories
        WHERE name = 'Grains'
        LIMIT 1
    ), '/images/products/turmeric.webp', JSON_ARRAY('/images/products/turmeric.webp'), 140, TRUE,
    FALSE,
    TRUE,
    0
WHERE NOT EXISTS (
        SELECT 1
        FROM products
        WHERE name = 'Turmeric Powder'
    );
INSERT INTO products (
        name,
        slug,
        description,
        price,
        category_id,
        image_url,
        images,
        stock_quantity,
        is_organic,
        is_featured,
        is_active,
        discount_percentage
    )
SELECT 'Fresh Apples',
    'fresh-apples',
    'Crisp and sweet apples from local orchards',
    6.20,
    (
        SELECT id
        FROM categories
        WHERE name = 'Fruits'
        LIMIT 1
    ), '/images/products/apples.webp', JSON_ARRAY('/images/products/apples.webp'), 200, TRUE,
    FALSE,
    TRUE,
    0
WHERE NOT EXISTS (
        SELECT 1
        FROM products
        WHERE name = 'Fresh Apples'
    );