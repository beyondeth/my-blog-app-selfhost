import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

const DB_URL = "postgres://postgres:2Cbu7mwp67DF3iCi@db.mniyhxyjhukseaqjrgrt.supabase.co:5432/postgres";

async function run() {
  const client = new Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log("Connecting to DB...");
    await client.connect();
    
    const schemaPath = path.resolve(__dirname, '../../openclaw-lab/business_plan_schema.sql');
    console.log(`Reading schema from ${schemaPath}`);
    const sql = fs.readFileSync(schemaPath, 'utf8');

    console.log("Executing SQL...");
    await client.query(sql);
    
    console.log("Schema Initialized Successfully!");
  } catch (e) {
    console.error("Failed to init DB:", e);
  } finally {
    await client.end();
  }
}

run();
