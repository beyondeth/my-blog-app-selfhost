---
description: Run TypeORM database migrations.
---

# Database Migrations

Manage database schema changes safely.

## 1. Generate Migration
After modifying an Entity file, generate a migration file.

```bash
cd backend
pnpm migration:generate src/migrations/DescriptionOfChange
```
*   **Note**: Replace `DescriptionOfChange` with a meaningful name (e.g., `AddUserPhone`).

## 2. Review Migration
*   **Check**: Open the generated file in `src/migrations/`.
*   **Verify**: Ensure strict SQL changes match your intent. Look out for `DROP TABLE` or data loss risks.

## 3. Run Migration
Apply changes to the local database.

```bash
pnpm migration:run
```

## 4. Revert (If needed)
Undo the last applied migration.

```bash
pnpm migration:revert
```

## Troubleshooting
*   **Sync**: If the DB is out of sync with migrations, you may need to drop the schema (development only) or carefully craft a manual migration.
