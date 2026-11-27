import bcrypt from "bcryptjs";
import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import { getDatabaseUrl } from "../../../../lib/env";
import { hashSessionToken } from "../../../../lib/auth-security";
import { getAuthenticatedUser, getSignedSession, requireRole, setSessionCookie } from "../../../../lib/auth";
import { isValidNewPassword } from "../../../../lib/auth-validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authorization = await requireRole(request, ["admin", "inspector", "viewer"]);
  if (!authorization.authorized) {
    // A forced-password-change session is intentionally allowed through this endpoint.
    if (authorization.response.status !== 403 ||
        (await getAuthenticatedUser(request)) === null) return authorization.response;
  }

  try {
    const user = await getAuthenticatedUser(request);
    const session = getSignedSession(request);
    if (!user || !session) {
      return NextResponse.json({ success: false, message: "Authentication required." }, { status: 401 });
    }

    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = body?.newPassword;
    if (!currentPassword || !isValidNewPassword(newPassword)) {
      return NextResponse.json(
        { success: false, message: "Kata sandi baru harus minimal 12 karakter dan maksimal 72 byte." },
        { status: 400 },
      );
    }

    const sql = neon(getDatabaseUrl());
    const rows = await sql`SELECT password_hash AS "passwordHash" FROM users WHERE id = ${user.id}::uuid LIMIT 1`;
    if (!rows[0] || !(await bcrypt.compare(currentPassword, rows[0].passwordHash))) {
      return NextResponse.json({ success: false, message: "Kata sandi saat ini tidak benar." }, { status: 400 });
    }
    if (await bcrypt.compare(newPassword, rows[0].passwordHash)) {
      return NextResponse.json({ success: false, message: "Gunakan kata sandi baru yang berbeda." }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await sql`
      UPDATE users
      SET password_hash = ${passwordHash},
          must_change_password = FALSE,
          failed_login_attempts = 0,
          locked_until = NULL,
          updated_at = NOW(),
          updated_by = ${user.id}::uuid
      WHERE id = ${user.id}::uuid
    `;
    await sql`
      DELETE FROM user_sessions
      WHERE user_id = ${user.id}::uuid
        AND token_hash <> ${hashSessionToken(session.token)}
    `;

    const response = NextResponse.json({ success: true });
    setSessionCookie(response, session.token, session.expiresAt, false);
    return response;
  } catch (error) {
    console.error("Password change failed:", error);
    return NextResponse.json({ success: false, message: "Tidak dapat memperbarui kata sandi sekarang." }, { status: 500 });
  }
}
