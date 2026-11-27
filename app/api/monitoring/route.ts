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
      SELECT m.id::text AS id, m.asset_id AS "assetId",
             to_char(m.reading_date, 'YYYY-MM-DD') AS date, m.coupon_id AS "couponId",
             m.coupon_initial_g AS "couponInitialG", m.coupon_final_g AS "couponFinalG",
             m.exposure_days AS "exposureDays", m.inhibitor, m.injected_l AS "injectedL",
             m.injection_rate_lpd AS "injectionRateLpd", m.notes,
             m.source_system AS source
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
  const authorization = await requirePermission(request, "write_monitoring");
  if (!authorization.authorized) return authorization.response;
  try {
    const body = await request.json();
    const required = ["assetId", "date", "couponId", "couponInitialG", "couponFinalG", "exposureDays", "inhibitor", "injectedL", "injectionRateLpd"];
    if (required.some(key => body[key] === undefined || body[key] === null || body[key] === "")) {
      return NextResponse.json({ success: false, message: "Missing required monitoring fields." }, { status: 400 });
    }

    const date = String(body.date);
    const couponId = String(body.couponId).trim();
    const initial = Number(body.couponInitialG);
    const retrieved = Number(body.couponFinalG);
    const days = Number(body.exposureDays);
    const injected = Number(body.injectedL);
    const rate = Number(body.injectionRateLpd);
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date + "T00:00:00.000Z").toISOString().slice(0, 10) === date;
    if (!validDate) return NextResponse.json({ success: false, message: "Enter a valid reading date (YYYY-MM-DD)." }, { status: 400 });
    if (couponId.length < 1 || couponId.length > 30) return NextResponse.json({ success: false, message: "Coupon ID must contain 1–30 characters." }, { status: 400 });
    if (![initial, retrieved, days, injected, rate].every(Number.isFinite)) return NextResponse.json({ success: false, message: "Numeric fields must contain valid numbers." }, { status: 400 });
    if (initial <= 0 || retrieved < 0 || retrieved > initial) return NextResponse.json({ success: false, message: "Coupon weights are invalid. Retrieved weight must be between zero and the initial weight." }, { status: 400 });
    if (!Number.isInteger(days) || days < 1 || days > 365) return NextResponse.json({ success: false, message: "Exposure must be a whole number between 1 and 365 days." }, { status: 400 });
    if (injected < 0 || rate < 0) return NextResponse.json({ success: false, message: "Injection volume and rate cannot be negative." }, { status: 400 });

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
      FROM assets a WHERE a.asset_id = ${String(body.assetId)}
      RETURNING id::text AS id
    `;
    if (!rows.length) return NextResponse.json({ success: false, message: "Asset ID was not found." }, { status: 400 });
    return NextResponse.json({ success: true, id: rows[0].id }, { status: 201 });
  } catch (error) {
    console.error("Failed to save corrosion monitoring record:", error);
    const detail = error instanceof Error ? error.message : "";
    const duplicate = detail.includes("corrosion_monitoring_asset_date_coupon_key");
    return NextResponse.json({ success: false, message: duplicate ? "A reading already exists for this asset, date and coupon." : "Failed to save corrosion monitoring record." }, { status: duplicate ? 409 : 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const authorization = await requirePermission(request, "write_monitoring");
  if (!authorization.authorized) return authorization.response;
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
