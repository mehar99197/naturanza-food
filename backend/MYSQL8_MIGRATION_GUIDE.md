# Naturanza Foods - MySQL 8 Migration Guide

## 1) If you still have old XAMPP dump/data

1. Export from old XAMPP/MariaDB (if accessible):
   ```bash
   mysqldump -u root -p --routines --triggers --single-transaction naturanzafood > legacy_naturanzafood.sql
   ```
2. Create/import into official MySQL 8 target database:
   ```bash
   mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS naturanza_foods CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
   mysql -u root -p naturanza_foods < legacy_naturanzafood.sql
   ```
3. Run schema upgrade script:
   ```bash
   mysql -u root -p naturanza_foods < schema/migrations/001_upgrade_legacy_schema.sql
   ```
4. Run app-level compatibility + seed (safe to rerun):
   ```bash
   node setup-database.js --with-seed
   ```

## 2) If old dump is outdated or unavailable (recommended for clean start)

1. Configure backend env in `.env`:
   - `DB_HOST=localhost`
   - `DB_PORT=3306`
   - `DB_USER=root`
   - `DB_PASSWORD=` (or your local root password)
   - `DB_NAME=naturanza_foods`
2. Build schema + seed fresh:
   ```bash
   node setup-database.js --with-seed
   ```

## 3) Canonical modern schema

- Main schema file (CREATE TABLE statements): `schema/database.sql`
- Legacy upgrade migration: `schema/migrations/001_upgrade_legacy_schema.sql`

## 4) Quick verification

```bash
mysql -u root -p -e "USE naturanza_foods; SHOW TABLES;"
mysql -u root -p -e "USE naturanza_foods; SELECT COUNT(*) AS products FROM products;"
npm run dev
```

Health check:

- `GET http://localhost:5000/api/health`
