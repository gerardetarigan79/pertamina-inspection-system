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
    getDatabaseUrl({ DATABASE_URL: "  postgresql://user:pass@ep-example-pooler.region.aws.neon.tech/db?sslmode=require  " }),
    "postgresql://user:pass@ep-example-pooler.region.aws.neon.tech/db?sslmode=require",
  );
});

test("getDatabaseUrl requires a pooled Neon URL with SSL", () => {
  assert.equal(
    getDatabaseUrl({ DATABASE_URL: "postgresql://user:pass@ep-test-pooler.region.aws.neon.tech/db?sslmode=require" }),
    "postgresql://user:pass@ep-test-pooler.region.aws.neon.tech/db?sslmode=require",
  );
  assert.throws(
    () => getDatabaseUrl({ DATABASE_URL: "postgresql://user:pass@ep-test.region.aws.neon.tech/db?sslmode=require" }),
    /pooled Neon hostname/,
  );
  assert.throws(
    () => getDatabaseUrl({ DATABASE_URL: "postgresql://user:pass@ep-test-pooler.region.aws.neon.tech/db" }),
    /sslmode=require/,
  );
});
