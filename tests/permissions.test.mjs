import assert from "node:assert/strict";
import test from "node:test";

import { hasPermission, rolesForPermission } from "../app/lib/permissions.ts";

test("viewer has read-only access and cannot manage users", () => {
  assert.equal(hasPermission("viewer", "read_workspace"), true);
  assert.equal(hasPermission("viewer", "write_inspections"), false);
  assert.equal(hasPermission("viewer", "manage_users"), false);
});

test("inspector can write inspection data but cannot manage accounts", () => {
  assert.equal(hasPermission("inspector", "write_inspections"), true);
  assert.equal(hasPermission("inspector", "manage_users"), false);
});

test("admin-only permissions resolve to admin", () => {
  assert.deepEqual(rolesForPermission("manage_users"), ["admin"]);
  assert.deepEqual(rolesForPermission("view_system_health"), ["admin"]);
});
