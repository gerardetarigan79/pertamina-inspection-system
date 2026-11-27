import assert from "node:assert/strict";
import test from "node:test";

import {
  createSessionToken,
  createSignedSessionCookie,
  hashSessionToken,
  readCookie,
  verifySessionCookie,
} from "../app/lib/auth-security.ts";

const secret = "test-only-secret-that-is-at-least-32-characters-long";

test("signed sessions round-trip and preserve forced password changes", () => {
  const token = createSessionToken();
  const expiresAt = 2_000_000_000;
  const cookie = createSignedSessionCookie({ token, expiresAt, mustChangePassword: true }, secret);

  assert.deepEqual(verifySessionCookie(cookie, secret, 1_900_000_000), {
    token,
    expiresAt,
    mustChangePassword: true,
  });
});

test("session verification rejects tampering, wrong secrets, and expired sessions", () => {
  const token = createSessionToken();
  const cookie = createSignedSessionCookie(
    { token, expiresAt: 2_000_000_000, mustChangePassword: false },
    secret,
  );
  const [payload, signature] = cookie.split(".");
  const changedSignature = `${signature[0] === "a" ? "b" : "a"}${signature.slice(1)}`;

  assert.equal(verifySessionCookie(`${payload}.${changedSignature}`, secret, 1_900_000_000), null);
  assert.equal(verifySessionCookie(cookie, "a-different-secret-with-sufficient-length", 1_900_000_000), null);
  assert.equal(verifySessionCookie(cookie, secret, 2_000_000_001), null);
});

test("stored session tokens are hashed and cookie extraction is exact", () => {
  const token = createSessionToken();
  assert.notEqual(hashSessionToken(token), token);
  assert.equal(readCookie("theme=dark; phm_session=abc.def; other=value", "phm_session"), "abc.def");
  assert.equal(readCookie("not_phm_session=abc", "phm_session"), undefined);
});
