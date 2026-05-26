-- 012_stock_reservations.sql
-- Soft-reservation system: hold stock at order-placement, consume on payment-approval,
-- release on reject/expiry. Prevents both overselling AND lost sales from queue lag.
--
-- Invariant:    available_stock := products.stock_quantity - products.reserved_stock
-- Lifecycle:    held -> consumed (admin approves)
--               held -> released (admin rejects OR sweeper sees expires_at < NOW)

START TRANSACTION;

ALTER TABLE products
  ADD COLUMN reserved_stock INT NOT NULL DEFAULT 0 AFTER stock_quantity;

CREATE TABLE IF NOT EXISTS stock_reservations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  state ENUM('held','consumed','released') NOT NULL DEFAULT 'held',
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id)   REFERENCES orders(id)   ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_resv_state_expires (state, expires_at),
  INDEX idx_resv_order (order_id)
);

COMMIT;
