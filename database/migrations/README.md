# Database migrations

SQL migrations are applied in lexicographic order by `npm run db:migrate`.

- `000_source_tables.sql` creates the source tables used by the existing API handlers. Its columns and types follow the current SQL reads and writes in this repository.
- `001_unified_asset_register.sql` adds the shared asset register and foreign keys.
- `002_corrosion_monitoring.sql` adds coupon and inhibitor monitoring.
- `003_authentication.sql` adds users, database-backed sessions, and persistent login rate-limit records.

The runner records each filename and SHA-256 checksum in `schema_migrations`. It applies each file in its own transaction and rejects a changed file after it has been applied.

For an existing Neon database, take a backup before the first run. Migration 001 can fail if existing source rows refer to asset IDs that are not in `assets`. Resolve those rows with the data owner before applying the migration; do not disable the foreign-key constraints to make it pass.
