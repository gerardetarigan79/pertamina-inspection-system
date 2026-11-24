import { NextRequest, NextResponse } from "next/server";
import { getSql } from "../../lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const sql = getSql();
    const department = request.nextUrl.searchParams.get("department");
    const rows = await sql`
      SELECT p.asset_id AS "assetId",
             to_char(p.reading_date, 'YYYY-MM-DD') AS date,
             p.pressure_bar AS pressure, p.temperature_c AS temperature,
             p.gas_mmscfd AS gas, p.water_bwpd AS water, p.oil_bopd AS oil,
             p.source_system AS source
      FROM production_readings p
      JOIN assets a ON a.asset_id = p.asset_id
      WHERE (${department}::text IS NULL OR a.department = ${department})
      ORDER BY p.reading_date DESC, p.asset_id
    `;
    return NextResponse.json({ success: true, count: rows.length, records: rows });
  } catch (error) {
    console.error("Failed to retrieve production readings:", error);
    return NextResponse.json({ success: false, message: "Failed to retrieve production readings." }, { status: 500 });
  }
}
