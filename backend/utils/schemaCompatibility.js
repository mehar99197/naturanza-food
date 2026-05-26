const { backfillKnownProductContent } = require("./productContentDefaults");

const ensureTableStatements = [
  `CREATE TABLE IF NOT EXISTS user_addresses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    label VARCHAR(50) DEFAULT 'Home',
    recipient_name VARCHAR(120) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    line1 VARCHAR(255) NOT NULL,
    line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'Pakistan',
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_addresses_user_default (user_id, is_default)
  )`,
  `CREATE TABLE IF NOT EXISTS order_status_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    from_status VARCHAR(50),
    to_status VARCHAR(50) NOT NULL,
    changed_by_user_id INT,
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_order_status_history_order (order_id, created_at)
  )`,
  `CREATE TABLE IF NOT EXISTS shipments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    courier_name VARCHAR(120),
    tracking_number VARCHAR(120),
    shipment_status ENUM('pending', 'packed', 'shipped', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned') DEFAULT 'pending',
    shipped_at DATETIME,
    estimated_delivery DATETIME,
    delivered_at DATETIME,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_order_shipment (order_id),
    UNIQUE KEY unique_tracking_number (tracking_number),
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    INDEX idx_shipments_status (shipment_status)
  )`,
  `CREATE TABLE IF NOT EXISTS payment_transactions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT,
    user_id INT,
    transaction_type ENUM('payment', 'refund') DEFAULT 'payment',
    provider VARCHAR(50) DEFAULT 'cod',
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'PKR',
    status ENUM('pending', 'paid', 'failed', 'refunded', 'cancelled') DEFAULT 'pending',
    gateway_reference VARCHAR(120),
    external_id VARCHAR(120),
    payload JSON,
    processed_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_payment_transactions_order (order_id, created_at),
    INDEX idx_payment_transactions_user (user_id, created_at),
    INDEX idx_payment_transactions_status (status)
  )`,
  `CREATE TABLE IF NOT EXISTS inventory_movements (
    id INT PRIMARY KEY AUTO_INCREMENT,
    product_id INT NOT NULL,
    order_id INT,
    movement_type ENUM('sale', 'restock', 'adjustment', 'return', 'cancel_restore') NOT NULL,
    quantity_change INT NOT NULL,
    previous_stock INT,
    new_stock INT,
    reference_type VARCHAR(50),
    reference_id INT,
    note TEXT,
    created_by_user_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_inventory_movements_product (product_id, created_at),
    INDEX idx_inventory_movements_order (order_id)
  )`,
  `CREATE TABLE IF NOT EXISTS stock_reservations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    state ENUM('held','consumed','released') NOT NULL DEFAULT 'held',
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    INDEX idx_resv_state_expires (state, expires_at),
    INDEX idx_resv_order (order_id)
  )`,
  `CREATE TABLE IF NOT EXISTS product_images (
    id INT PRIMARY KEY AUTO_INCREMENT,
    product_id INT NOT NULL,
    image_url VARCHAR(255) NOT NULL,
    alt_text VARCHAR(255),
    sort_order INT DEFAULT 0,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    INDEX idx_product_images_product (product_id, sort_order)
  )`,
  `CREATE TABLE IF NOT EXISTS returns_requests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    user_id INT NOT NULL,
    reason VARCHAR(255) NOT NULL,
    details TEXT,
    requested_amount DECIMAL(10, 2),
    status ENUM('requested', 'approved', 'rejected', 'received', 'refunded') DEFAULT 'requested',
    reviewed_by_user_id INT,
    reviewed_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_returns_requests_order (order_id),
    INDEX idx_returns_requests_user_status (user_id, status)
  )`,
  `CREATE TABLE IF NOT EXISTS refund_transactions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    return_request_id INT NOT NULL,
    order_id INT NOT NULL,
    user_id INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    method VARCHAR(50) DEFAULT 'manual',
    status ENUM('pending', 'processed', 'failed') DEFAULT 'pending',
    reference_number VARCHAR(120),
    notes TEXT,
    processed_by_user_id INT,
    processed_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (return_request_id) REFERENCES returns_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (processed_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_refunds_order (order_id, created_at),
    INDEX idx_refunds_return (return_request_id)
  )`,
  `CREATE TABLE IF NOT EXISTS user_sessions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    token_hash CHAR(64) NOT NULL,
    login_provider VARCHAR(50) DEFAULT 'password',
    ip_address VARCHAR(64),
    user_agent VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    last_seen_at DATETIME,
    revoked_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_session_token (token_hash),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_sessions_user_active (user_id, is_active),
    INDEX idx_user_sessions_last_seen (last_seen_at)
  )`,
  `CREATE TABLE IF NOT EXISTS refresh_tokens (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    session_id INT NOT NULL,
    jti CHAR(36) NOT NULL,
    token_hash CHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    revoked_at DATETIME,
    revoked_reason VARCHAR(120),
    replaced_by_jti CHAR(36),
    created_by_ip VARCHAR(64),
    user_agent VARCHAR(255),
    last_used_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_refresh_token_jti (jti),
    UNIQUE KEY unique_refresh_token_hash (token_hash),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES user_sessions(id) ON DELETE CASCADE,
    INDEX idx_refresh_tokens_user_active (user_id, revoked_at, expires_at),
    INDEX idx_refresh_tokens_session (session_id, revoked_at)
  )`,
  `CREATE TABLE IF NOT EXISTS token_blacklist (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    jti CHAR(36) NOT NULL,
    token_hash CHAR(64),
    user_id INT,
    expires_at DATETIME NOT NULL,
    reason VARCHAR(120) DEFAULT 'revoked',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_blacklisted_jti (jti),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_token_blacklist_expires (expires_at)
  )`,
  `CREATE TABLE IF NOT EXISTS user_login_history (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    attempted_email VARCHAR(120),
    login_provider VARCHAR(50) DEFAULT 'password',
    ip_address VARCHAR(64),
    user_agent VARCHAR(255),
    device_name VARCHAR(120),
    location_label VARCHAR(180),
    status ENUM('success', 'failed') NOT NULL DEFAULT 'failed',
    failure_reason VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_login_history_user_created (user_id, created_at),
    INDEX idx_user_login_history_email_created (attempted_email, created_at)
  )`,
  `CREATE TABLE IF NOT EXISTS notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    type VARCHAR(64) NOT NULL,
    title VARCHAR(140) NOT NULL,
    message TEXT NOT NULL,
    payload JSON,
    is_read BOOLEAN DEFAULT FALSE,
    read_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_notifications_user_read (user_id, is_read, created_at)
  )`,
  `CREATE TABLE IF NOT EXISTS user_notification_settings (
    user_id INT PRIMARY KEY,
    is_muted BOOLEAN DEFAULT FALSE,
    muted_until DATETIME,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_notification_settings_muted (is_muted, muted_until)
  )`,
  `CREATE TABLE IF NOT EXISTS admin_settings (
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
  )`,
  `CREATE TABLE IF NOT EXISTS announcements (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('info', 'success', 'warning', 'danger', 'promotion') DEFAULT 'info',
    is_active BOOLEAN DEFAULT TRUE,
    start_date DATETIME DEFAULT NULL,
    end_date DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS user_wishlist (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    product_id INT NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_wishlist_product (user_id, product_id),
    INDEX idx_user_wishlist_user_time (user_id, added_at)
  )`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    actor_user_id INT,
    action VARCHAR(120) NOT NULL,
    entity_type VARCHAR(80),
    entity_id VARCHAR(80),
    metadata JSON,
    ip_address VARCHAR(64),
    user_agent VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_audit_logs_action_time (action, created_at),
    INDEX idx_audit_logs_actor (actor_user_id, created_at)
  )`,
  `CREATE TABLE IF NOT EXISTS tax_rates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(120) NOT NULL,
    rate_percent DECIMAL(5, 2) NOT NULL,
    country VARCHAR(100) DEFAULT 'Pakistan',
    state VARCHAR(100),
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tax_rates_active_default (is_active, is_default)
  )`,
  `CREATE TABLE IF NOT EXISTS payment_methods (
    id INT PRIMARY KEY AUTO_INCREMENT,
    code VARCHAR(50) NOT NULL,
    label VARCHAR(120) NOT NULL,
    description TEXT,
    sort_order INT DEFAULT 0,
    supports_online BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_payment_method_code (code),
    INDEX idx_payment_methods_active_sort (is_active, sort_order)
  )`,
  `CREATE TABLE IF NOT EXISTS payment_accounts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    type ENUM('jazzcash', 'easypaisa', 'bank') NOT NULL,
    account_number VARCHAR(50) NOT NULL,
    account_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS advance_payment_verifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id VARCHAR(20) NOT NULL,
    customer_name VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(20),
    amount INT NOT NULL,
    payment_method ENUM('jazzcash','easypaisa','bank') NOT NULL,
    transaction_id VARCHAR(50) NULL,
    screenshot_url VARCHAR(255),
    status ENUM('pending','approved','rejected') DEFAULT 'pending',
    rejection_reason VARCHAR(255),
    verified_by INT,
    verified_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_apv_transaction_id (transaction_id)
  )`,
  `CREATE TABLE IF NOT EXISTS team_members (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(255) NOT NULL,
    image VARCHAR(500) DEFAULT NULL,
    bio TEXT DEFAULT NULL,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`,
];

const defaultPaymentMethods = [
  {
    code: "cod",
    label: "Cash on Delivery",
    description: "Cash collection at delivery",
    sort_order: 1,
    supports_online: false,
  },
  {
    code: "card",
    label: "Card Payment",
    description: "Credit and debit cards",
    sort_order: 2,
    supports_online: true,
  },
  {
    code: "online",
    label: "Online Transfer",
    description: "Bank transfer and online gateways",
    sort_order: 3,
    supports_online: true,
  },
  {
    code: "easypaisa",
    label: "EasyPaisa",
    description: "EasyPaisa wallet payments",
    sort_order: 4,
    supports_online: true,
  },
  {
    code: "jazzcash",
    label: "JazzCash",
    description: "JazzCash wallet payments",
    sort_order: 5,
    supports_online: true,
  },
];

const defaultPaymentAccounts = [
  {
    type: "jazzcash",
    account_number: "03XX-XXXXXXX",
    account_name: "Naturanza Food",
  },
  {
    type: "easypaisa",
    account_number: "03XX-XXXXXXX",
    account_name: "Naturanza Food",
  },
  {
    type: "bank",
    account_number: "PK00XXXX0000000000000000",
    account_name: "Naturanza Food",
  },
];

const ordersColumnDefinitions = {
  address_id: "INT NULL",
  customer_name: "VARCHAR(120) NULL",
  customer_email: "VARCHAR(120) NULL",
  subtotal: "DECIMAL(10, 2) DEFAULT 0",
  discount_amount: "DECIMAL(10, 2) DEFAULT 0",
  tax: "DECIMAL(10, 2) DEFAULT 0",
  shipping_cost: "DECIMAL(10, 2) DEFAULT 0",
  coupon_code: "VARCHAR(50) NULL",
  payment_details: "JSON NULL",
  city: "VARCHAR(100) NULL",
  postal_code: "VARCHAR(20) NULL",
  estimated_delivery: "DATETIME NULL",
};

const ensureOrdersIndexSql =
  "CREATE INDEX idx_orders_user_status_created ON orders(user_id, status, created_at)";

const ensureCategoriesSlugIndexSql =
  "CREATE UNIQUE INDEX unique_categories_slug ON categories(slug)";

const ensureProductsSlugIndexSql =
  "CREATE UNIQUE INDEX unique_products_slug ON products(slug)";

const ensureProductsCategoryActiveIndexSql =
  "CREATE INDEX idx_products_category_active ON products(category_id, is_active)";

const ensureProductsFeaturedActiveIndexSql =
  "CREATE INDEX idx_products_featured_active ON products(is_featured, is_active)";

const ensureTable = async (db, statement) => {
  await db.query(statement);
};

const ensureColumns = async (db, tableName, columnDefinitions) => {
  const [columns] = await db.query(`SHOW COLUMNS FROM \`${tableName}\``);
  const existingColumnNames = new Set(columns.map((column) => column.Field));

  for (const [columnName, definition] of Object.entries(columnDefinitions)) {
    if (existingColumnNames.has(columnName)) {
      continue;
    }

    await db.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`);
  }
};

const ensureIndex = async (db, tableName, indexName, createSql) => {
  const [indexes] = await db.query(
    `SHOW INDEX FROM ${tableName} WHERE Key_name = ?`,
    [indexName],
  );
  if (indexes.length > 0) {
    return;
  }

  await db.query(createSql);
};

const ensurePaymentMethodsSeed = async (db) => {
  const [rows] = await db.query("SELECT code FROM payment_methods");
  const existingCodes = new Set(
    rows.map((row) =>
      String(row.code || "")
        .trim()
        .toLowerCase(),
    ),
  );

  for (const method of defaultPaymentMethods) {
    if (existingCodes.has(method.code)) {
      continue;
    }

    await db.query(
      `INSERT INTO payment_methods
       (code, label, description, sort_order, supports_online, is_active)
       VALUES (?, ?, ?, ?, ?, TRUE)`,
      [
        method.code,
        method.label,
        method.description,
        method.sort_order,
        Boolean(method.supports_online),
      ],
    );
  }
};

const ensurePaymentAccountsSeed = async (db) => {
  const [rows] = await db.query("SELECT type FROM payment_accounts");
  const existingTypes = new Set(
    rows.map((row) => String(row.type || "").trim().toLowerCase()),
  );

  for (const account of defaultPaymentAccounts) {
    if (existingTypes.has(account.type)) {
      continue;
    }

    await db.query(
      `INSERT INTO payment_accounts (type, account_number, account_name, is_active)
       VALUES (?, ?, ?, TRUE)`,
      [account.type, account.account_number, account.account_name],
    );
  }
};

const ensureProductionSchema = async (db) => {
  for (const statement of ensureTableStatements) {
    await ensureTable(db, statement);
  }

  // Remove deprecated table from existing deployments if it is still present.
  await db.query("DROP TABLE IF EXISTS user_wellness_profiles");

  await ensurePaymentMethodsSeed(db);
  await ensurePaymentAccountsSeed(db);

  await ensureColumns(db, "users", {
    admin_role: "ENUM('super_admin', 'staff_admin', 'admin', 'moderator') DEFAULT NULL",
    admin_permissions: "JSON NULL",
    last_login: "DATETIME NULL",
    profile_image: "VARCHAR(255) NULL",
    is_active: "BOOLEAN DEFAULT TRUE",
    signup_provider: "ENUM('password', 'google') DEFAULT 'password'",
    password_set_by_user: "BOOLEAN DEFAULT TRUE",
    failed_login_attempts: "INT DEFAULT 0",
    locked_until: "DATETIME NULL",
  });

  await db.query(
    "UPDATE users SET signup_provider = 'password' WHERE signup_provider = 'facebook'",
  );
  await db.query(
    "ALTER TABLE users MODIFY COLUMN signup_provider ENUM('password', 'google') DEFAULT 'password'",
  );
  await db.query(
    "UPDATE user_sessions SET login_provider = 'password' WHERE LOWER(login_provider) = 'facebook'",
  );
  await db.query(
    "UPDATE user_login_history SET login_provider = 'password' WHERE LOWER(login_provider) = 'facebook'",
  );

  await ensureColumns(db, "categories", {
    slug: "VARCHAR(160) NULL",
    category_type: "ENUM('shop', 'shop_by_category', 'both') DEFAULT 'both'",
  });

  await db.query(
    `UPDATE categories
     SET category_type = 'both'
     WHERE category_type IS NULL OR category_type = ''`,
  );

  await ensureColumns(db, "products", {
    slug: "VARCHAR(200) NULL",
    images: "JSON NULL",
    qr_code_url: "VARCHAR(255) NULL",
    ingredients: "TEXT NULL",
    benefits: "TEXT NULL",
    usage: "TEXT NULL",
    reserved_stock: "INT NOT NULL DEFAULT 0",
  });

  await db.query(
    `UPDATE categories
     SET slug = CONCAT(
       TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER(name), '[^a-z0-9]+', '-')),
       '-',
       id
     )
     WHERE slug IS NULL OR slug = ''`,
  );

  await db.query(
    `UPDATE products
     SET slug = CONCAT(
       TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER(name), '[^a-z0-9]+', '-')),
       '-',
       id
     )
     WHERE slug IS NULL OR slug = ''`,
  );

  await db.query(
    `UPDATE products
     SET images = JSON_ARRAY(image_url)
     WHERE images IS NULL AND image_url IS NOT NULL`,
  );

  await db.query(
    `UPDATE products
     SET images = JSON_ARRAY()
     WHERE images IS NULL`,
  );

  await db.query("ALTER TABLE categories MODIFY COLUMN slug VARCHAR(160) NOT NULL");
  await db.query("ALTER TABLE products MODIFY COLUMN slug VARCHAR(200) NOT NULL");
  await backfillKnownProductContent(db);

  await ensureColumns(db, "advance_payment_verifications", {
    transaction_id: "VARCHAR(50) NULL",
  });
  await ensureIndex(
    db,
    "advance_payment_verifications",
    "uq_apv_transaction_id",
    "CREATE UNIQUE INDEX uq_apv_transaction_id ON advance_payment_verifications (transaction_id)",
  );

  await ensureColumns(db, "orders", ordersColumnDefinitions);
  await db.query(
    "ALTER TABLE orders MODIFY COLUMN payment_method ENUM('cod', 'card', 'online', 'easypaisa', 'jazzcash') DEFAULT 'cod'",
  );
  await ensureIndex(
    db,
    "orders",
    "idx_orders_user_status_created",
    ensureOrdersIndexSql,
  );
  await ensureIndex(
    db,
    "categories",
    "unique_categories_slug",
    ensureCategoriesSlugIndexSql,
  );
  await ensureIndex(
    db,
    "products",
    "unique_products_slug",
    ensureProductsSlugIndexSql,
  );
  await ensureIndex(
    db,
    "products",
    "idx_products_category_active",
    ensureProductsCategoryActiveIndexSql,
  );
  await ensureIndex(
    db,
    "products",
    "idx_products_featured_active",
    ensureProductsFeaturedActiveIndexSql,
  );
};

module.exports = {
  ensureProductionSchema,
};
