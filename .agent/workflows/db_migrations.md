---
description: Run TypeORM database migrations.
---

# Database Migrations

Manage database schema changes safely.

⚠️ IMPORTANT  
This project DOES NOT use `migration:generate`.  
Auto-generated migrations often produce thousands of unintended SQL lines and may cause schema corruption.

All migrations MUST be written manually.

---

## 1. Create Migration (Manual)

After modifying an Entity file, manually create a migration file.

📁 Migration file location:
backend/src/migrations


### Steps
1. Navigate to `backend/src/migrations`
2. Check the latest migration file
3. Create a new file with a newer timestamp and a meaningful name

Example:
backend/src/migrations/
└── 1706009876543-AddUserPhone.ts


❌ DO NOT USE:
```bash
pnpm migration:generate
2. Write & Review Migration
Check: Open the manually created file in backend/src/migrations

Verify:

SQL changes are minimal and intentional

No unintended schema-wide changes

No DROP TABLE or data-loss operations unless explicitly required

down() is the exact reverse of up()

Basic template:

import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserPhone1706009876543 implements MigrationInterface {
  name = "AddUserPhone1706009876543";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user"
      ADD COLUMN "phone" varchar(20)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user"
      DROP COLUMN "phone"
    `);
  }
}
3. Run Migration
Apply migrations to the local database.

pnpm migration:run
Before running:

Ensure only ONE new migration file was added

Ensure it is based on the latest migration

4. Revert (If needed)
Undo the last applied migration only.

pnpm migration:revert
⚠️ Revert always rolls back the MOST RECENT migration.

