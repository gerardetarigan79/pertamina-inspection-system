import { NextResponse } from "next/server";
import { getSql } from "../../lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
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