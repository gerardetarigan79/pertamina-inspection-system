/**
 * Server-side environment accessors. Keep secret validation in one place so
 * runtime routes, startup checks, and maintenance scripts fail consistently.
 */
export function getDatabaseUrl(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const databaseUrl = environment.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("Missing required environment variable: DATABASE_URL. Configure the pooled Neon URL with sslmode=require.");
  }
  return databaseUrl;
}

export function getDirectUrl(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const directUrl = environment.DIRECT_URL?.trim();
  if (!directUrl) {
    throw new Error("Missing required environment variable: DIRECT_URL. Configure the direct (non-pooler) Neon URL before running database migrations or the admin seed.");
  }
  return directUrl;
}

export function getAuthSecret(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const secret = environment.AUTH_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("Missing or invalid AUTH_SECRET. Set a cryptographically random secret containing at least 32 characters.");
  }
  return secret;
}
