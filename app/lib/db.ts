import { neon } from "@neondatabase/serverless";

/**
 * Create the Neon query function only when a request needs the database.
 * Keeping this check out of module scope allows Next.js to build the app
 * even when DATABASE_URL is not present in the build environment.
 */
export function getSql() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured for this environment.");
  }

  return neon(databaseUrl);
}
