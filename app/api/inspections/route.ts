import { NextRequest, NextResponse } from "next/server";
import { getSql } from "../../lib/db";
import { requirePermission } from "../../lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authorization = await requirePermission(request, "read_workspace");
  if (!authorization.authorized) return authorization.response;
  try {
    const sql = getSql();
    const department = request.nextUrl.searchParams.get("department");
    const rows = await sql`
      SELECT i.asset_id AS "assetId",
             to_char(i.inspection_date, 'YYYY-MM-DD') AS date,
             i.tml_id AS tml, i.method, i.nominal_wt_mm AS "nominalMm",
             i.measured_wt_mm AS "measuredMm", i.corrosion_type AS "corrosionType",
             i.corrosion_depth_mm AS "depthMm", i.corrosion_length_mm AS "lengthMm",
             i.corrosion_width_mm AS "widthMm", i.notification_no AS notification,
             i.inspector_team AS team, i.source_system AS source
      FROM inspection_records i
      JOIN assets a ON a.asset_id = i.asset_id
      WHERE (${department}::text IS NULL OR a.department = ${department})
      ORDER BY i.inspection_date DESC, i.asset_id, i.tml_id
    `;
    return NextResponse.json({ success: true, count: rows.length, records: rows });
  } catch (error) {
    console.error("Failed to retrieve inspection records:", error);
    return NextResponse.json({ success: false, message: "Failed to retrieve inspection records." }, { status: 500 });
  }
}
