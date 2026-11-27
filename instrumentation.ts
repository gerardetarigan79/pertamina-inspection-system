import { getAuthSecret, getDatabaseUrl } from "./app/lib/env";

/** Validate runtime configuration before the Next.js server accepts requests. */
export async function register() {
  getDatabaseUrl();
  getAuthSecret();
}
