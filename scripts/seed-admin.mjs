import bcrypt from "bcryptjs";
import { existsSync } from "node:fs";
import { Pool } from "@neondatabase/serverless";

// Next.js does not automatically load .env.local for standalone Node scripts.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const connectionString = process.env.DIRECT_URL?.trim();
const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD;

if (!connectionString) throw new Error("DIRECT_URL is required to seed the first administrator. Set it in .env.local or the shell environment.");
const directUrl = new URL(connectionString);
if (directUrl.searchParams.get("sslmode") !== "require" || directUrl.hostname.includes("-pooler")) {
  throw new Error("DIRECT_URL must be a direct (non-pooler) Neon PostgreSQL URL with sslmode=require.");
}
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
  throw new Error("SEED_ADMIN_EMAIL must contain a valid email address.");
}
if (!password || password.length < 12 || Buffer.byteLength(password, "utf8") > 72) {
  throw new Error("SEED_ADMIN_PASSWORD must contain at least 12 characters and at most 72 UTF-8 bytes.");
}

const passwordHash = await bcrypt.hash(password, 12);
const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 10_000 });
let client;

try {
  client = await pool.connect();
  await client.query("BEGIN");
  // Serialize first-admin creation so concurrent seed invocations cannot
  // create multiple bootstrap administrators with different email addresses.
  await client.query("SELECT pg_advisory_xact_lock(78123457)");

  const existing = await client.query(
    "SELECT id, role, is_active FROM users WHERE LOWER(email) = $1 LIMIT 1 FOR UPDATE",
    [email],
  );

  if (existing.rows.length > 0) {
    const user = existing.rows[0];
    if (user.role !== "admin" || user.is_active !== true) {
      throw new Error("The seed email already exists but is not an active admin. The seed script will not silently elevate it.");
    }
    await client.query("COMMIT");
    console.log("An active administrator with this email already exists; no account or password was changed.");
  } else {
    const admins = await client.query(
      "SELECT id FROM users WHERE role = 'admin' AND is_active = TRUE LIMIT 1",
    );
    if (admins.rows.length > 0) {
      throw new Error("An active administrator already exists with a different email. Use the admin account-management page instead of seeding another bootstrap administrator.");
    }

    const inserted = await client.query(
      `INSERT INTO users (name, email, password_hash, role, is_active, must_change_password)
       VALUES ('Administrator', $1, $2, 'admin', TRUE, TRUE)
       RETURNING id`,
      [email, passwordHash],
    );
    await client.query("COMMIT");
    console.log(`Created the initial administrator account (id: ${inserted.rows[0].id}). The first login must change the temporary password.`);
  }
} catch (error) {
  await client?.query("ROLLBACK").catch(() => undefined);
  console.error("Admin seed failed:", error);
  process.exitCode = 1;
} finally {
  client?.release();
  await pool.end();
}
