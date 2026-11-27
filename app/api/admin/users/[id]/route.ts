import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import { requirePermission } from "../../../../lib/auth";
import { getDatabaseUrl } from "../../../../lib/env";
import { parseUpdateUserInput } from "../../../../lib/auth-validation";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const authorization = await requirePermission(request, "manage_users");
  if (!authorization.authorized) return authorization.response;

  const userId = new URL(request.url).pathname.split("/").filter(Boolean).at(-1) ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    return NextResponse.json({ success: false, message: "User ID tidak valid." }, { status: 400 });
  }

  try {
    const body = await request.json().catch(() => null);
    const input = parseUpdateUserInput(body);
    if (!input) {
      return NextResponse.json({ success: false, message: "Tidak ada perubahan akun yang valid." }, { status: 400 });
    }

    const sql = neon(getDatabaseUrl());
    // Serialize admin role/deactivation changes and evaluate the last-admin
    // constraint after acquiring the lock in this same transaction.
    const results = await sql.transaction([
      sql`SELECT pg_advisory_xact_lock(78123456)`,
      sql`
        WITH active_admins AS MATERIALIZED (
          SELECT COUNT(*)::int AS total
          FROM users
          WHERE role = 'admin' AND is_active = TRUE
        ),
        updated AS (
          UPDATE users AS u
          SET role = COALESCE(${input.role ?? null}, u.role),
              is_active = COALESCE(${input.isActive ?? null}, u.is_active),
              updated_at = NOW(),
              updated_by = ${authorization.user.id}::uuid
          WHERE u.id = ${userId}::uuid
            AND (
              u.role <> 'admin'
              OR u.is_active = FALSE
              OR (
                COALESCE(${input.role ?? null}, u.role) = 'admin'
                AND COALESCE(${input.isActive ?? null}, u.is_active) = TRUE
              )
              OR (SELECT total FROM active_admins) > 1
            )
          RETURNING u.id, u.name, u.email, u.role,
                    u.is_active AS "isActive",
                    u.must_change_password AS "mustChangePassword",
                    u.updated_at AS "updatedAt"
        ),
        revoked AS (
          DELETE FROM user_sessions AS sessions
          USING updated
          WHERE sessions.user_id = updated.id
            AND updated."isActive" = FALSE
          RETURNING sessions.id
        )
        SELECT updated.*,
               (SELECT COUNT(*)::int FROM revoked) AS "revokedSessions"
        FROM updated
      `,
    ], { isolationLevel: "ReadCommitted" });

    const rows = results[1] as Array<Record<string, unknown>>;
    if (rows.length === 0) {
      const existing = await sql`SELECT id FROM users WHERE id = ${userId}::uuid LIMIT 1`;
      if (existing.length === 0) {
        return NextResponse.json({ success: false, message: "User tidak ditemukan." }, { status: 404 });
      }
      return NextResponse.json(
        { success: false, code: "LAST_ACTIVE_ADMIN", message: "Tidak dapat menonaktifkan atau menurunkan peran admin aktif terakhir." },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true, user: rows[0] });
  } catch (error) {
    console.error("Unable to update user account:", error);
    return NextResponse.json({ success: false, message: "Unable to update user account." }, { status: 500 });
  }
}
