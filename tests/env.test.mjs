import assert from "node:assert/strict";
import test from "node:test";

import { getDatabaseUrl } from "../app/lib/env.ts";

test("getDatabaseUrl rejects a missing DATABASE_URL with an actionable message", () => {
  assert.throws(
    () => getDatabaseUrl({}),
    /Missing required environment variable: DATABASE_URL/,
  );
});

test("getDatabaseUrl returns the configured connection string", () => {
  assert.equal(
    getDatabaseUrl({ DATABASE_URL: "  postgresql://example/db?sslmode=require  " }),
    "postgresql://example/db?sslmode=require",
  );
});
