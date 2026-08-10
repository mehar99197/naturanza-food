-- Expand email columns to the RFC-compatible application limit.
ALTER TABLE users MODIFY COLUMN email VARCHAR(254) NOT NULL;
ALTER TABLE contacts MODIFY COLUMN email VARCHAR(254) NOT NULL;
