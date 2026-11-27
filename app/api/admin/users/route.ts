import bcrypt from "bcryptjs";
import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import { requirePermission } from "../../../../lib/auth";
import { getDatabaseUrl } from "../../../../lib/env";
import { parseCreateUserInput } from "../../../../lib/auth-validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authorization = await requirePermission(request, "manage_users");
  if (!authorization.authorized) return authorization.response;

  try {
    const sql = neon(getDatabaseUrl());
    const users = await sql`
      SELECT id::text AS id,
             name,
             email,
             role,
             is_active AS "isActive",
             must_change_password AS "mustChangePassword",
             created_at AS "createdAt",
             updated_at AS "updatedAt"
      FROM users
      ORDER BY created_at DESC, name ASC
    `;
    return NextResponse.json({ success: true, users });
  } catch (error) {
    console.error("Unable to list user accounts:", error);
    return NextResponse.json({ success: false, message: "Unable to load user accounts." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authorization = await requirePermission(request, "manage_users");
  if (!authorization.authorized) return authorization.response;

  try {
    const body = await request.json().catch(() => null);
    const input = parseCreateUserInput(body);
    if (!input) {
      return NextResponse.json(
        { success: false, message: "Periksa nama, email, peran, dan kata sandi sementara (minimal 12 karakter)." },
        { status: 400 },
      );
    }

    const passwordHash = await bcrypt.hash(input.temporaryPassword, 12);
    const sql = neon(getDatabaseUrl());
    const rows = await sql`
      INSERT INTO users
        (name, email, password_hash, role, is_active, must_change_password, created_by, updated_by)
      VALUES (
        ${input.name},
        ${input.email},
        ${passwordHash},
        ${input.role},
        TRUE,
        ${input.mustChangePassword},
        ${authorization.user.id}::uuid,
        ${authorization.user.id}::uuid
      )
      ON CONFLICT DO NOTHING
      RETURNING id::text AS id, name, email, role,
                is_active AS "isActive",
                must_change_password AS "mustChangePassword",
                created_at AS "createdAt"
    `;

    if (rows.length === 0) {
      return NextResponse.json({ success: false, message: "Email tersebut sudah digunakan." }, { status: 409 });
    }

    return NextResponse.json({ success: true, user: rows[0] }, { status: 201 });
  } catch (error) {
    console.error("Unable to create user account:", error);
    return NextResponse.json({ success: false, message: "Unable to create user account." }, { status: 500 });
  }
}
