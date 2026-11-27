import assert from "node:assert/strict";
import test from "node:test";

import { hasPermission, rolesForPermission } from "../app/lib/permissions.ts";

test("viewer is read-only and cannot access write or administration permissions", () => {
  assert.equal(hasPermission("viewer", "read_workspace"), true);
  assert.equal(hasPermission("viewer", "write_inspections"), false);
  assert.equal(hasPermission("viewer", "import_data"), false);
  assert.equal(hasPermission("viewer", "write_monitoring"), false);
  assert.equal(hasPermission("viewer", "manage_users"), false);
});

test("inspector can work with inspections, imports, monitoring, alerts, and work programs", () => {
  assert.equal(hasPermission("inspector", "write_inspections"), true);
  assert.equal(hasPermission("inspector", "import_data"), true);
  assert.equal(hasPermission("inspector", "write_monitoring"), true);
  assert.equal(hasPermission("inspector", "review_alerts"), true);
  assert.equal(hasPermission("inspector", "manage_work_programs"), true);
  assert.equal(hasPermission("inspector", "manage_users"), false);
});

test("admin has all configured permissions", () => {
  for (const permission of [
    "read_workspace", "write_inspections", "import_data", "write_monitoring",
    "review_alerts", "manage_work_programs", "manage_users", "view_system_health",
  ]) {
    assert.equal(hasPermission("admin", permission), true);
  }
});

test("account and system administration permissions resolve to admin only", () => {
  assert.deepEqual(rolesForPermission("manage_users"), ["admin"]);
  assert.deepEqual(rolesForPermission("view_system_health"), ["admin"]);
});
