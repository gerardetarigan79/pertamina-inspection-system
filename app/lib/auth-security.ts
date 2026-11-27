import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const AUTH_COOKIE_NAME = "phm_session";
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

export type SignedSessionPayload = {
  token: string;
  expiresAt: number;
  mustChangePassword: boolean;
};

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function hashRateLimitKey(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function createSignedSessionCookie(
  payload: SignedSessionPayload,
  secret: string,
): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifySessionCookie(
  value: string | undefined,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): SignedSessionPayload | null {
  if (!value || !secret) return null;

  const separator = value.lastIndexOf(".");
  if (separator <= 0 || separator === value.length - 1) return null;

  const encoded = value.slice(0, separator);
  const suppliedBytes = Buffer.from(value.slice(separator + 1));
  const expectedBytes = Buffer.from(createHmac("sha256", secret).update(encoded).digest("base64url"));

  if (suppliedBytes.length !== expectedBytes.length || !timingSafeEqual(suppliedBytes, expectedBytes)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<SignedSessionPayload>;
    if (
      typeof payload.token !== "string" ||
      !/^[A-Za-z0-9_-]{40,}$/.test(payload.token) ||
      typeof payload.expiresAt !== "number" ||
      !Number.isSafeInteger(payload.expiresAt) ||
      payload.expiresAt <= nowSeconds ||
      typeof payload.mustChangePassword !== "boolean"
    ) return null;

    return {
      token: payload.token,
      expiresAt: payload.expiresAt,
      mustChangePassword: payload.mustChangePassword,
    };
  } catch {
    return null;
  }
}

export function readCookie(cookieHeader: string | null, cookieName: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === cookieName) return part.slice(separator + 1).trim();
  }
  return undefined;
}
