import { NextRequest, NextResponse } from "next/server";
import { getSql } from "../../lib/db";

export const dynamic = "force-dynamic";
const DEPARTMENTS = ["Pipeline", "Surface Facility"] as const;

export async function GET(request: NextRequest) {
  try {
    const department = request.nextUrl.searchParams.get("department");
    if (department && !DEPARTMENTS.includes(department as (typeof DEPARTMENTS)[number])) {
      return NextResponse.json({ success: false, message: "Invalid department filter." }, { status: 400 });
    }

    const sql = getSql();
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
      ORDER BY m.reading_date DESC, m.asset_id, m.coupon_id
    `;
    return NextResponse.json({ success: true, count: rows.length, records: rows });
  } catch (error) {
    console.error("Failed to retrieve corrosion monitoring records:", error);
    return NextResponse.json({ success: false, message: "Failed to retrieve corrosion monitoring records." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ success: false, message: "Monitoring payload must be an object." }, { status: 400 });
    }

    const payload = body as Record<string, unknown>;
    const assetId = typeof payload.assetId === "string" ? payload.assetId.trim() : "";
    const date = typeof payload.date === "string" ? payload.date : "";
    const couponId = typeof payload.couponId === "string" ? payload.couponId.trim() : "";
    const inhibitor = typeof payload.inhibitor === "string" ? payload.inhibitor.trim() : "";
    const notes = typeof payload.notes === "string" ? payload.notes.trim() : "";

    // Inhibitor name and notes are intentionally optional in the US-08 form.
    if (!assetId || !date || !couponId ||
      payload.couponInitialG === undefined || payload.couponInitialG === null || payload.couponInitialG === "" ||
      payload.couponFinalG === undefined || payload.couponFinalG === null || payload.couponFinalG === "" ||
      payload.exposureDays === undefined || payload.exposureDays === null || payload.exposureDays === "" ||
      payload.injectedL === undefined || payload.injectedL === null || payload.injectedL === "" ||
      payload.injectionRateLpd === undefined || payload.injectionRateLpd === null || payload.injectionRateLpd === "") {
      return NextResponse.json({ success: false, message: "Complete all required monitoring fields." }, { status: 400 });
    }

    const initial = Number(payload.couponInitialG);
    const retrieved = Number(payload.couponFinalG);
    const days = Number(payload.exposureDays);
    const injected = Number(payload.injectedL);
    const rate = Number(payload.injectionRateLpd);
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) &&
      new Date(date + "T00:00:00.000Z").toISOString().slice(0, 10) === date;

    if (assetId.length > 100) return NextResponse.json({ success: false, message: "Asset ID is too long." }, { status: 400 });
    if (!validDate) return NextResponse.json({ success: false, message: "Enter a valid reading date (YYYY-MM-DD)." }, { status: 400 });
    if (couponId.length < 1 || couponId.length > 30) return NextResponse.json({ success: false, message: "Coupon ID must contain 1–30 characters." }, { status: 400 });
    if (inhibitor.length > 60 || notes.length > 200) return NextResponse.json({ success: false, message: "Inhibitor name or notes exceed the allowed length." }, { status: 400 });
    if (![initial, retrieved, days, injected, rate].every(Number.isFinite)) return NextResponse.json({ success: false, message: "Numeric fields must contain valid numbers." }, { status: 400 });
    if (initial <= 0 || retrieved < 0 || retrieved > initial) return NextResponse.json({ success: false, message: "Coupon weights are invalid. Retrieved weight must be between zero and the initial weight." }, { status: 400 });
    if (!Number.isInteger(days) || days < 1 || days > 365) return NextResponse.json({ success: false, message: "Exposure must be a whole number between 1 and 365 days." }, { status: 400 });
    if (injected < 0 || rate < 0) return NextResponse.json({ success: false, message: "Injection volume and rate cannot be negative." }, { status: 400 });

    const sql = getSql();
    const rows = await sql`
      INSERT INTO corrosion_monitoring
        (asset_id, reading_date, coupon_id, coupon_initial_g, coupon_final_g,
         exposure_days, inhibitor, injected_l, injection_rate_lpd, notes, source_system)
      SELECT a.asset_id, ${date}::date, ${couponId},
             ${initial}, ${retrieved}, ${days}, ${inhibitor},
             ${injected}, ${rate}, ${notes}, 'Form'
      FROM assets a
      WHERE a.asset_id = ${assetId}
      RETURNING id::text AS id
    `;
    if (!rows.length) return NextResponse.json({ success: false, message: "Asset ID was not found in the asset register." }, { status: 400 });
    return NextResponse.json({ success: true, id: rows[0].id }, { status: 201 });
  } catch (error) {
    console.error("Failed to save corrosion monitoring record:", error);
    const detail = error instanceof Error ? error.message : "";
    const duplicate = detail.includes("corrosion_monitoring_asset_date_coupon_key");
    return NextResponse.json({ success: false, message: duplicate ? "A reading already exists for this asset, date and coupon." : "Failed to save monitoring record. Check the database connection and schema." }, { status: duplicate ? 409 : 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id || !/^\d+$/.test(id)) return NextResponse.json({ success: false, message: "A valid record ID is required." }, { status: 400 });
    const sql = getSql();
    // Never allow this operational form to delete records labelled as samples.
    const rows = await sql`DELETE FROM corrosion_monitoring WHERE id = ${id}::bigint AND is_sample = FALSE RETURNING id`;
    if (!rows.length) return NextResponse.json({ success: false, message: "Operational monitoring record was not found." }, { status: 404 });
    return NextResponse.json({ success: true, deleted: true });
  } catch (error) {
    console.error("Failed to delete corrosion monitoring record:", error);
    return NextResponse.json({ success: false, message: "Failed to delete monitoring record." }, { status: 500 });
  }
}
