
import { DataSource } from "typeorm";
import { config } from "dotenv";
import { join } from "path";

config({ path: join(__dirname, ".env") });

const dataSource = new DataSource({
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  username: "postgres",
  password: "postgres",
  database: "blog-dev",
  ssl: false,
});

async function checkLogs() {
  try {
    await dataSource.initialize();
    console.log("DB Connected");

    const count = await dataSource.query(`SELECT COUNT(*) FROM "moderation_logs"`);
    console.log("Total Logs:", count[0].count);

    if (count[0].count > 0) {
        const rows = await dataSource.query(`SELECT * FROM "moderation_logs" ORDER BY created_at DESC LIMIT 5`);
        console.log("Latest 5 Logs:", JSON.stringify(rows, null, 2));
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await dataSource.destroy();
  }
}

checkLogs();
