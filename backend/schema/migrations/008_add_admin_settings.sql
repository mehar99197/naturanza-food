CREATE TABLE IF NOT EXISTS admin_settings (
    id INT PRIMARY KEY DEFAULT 1,
    store_name VARCHAR(120) NOT NULL,
    store_email VARCHAR(120) NOT NULL,
    store_phone VARCHAR(30) DEFAULT '',
    currency VARCHAR(10) DEFAULT 'PKR',
    tax_rate DECIMAL(5, 2) DEFAULT 18.00,
    shipping_flat DECIMAL(10, 2) DEFAULT 250.00,
    shipping_free DECIMAL(10, 2) DEFAULT 5000.00,
    email_notifications BOOLEAN DEFAULT TRUE,
    order_notifications BOOLEAN DEFAULT TRUE,
    low_stock_alerts BOOLEAN DEFAULT TRUE,
    low_stock_threshold INT DEFAULT 10,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
