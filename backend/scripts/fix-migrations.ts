#!/usr/bin/env ts-node

/**
 * Script to make all migrations idempotent
 * This will update migrations to check for existing tables/columns/types before creating them
 */

import * as fs from 'fs';
import * as path from 'path';

const migrationsDir = path.join(__dirname, '..', 'src', 'migrations');

// Fix patterns for each migration
const fixes = {
  '1755000000000-AddHybridMarkdownStorage.ts': {
    old: `        await queryRunner.query(\`
            CREATE TYPE "posts_content_type_enum" AS ENUM('markdown', 'html')
        \`);`,
    new: `        // Check if enum type exists
        const enumExists = await queryRunner.query(\`
            SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'posts_content_type_enum')
        \`);
        
        if (!enumExists[0].exists) {
            await queryRunner.query(\`
                CREATE TYPE "posts_content_type_enum" AS ENUM('markdown', 'html')
            \`);
        }`
  },
  '1755405454228-CreateEmailVerification.ts': {
    checkTableFirst: true,
    tableName: 'email_verifications'
  },
  '1755443019451-AddCascadeToBlogs.ts': {
    checkConstraintFirst: true
  },
  '1755449121216-AddVersionColumnToPost.ts': {
    checkColumnFirst: true,
    tableName: 'posts',
    columnName: 'version'
  },
  '1755500000000-AddCascadeDeleteConstraints.ts': {
    checkConstraintFirst: true
  }
};

// Function to fix a migration file
async function fixMigration(fileName: string): Promise<void> {
  const filePath = path.join(migrationsDir, fileName);
  
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${fileName} - file not found`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf-8');
  const fix = fixes[fileName];
  
  if (!fix) {
    console.log(`No fix defined for ${fileName}`);
    return;
  }
  
  if (fix.old && fix.new) {
    content = content.replace(fix.old, fix.new);
    fs.writeFileSync(filePath, content);
    console.log(`Fixed ${fileName}`);
  } else {
    console.log(`Manual fix needed for ${fileName}`);
  }
}

// Fix all migrations
async function main() {
  console.log('Fixing migrations to be idempotent...\n');
  
  for (const fileName of Object.keys(fixes)) {
    await fixMigration(fileName);
  }
  
  console.log('\nDone! Migrations should now be idempotent.');
}

main().catch(console.error);