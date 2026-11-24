import { NextRequest, NextResponse } from "next/server";
import { getSql } from "../../lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const sql = getSql();
    const from = request.nextUrl.searchParams.get("from");
    const department = request.nextUrl.searchParams.get("department");
    const rows = await sql`
      SELECT i.asset_id, i.inspection_date, i.tml_id, i.method,
             i.nominal_wt_mm, i.measured_wt_mm, i.corrosion_type,
             i.corrosion_depth_mm, i.corrosion_length_mm, i.corrosion_width_mm,
             i.notification_no, i.inspector_team, i.source_system
      FROM inspection_records i
      JOIN assets a ON a.asset_id = i.asset_id
      WHERE (${from}::date IS NULL OR i.inspection_date >= ${from}::date)
        AND (${department}::text IS NULL OR a.department = ${department})
      ORDER BY i.inspection_date DESC, i.asset_id, i.tml_id
    `;
    return NextResponse.json({ success: true, count: rows.length, records: rows });
  } catch (error) {
    console.error("Failed to retrieve inspection records:", error);
    return NextResponse.json({ success: false, message: "Failed to retrieve inspection records." }, { status: 500 });
  }
}
