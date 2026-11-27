import assert from "node:assert/strict";
import test from "node:test";

import { requirePermission } from "../app/lib/auth.ts";

test("a viewer making a direct request to an admin-only endpoint receives 403", async () => {
  const viewer = {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Read Only User",
    email: "viewer@example.com",
    role: "viewer",
    mustChangePassword: false,
  };
  const result = await requirePermission(
    new Request("https://example.test/api/admin/users"),
    "manage_users",
    async () => viewer,
  );

  assert.equal(result.authorized, false);
  if (!result.authorized) assert.equal(result.response.status, 403);
});

test("an inspector cannot access admin account management", async () => {
  const inspector = {
    id: "00000000-0000-4000-8000-000000000002",
    name: "Inspection User",
    email: "inspector@example.com",
    role: "inspector",
    mustChangePassword: false,
  };
  const result = await requirePermission(
    new Request("https://example.test/api/admin/users"),
    "manage_users",
    async () => inspector,
  );

  assert.equal(result.authorized, false);
  if (!result.authorized) assert.equal(result.response.status, 403);
});

test("an admin can access admin account management", async () => {
  const admin = {
    id: "00000000-0000-4000-8000-000000000003",
    name: "Administrator",
    email: "admin@example.com",
    role: "admin",
    mustChangePassword: false,
  };
  const result = await requirePermission(
    new Request("https://example.test/api/admin/users"),
    "manage_users",
    async () => admin,
  );

  assert.equal(result.authorized, true);
});
