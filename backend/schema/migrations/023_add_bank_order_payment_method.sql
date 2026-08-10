ALTER TABLE orders
  MODIFY COLUMN payment_method ENUM('cod', 'card', 'online', 'easypaisa', 'jazzcash', 'bank') DEFAULT 'cod';
