import { NextRequest, NextResponse } from "next/server";
import { getSql } from "../../lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT p.id::text AS id, p.asset_id AS "assetId",
             to_char(p.inspection_date, 'YYYY-MM-DD') AS date,
             p.method, p.measured_thickness_mm AS "thicknessMm",
             p.operating_pressure_bar AS "pressureBar", p.inspector,
             p.remarks, p.source_system AS source
      FROM pipeline_inspections p
      ORDER BY p.inspection_date DESC, p.asset_id
    `;
    return NextResponse.json({ success: true, count: rows.length, records: rows });
  } catch (error) {
    console.error("Failed to retrieve pipeline inspections:", error);
    return NextResponse.json({ success: false, message: "Failed to retrieve pipeline inspections." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!Array.isArray(body.records) || body.records.length === 0) {
      return NextResponse.json({ success: false, message: "No valid inspection records were supplied." }, { status: 400 });
    }
    const sql = getSql();
    let imported = 0;
    for (const record of body.records) {
      if (!record.assetId || !record.inspectionDate || !record.method || !Number.isFinite(Number(record.thicknessMm)) || !record.inspector) continue;
      const rows = await sql`
        INSERT INTO pipeline_inspections
          (asset_id, inspection_date, method, measured_thickness_mm,
           operating_pressure_bar, inspector, remarks, source_system, is_sample)
        SELECT a.asset_id, ${record.inspectionDate}::date, ${record.method},
               ${Number(record.thicknessMm)}, ${record.pressureBar === null ? null : Number(record.pressureBar)},
               ${String(record.inspector)}, ${String(record.remarks ?? "")}, 'Pipeline CSV', FALSE
        FROM assets a WHERE a.asset_id = ${String(record.assetId)}
        ON CONFLICT (asset_id, inspection_date, method, measured_thickness_mm)
        DO UPDATE SET operating_pressure_bar = EXCLUDED.operating_pressure_bar,
                      inspector = EXCLUDED.inspector, remarks = EXCLUDED.remarks,
                      source_system = EXCLUDED.source_system, is_sample = FALSE
        RETURNING id
      `;
      if (rows.length) imported++;
    }
    return NextResponse.json({ success: true, imported }, { status: 201 });
  } catch (error) {
    console.error("Failed to import pipeline inspections:", error);
    return NextResponse.json({ success: false, message: "Failed to import pipeline inspections." }, { status: 500 });
  }
}
