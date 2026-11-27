import assert from "node:assert/strict";
import test from "node:test";

import {
  isValidNewPassword,
  parseCreateUserInput,
  parseLoginInput,
  parseUpdateUserInput,
} from "../app/lib/auth-validation.ts";

test("login input is normalized and validated", () => {
  assert.deepEqual(parseLoginInput({ email: " ADMIN@example.com ", password: "temporary-pass" }), {
    email: "admin@example.com",
    password: "temporary-pass",
  });
  assert.equal(parseLoginInput({ email: "bad-email", password: "x" }), null);
});

test("new account requires a valid role and a strong temporary password", () => {
  const input = {
    name: "Inspector One",
    email: "inspector@example.com",
    role: "inspector",
    temporaryPassword: "Temporary-1234",
  };
  assert.equal(parseCreateUserInput(input)?.mustChangePassword, true);
  assert.equal(parseCreateUserInput({ ...input, role: "owner" }), null);
  assert.equal(parseCreateUserInput({ ...input, temporaryPassword: "short" }), null);
});

test("account updates reject empty or invalid updates", () => {
  assert.deepEqual(parseUpdateUserInput({ role: "viewer", isActive: false }), {
    role: "viewer",
    isActive: false,
  });
  assert.equal(parseUpdateUserInput({}), null);
  assert.equal(parseUpdateUserInput({ isActive: "false" }), null);
  assert.equal(isValidNewPassword("Temporary-1234"), true);
  assert.equal(isValidNewPassword("short"), false);
});
