import assert from "node:assert/strict";
import test from "node:test";

import { getAuthSecret, getDatabaseUrl, getDirectUrl } from "../app/lib/env.ts";

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

test("getDirectUrl requires a direct Neon URL with SSL", () => {
  assert.equal(
    getDirectUrl({ DIRECT_URL: "postgresql://user:pass@ep-example.region.aws.neon.tech/db?sslmode=require" }),
    "postgresql://user:pass@ep-example.region.aws.neon.tech/db?sslmode=require",
  );
  assert.throws(
    () => getDirectUrl({ DIRECT_URL: "postgresql://user:pass@ep-example-pooler.region.aws.neon.tech/db?sslmode=require" }),
    /direct Neon hostname/,
  );
  assert.throws(() => getDirectUrl({}), /Missing required environment variable: DIRECT_URL/);
});

test("getAuthSecret requires at least 32 characters", () => {
  assert.equal(getAuthSecret({ AUTH_SECRET: "a-secret-that-is-long-enough-for-tests-123456" }), "a-secret-that-is-long-enough-for-tests-123456");
  assert.throws(() => getAuthSecret({ AUTH_SECRET: "too-short" }), /at least 32 characters/);
  assert.throws(() => getAuthSecret({}), /at least 32 characters/);
});
