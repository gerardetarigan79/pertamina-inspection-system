import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import { getAuthSecret, getDatabaseUrl } from "./env";
import {
  AUTH_COOKIE_NAME,
  createSignedSessionCookie,
  hashSessionToken,
  readCookie,
  verifySessionCookie,
} from "./auth-security";
import { rolesForPermission, type Permission, type Role } from "./permissions";

export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  mustChangePassword: boolean;
};

export type AuthorizationResult =
  | { authorized: true; user: AuthenticatedUser }
  | { authorized: false; response: NextResponse };

export function setSessionCookie(
  response: NextResponse,
  token: string,
  expiresAt: number,
  mustChangePassword: boolean,
): void {
  const maxAge = Math.max(0, expiresAt - Math.floor(Date.now() / 1000));
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: createSignedSessionCookie({ token, expiresAt, mustChangePassword }, getAuthSecret()),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
    expires: new Date(expiresAt * 1000),
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
}

export function getSignedSession(request: Request) {
  const cookie = readCookie(request.headers.get("cookie"), AUTH_COOKIE_NAME);
  return verifySessionCookie(cookie, getAuthSecret());
}

export async function getAuthenticatedUser(request: Request): Promise<AuthenticatedUser | null> {
  const session = getSignedSession(request);
  if (!session) return null;

  const sql = neon(getDatabaseUrl());
  const tokenHash = hashSessionToken(session.token);
  const rows = await sql`
    SELECT u.id::text AS id,
           u.name,
           u.email,
           u.role,
           u.must_change_password AS "mustChangePassword"
    FROM user_sessions s
    INNER JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${tokenHash}
      AND s.expires_at > NOW()
      AND u.is_active = TRUE
    LIMIT 1
  `;

  if (rows.length === 0) return null;
  const row = rows[0];

  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    role: row.role as Role,
    mustChangePassword: Boolean(row.mustChangePassword),
  };
}

export async function requireRole(
  request: Request,
  allowedRoles: readonly Role[],
  authenticate: (request: Request) => Promise<AuthenticatedUser | null> = getAuthenticatedUser,
): Promise<AuthorizationResult> {
  try {
    const user = await authenticate(request);
    if (!user) {
      return {
        authorized: false,
        response: NextResponse.json(
          { success: false, message: "Authentication required." },
          { status: 401 },
        ),
      };
    }

    if (user.mustChangePassword) {
      return {
        authorized: false,
        response: NextResponse.json(
          {
            success: false,
            code: "PASSWORD_CHANGE_REQUIRED",
            message: "Change your temporary password before continuing.",
          },
          { status: 403 },
        ),
      };
    }

    if (!allowedRoles.includes(user.role)) {
      return {
        authorized: false,
        response: NextResponse.json(
          { success: false, message: "You do not have permission to perform this action." },
          { status: 403 },
        ),
      };
    }

    return { authorized: true, user };
  } catch (error) {
    console.error("Authorization check failed:", error);
    return {
      authorized: false,
      response: NextResponse.json(
        { success: false, message: "Unable to verify the session. Please try again." },
        { status: 503 },
      ),
    };
  }
}

export async function requirePermission(
  request: Request,
  permission: Permission,
  authenticate: (request: Request) => Promise<AuthenticatedUser | null> = getAuthenticatedUser,
): Promise<AuthorizationResult> {
  return requireRole(request, rolesForPermission(permission), authenticate);
}
