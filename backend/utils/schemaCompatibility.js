const { backfillKnownProductContent } = require("./productContentDefaults");
const { buildInternalEan13 } = require("./barcode");

const ensureTableStatements = [
  `CREATE TABLE IF NOT EXISTS reviews (
    id INT PRIMARY KEY AUTO_INCREMENT,
    product_id INT NOT NULL,
    user_id INT NOT NULL,
    rating INT NOT NULL,
    comment TEXT,
    is_approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS email_verification_codes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    email VARCHAR(254) NOT NULL,
    code_hash CHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    used_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_evc_user (user_id, is_used, expires_at),
    INDEX idx_evc_email (email, is_used),
    INDEX idx_evc_expires (expires_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    email VARCHAR(254) NOT NULL,
    token_hash CHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    used_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_password_reset_token_hash (token_hash),
    INDEX idx_password_reset_user (user_id, is_used, expires_at),
    INDEX idx_password_reset_email (email, is_used),
    INDEX idx_password_reset_expires (expires_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS blog_posts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    slug VARCHAR(200) NOT NULL UNIQUE,
    title VARCHAR(200) NOT NULL,
    excerpt VARCHAR(500),
    content LONGTEXT NOT NULL,
    author VARCHAR(120) DEFAULT 'Naturanza Food Team',
    category VARCHAR(80),
    image_url VARCHAR(255),
    read_time VARCHAR(40),
    keywords VARCHAR(500),
    featured BOOLEAN NOT NULL DEFAULT FALSE,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_blog_published (is_published, published_at),
    INDEX idx_blog_category (category)
  )`,
  `CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    admin_id INT NOT NULL,
    action VARCHAR(500) NOT NULL,
    ip_address VARCHAR(50),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_admin_audit_logs_admin (admin_id, created_at),
    INDEX idx_admin_audit_logs_created (created_at)
  )`,
  `CREATE TABLE IF NOT EXISTS admin_security_ip_allowlist (
    id INT AUTO_INCREMENT PRIMARY KEY,
    label VARCHAR(120) NOT NULL,
    cidr VARCHAR(64) NOT NULL,
    created_by INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_admin_security_ip_allowlist_cidr (cidr),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_admin_security_ip_allowlist_created (created_at)
  )`,
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
    is_active: false,
  },
  {
    code: "online",
    label: "Online Transfer",
    description: "Bank transfer and online gateways",
    sort_order: 3,
    supports_online: true,
    is_active: false,
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
  {
    code: "bank",
    label: "Bank Transfer",
    description: "Manual bank transfer",
    sort_order: 6,
    supports_online: false,
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

const widenEmailColumnIfPresent = async (db, tableName) => {
  const [tables] = await db.query("SHOW TABLES LIKE ?", [tableName]);
  if (!tables.length) return;
  await db.query(`ALTER TABLE \`${tableName}\` MODIFY COLUMN email VARCHAR(254) NOT NULL`);
};

const removeDuplicateReviews = async (db) => {
  const [duplicates] = await db.query(
    `SELECT user_id, product_id, MAX(id) AS keep_id
       FROM reviews
      GROUP BY user_id, product_id
     HAVING COUNT(*) > 1`,
  );

  for (const duplicate of duplicates) {
    await db.query(
      "DELETE FROM reviews WHERE user_id = ? AND product_id = ? AND id <> ?",
      [duplicate.user_id, duplicate.product_id, duplicate.keep_id],
    );
  }
};

const migrateLegacyWishlist = async (db) => {
  try {
    await db.query(
      `INSERT IGNORE INTO user_wishlist (user_id, product_id, added_at)
       SELECT user_id, product_id, created_at FROM wishlist`,
    );
  } catch (error) {
    if (error?.errno !== 1146) {
      throw error;
    }
  }
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
        VALUES (?, ?, ?, ?, ?, ?)`,
      [
        method.code,
        method.label,
        method.description,
        method.sort_order,
        Boolean(method.supports_online),
        method.is_active !== false,
      ],
    );
  }

  // COD is a core storefront method and is always rendered by checkout. Repair
  // older databases where an admin toggle left the UI and order API mismatched.
  await db.query("UPDATE payment_methods SET is_active = TRUE WHERE code = 'cod'");

  // No card/online gateway is integrated in this application. Keep those
  // methods unavailable instead of presenting a payment option that can never
  // be verified.
  await db.query(
    "UPDATE payment_methods SET is_active = FALSE WHERE code IN ('card', 'online')",
  );
};

const ensurePaymentAccountsSeed = async (db) => {
  const [rows] = await db.query("SELECT type, account_number FROM payment_accounts");
  const existingTypes = new Set(
    rows.map((row) => String(row.type || "").trim().toLowerCase()),
  );

  for (const account of defaultPaymentAccounts) {
    if (existingTypes.has(account.type)) {
      continue;
    }

    await db.query(
      `INSERT INTO payment_accounts (type, account_number, account_name, is_active)
        VALUES (?, ?, ?, FALSE)`,
      [account.type, account.account_number, account.account_name],
    );
  }

  for (const row of rows) {
    const accountNumber = String(row.account_number || "").trim().toUpperCase();
    if (accountNumber.includes("XX") || accountNumber.startsWith("PK00XXXX")) {
      await db.query(
        "UPDATE payment_accounts SET is_active = FALSE WHERE type = ?",
        [row.type],
      );
    }
  }
};

/**
 * Give every product a scannable retail barcode. Runs after the barcode column
 * and its unique index exist, so pre-existing catalogues get codes without a
 * manual backfill step. Generation is deterministic per product id — reprinting
 * a label always yields the same code — and the algorithm lives only in
 * utils/barcode.js so it can never drift from validation.
 */
const backfillProductBarcodes = async (db) => {
  const [rows] = await db.query(
    "SELECT id FROM products WHERE barcode IS NULL OR barcode = ''",
  );

  for (const row of rows) {
    await db.query("UPDATE products SET barcode = ? WHERE id = ?", [
      buildInternalEan13(row.id),
      row.id,
    ]);
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
  await migrateLegacyWishlist(db);
  await removeDuplicateReviews(db);
  await ensureIndex(
    db,
    "reviews",
    "uq_reviews_user_product",
    "CREATE UNIQUE INDEX uq_reviews_user_product ON reviews (user_id, product_id)",
  );

  await ensureColumns(db, "users", {
    admin_role: "ENUM('super_admin', 'staff_admin', 'admin', 'moderator') DEFAULT NULL",
    admin_permissions: "JSON NULL",
    last_login: "DATETIME NULL",
    profile_image: "VARCHAR(255) NULL",
    is_active: "BOOLEAN DEFAULT TRUE",
    signup_provider: "ENUM('password', 'google') DEFAULT 'password'",
    password_set_by_user: "BOOLEAN DEFAULT TRUE",
    // Existing accounts are grandfathered in; password registration explicitly
    // writes FALSE and sends the verification email.
    email_verified: "BOOLEAN NOT NULL DEFAULT TRUE",
    // Legacy single-context lockout columns (kept for rollback safety).
    failed_login_attempts: "INT DEFAULT 0",
    locked_until: "DATETIME NULL",
    // Per-portal lockout counters so a user-portal brute force cannot lock
    // the admin portal (and vice versa).
    user_failed_login_attempts: "INT DEFAULT 0",
    user_locked_until: "DATETIME NULL",
    admin_failed_login_attempts: "INT DEFAULT 0",
    admin_locked_until: "DATETIME NULL",
    // Admin TOTP two-factor authentication (secret encrypted at rest).
    two_fa_secret_encrypted: "TEXT NULL",
    two_fa_enabled: "BOOLEAN NOT NULL DEFAULT FALSE",
    two_fa_enabled_at: "DATETIME NULL",
    two_fa_recovery_codes: "JSON NULL",
  });

  // One-time migration: copy legacy lockout state into both new contexts so
  // existing locked accounts stay locked after deploy.
  await db.query(
    "UPDATE users\n     SET user_failed_login_attempts = GREATEST(user_failed_login_attempts, failed_login_attempts),\n         user_locked_until = COALESCE(user_locked_until, locked_until),\n         admin_failed_login_attempts = GREATEST(admin_failed_login_attempts, failed_login_attempts),\n         admin_locked_until = COALESCE(admin_locked_until, locked_until)\n     WHERE failed_login_attempts > 0 OR locked_until IS NOT NULL",
  );

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

  await ensureColumns(db, "user_sessions", {
    device_name: "VARCHAR(120) NULL",
    location_label: "VARCHAR(180) NULL",
  });

  await ensureColumns(db, "admin_audit_logs", {
    category: "VARCHAR(60) NOT NULL DEFAULT 'admin_action'",
    actor_email: "VARCHAR(254) NULL",
    user_agent: "VARCHAR(255) NULL",
    metadata: "JSON NULL",
  });

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
    barcode: "VARCHAR(20) NULL",
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
    "UPDATE products SET discount_percentage = LEAST(GREATEST(discount_percentage, 0), 90)",
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
    verification_stage:
      "ENUM('full_payment', 'advance_shipping', 'final_collection') NOT NULL DEFAULT 'full_payment'",
    admin_note: "TEXT NULL",
  });
  await widenEmailColumnIfPresent(db, "users");
  await widenEmailColumnIfPresent(db, "contacts");
  await widenEmailColumnIfPresent(db, "password_reset_tokens");
  await widenEmailColumnIfPresent(db, "newsletter_subscribers");
  await ensureColumns(db, "newsletter_subscribers", {
    verification_token: "VARCHAR(64) NULL",
    verification_token_expires_at: "TIMESTAMP NULL DEFAULT NULL",
    verified_at: "TIMESTAMP NULL DEFAULT NULL",
  });

  // Double-opt-in: existing rows stay active; new rows default to pending.
  await db.query(
    "ALTER TABLE newsletter_subscribers MODIFY COLUMN status ENUM('pending', 'active', 'unsubscribed') NOT NULL DEFAULT 'pending'",
  );
  await db.query(
    "UPDATE newsletter_subscribers SET status = 'active', verified_at = COALESCE(verified_at, subscribed_at) WHERE status IN ('active', 'unsubscribed')",
  );
  await db.query(
    "CREATE INDEX IF NOT EXISTS idx_newsletter_verification_token ON newsletter_subscribers(verification_token)",
  );


  await ensureColumns(db, "admin_settings", {
    address: "VARCHAR(255) NOT NULL DEFAULT 'Pakistan'",
    support_hours: "VARCHAR(120) NOT NULL DEFAULT 'Available 24/7'",
    facebook_url: "VARCHAR(255) NOT NULL DEFAULT ''",
    instagram_url: "VARCHAR(255) NOT NULL DEFAULT ''",
    twitter_url: "VARCHAR(255) NOT NULL DEFAULT ''",
    youtube_url: "VARCHAR(255) NOT NULL DEFAULT ''",
    whatsapp_number: "VARCHAR(30) NOT NULL DEFAULT ''",
    whatsapp_enabled: "BOOLEAN NOT NULL DEFAULT TRUE",
    map_latitude: "DECIMAL(10, 7) NOT NULL DEFAULT 31.5204000",
    map_longitude: "DECIMAL(10, 7) NOT NULL DEFAULT 74.3587000",
    map_location_label: "VARCHAR(120) NOT NULL DEFAULT 'Pakistan, Lahore'",
    newsletter_welcome_promo_code: "VARCHAR(40) NOT NULL DEFAULT ''",
    store_discount_active: "BOOLEAN NOT NULL DEFAULT FALSE",
    store_discount_percentage: "DECIMAL(5, 2) NOT NULL DEFAULT 0",
    store_discount_label: "VARCHAR(60) NOT NULL DEFAULT 'Store Sale'",
  });
  await db.query(
    "ALTER TABLE advance_payment_verifications MODIFY COLUMN payment_method ENUM('jazzcash','easypaisa','bank','cod') NOT NULL",
  );
  await ensureIndex(
    db,
    "advance_payment_verifications",
    "uq_apv_transaction_id",
    "CREATE UNIQUE INDEX uq_apv_transaction_id ON advance_payment_verifications (transaction_id)",
  );
  await ensureIndex(
    db,
    "advance_payment_verifications",
    "idx_apv_stage_status",
    "CREATE INDEX idx_apv_stage_status ON advance_payment_verifications (verification_stage, status)",
  );
  await ensureIndex(
    db,
    "advance_payment_verifications",
    "uq_apv_order_stage",
    "CREATE UNIQUE INDEX uq_apv_order_stage ON advance_payment_verifications (order_id, verification_stage)",
  );

  await ensureColumns(db, "orders", ordersColumnDefinitions);
  await db.query(
    "ALTER TABLE orders MODIFY COLUMN payment_method ENUM('cod', 'card', 'online', 'easypaisa', 'jazzcash', 'bank') DEFAULT 'cod'",
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
  await ensureIndex(
    db,
    "products",
    "uq_products_barcode",
    "CREATE UNIQUE INDEX uq_products_barcode ON products (barcode)",
  );
  await backfillProductBarcodes(db);
};

module.exports = {
  ensureProductionSchema,
};
