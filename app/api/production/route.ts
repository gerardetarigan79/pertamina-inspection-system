import { NextRequest, NextResponse } from "next/server";
import { getSql } from "../../lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const sql = getSql();
    const from = request.nextUrl.searchParams.get("from");
    const department = request.nextUrl.searchParams.get("department");
    const rows = await sql`
      SELECT p.asset_id, p.reading_date, p.pressure_bar, p.temperature_c,
             p.gas_mmscfd, p.water_bwpd, p.oil_bopd, p.source_system
      FROM production_readings p
      JOIN assets a ON a.asset_id = p.asset_id
      WHERE (${from}::date IS NULL OR p.reading_date >= ${from}::date)
        AND (${department}::text IS NULL OR a.department = ${department})
      ORDER BY p.reading_date DESC, p.asset_id
    `;
    return NextResponse.json({ success: true, count: rows.length, records: rows });
  } catch (error) {
    console.error("Failed to retrieve production readings:", error);
    return NextResponse.json({ success: false, message: "Failed to retrieve production readings." }, { status: 500 });
  }
}
