import { NextResponse } from "next/server";
import { getSql } from "../../lib/db";
import { requirePermission } from "../../lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authorization = await requirePermission(request, "view_system_health");
  if (!authorization.authorized) return authorization.response;
  try {
    const sql = getSql();
    const result = await sql`
      SELECT
        current_database() AS database_name,
        NOW() AS database_time
    `;

    return NextResponse.json({
      success: true,
      data: result[0],
    });
  } catch (error) {
    console.error("Database connection failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Database connection failed",
      },
      { status: 500 }
    );
  }
}