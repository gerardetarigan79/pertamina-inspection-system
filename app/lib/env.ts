/**
 * Read the required Neon connection string from the server environment.
 * The application uses the pooled URL for its serverless HTTP queries.
 */
export function getDatabaseUrl(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const databaseUrl = environment.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error(
      "Missing required environment variable: DATABASE_URL. Copy .env.example to .env.local and set a Neon pooled connection string with sslmode=require.",
    );
  }

  return databaseUrl;
}
