import { getDatabaseUrl } from "./app/lib/env";

/**
 * Validate server configuration when the Next.js server starts.
 * CI supplies a placeholder URL for build/start smoke checks; no DB request is made.
 */
export async function register() {
  getDatabaseUrl();
}
