import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "@neondatabase/serverless";

const migrationsDirectory = fileURLToPath(new URL("../database/migrations/", import.meta.url));
const connectionString = process.env.DIRECT_URL?.trim();

if (!connectionString) {
  throw new Error("DIRECT_URL is required for migrations. Use the direct Neon connection string (without -pooler) and include sslmode=require.");
}

const pool = new Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 5_000,
});

let client;

try {
  client = await pool.connect();
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      checksum CHAR(64) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const names = (await readdir(migrationsDirectory))
    .filter((name) => /^\d+_[a-z0-9_-]+\.sql$/i.test(name))
    .sort();

  if (names.length === 0) throw new Error("No SQL migration files were found.");

  for (const filename of names) {
    const contents = await readFile(join(migrationsDirectory, filename), "utf8");
    const checksum = createHash("sha256").update(contents).digest("hex");

    await client.query("BEGIN");
    try {
      await client.query("SELECT pg_advisory_xact_lock(731942781)");
      const applied = await client.query(
        "SELECT checksum FROM schema_migrations WHERE filename = $1",
        [filename],
      );

      if (applied.rows.length > 0) {
        if (applied.rows[0].checksum !== checksum) {
          throw new Error(`Migration ${filename} changed after it was applied. Create a new migration instead.`);
        }
        await client.query("COMMIT");
        console.log(`SKIP  ${filename} (already applied)`);
        continue;
      }

      // SQL files are trusted repository migrations and run on this transaction client.
      await client.query(contents);
      await client.query(
        "INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)",
        [filename, checksum],
      );
      await client.query("COMMIT");
      console.log(`APPLIED  ${filename}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }

  console.log("Database migrations completed.");
} catch (error) {
  console.error("Database migration failed:", error);
  process.exitCode = 1;
} finally {
  client?.release();
  await pool.end();
}
