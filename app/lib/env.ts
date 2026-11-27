/**
 * Server-side environment accessors. Keep secret validation in one place so
 * runtime routes, startup checks, and maintenance scripts fail consistently.
 */
function parseConnectionString(value: string, variableName: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${variableName} must be a valid PostgreSQL connection URL.`);
  }

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error(`${variableName} must use the PostgreSQL URL scheme.`);
  }
  if (parsed.searchParams.get("sslmode") !== "require") {
    throw new Error(`${variableName} must include ?sslmode=require for Neon TLS connections.`);
  }
  return parsed;
}

export function getDatabaseUrl(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const databaseUrl = environment.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("Missing required environment variable: DATABASE_URL. Configure the pooled Neon URL with sslmode=require.");
  }

  const parsed = parseConnectionString(databaseUrl, "DATABASE_URL");
  if (!parsed.hostname.includes("-pooler")) {
    throw new Error("DATABASE_URL must use the pooled Neon hostname (containing -pooler) for application requests.");
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

  const parsed = parseConnectionString(directUrl, "DIRECT_URL");
  if (parsed.hostname.includes("-pooler")) {
    throw new Error("DIRECT_URL must use the direct Neon hostname without -pooler for database migrations.");
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
