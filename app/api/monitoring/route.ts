import { NextRequest, NextResponse } from "next/server";
import { getSql } from "../../lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const sql = getSql();
    const department = request.nextUrl.searchParams.get("department");
    const rows = await sql`
      SELECT m.id::text AS id, m.asset_id, m.reading_date, m.coupon_id,
             m.coupon_initial_g, m.coupon_final_g, m.exposure_days, m.inhibitor,
             m.injected_l, m.injection_rate_lpd, m.notes, m.source_system
      FROM corrosion_monitoring m
      JOIN assets a ON a.asset_id = m.asset_id
      WHERE (${department}::text IS NULL OR a.department = ${department})
      ORDER BY m.reading_date DESC, m.asset_id
    `;
    return NextResponse.json({ success: true, count: rows.length, records: rows });
  } catch (error) {
    console.error("Failed to retrieve corrosion monitoring records:", error);
    return NextResponse.json({ success: false, message: "Failed to retrieve corrosion monitoring records." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const required = ["assetId", "date", "couponId", "couponInitialG", "couponFinalG", "exposureDays", "inhibitor", "injectedL", "injectionRateLpd"];
    if (required.some(key => body[key] === undefined || body[key] === null || body[key] === "")) {
      return NextResponse.json({ success: false, message: "Missing required monitoring fields." }, { status: 400 });
    }
    const sql = getSql();
    const rows = await sql`
      INSERT INTO corrosion_monitoring
        (asset_id, reading_date, coupon_id, coupon_initial_g, coupon_final_g,
         exposure_days, inhibitor, injected_l, injection_rate_lpd, notes, source_system)
      SELECT a.asset_id, ${body.date}::date, ${String(body.couponId).trim()},
             ${Number(body.couponInitialG)}, ${Number(body.couponFinalG)},
             ${Number(body.exposureDays)}, ${String(body.inhibitor ?? "")},
             ${Number(body.injectedL)}, ${Number(body.injectionRateLpd)},
             ${String(body.notes ?? "")}, 'Form'
      FROM assets a
      WHERE a.asset_id = ${String(body.assetId)}
      RETURNING id::text AS id
    `;
    if (!rows.length) return NextResponse.json({ success: false, message: "Asset ID was not found." }, { status: 400 });
    return NextResponse.json({ success: true, id: rows[0].id }, { status: 201 });
  } catch (error) {
    console.error("Failed to save corrosion monitoring record:", error);
    const message = error instanceof Error && error.message.includes("corrosion_monitoring_asset_date_coupon_key")
      ? "A reading already exists for this asset, date and coupon."
      : "Failed to save corrosion monitoring record.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id || !/^\d+$/.test(id)) return NextResponse.json({ success: false, message: "A valid record ID is required." }, { status: 400 });
    const sql = getSql();
    const rows = await sql`DELETE FROM corrosion_monitoring WHERE id = ${id}::bigint RETURNING id`;
    return NextResponse.json({ success: true, deleted: rows.length === 1 });
  } catch (error) {
    console.error("Failed to delete corrosion monitoring record:", error);
    return NextResponse.json({ success: false, message: "Failed to delete corrosion monitoring record." }, { status: 500 });
  }
}
