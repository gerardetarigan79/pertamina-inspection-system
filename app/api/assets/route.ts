import { NextRequest, NextResponse } from "next/server";
import { getSql } from "../../lib/db";

export const dynamic = "force-dynamic";

const DEPARTMENTS = ["Pipeline", "Surface Facility"] as const;

export async function GET(request: NextRequest) {
  try {
    const sql = getSql();
    const department = request.nextUrl.searchParams.get("department");

    if (department && !DEPARTMENTS.includes(department as (typeof DEPARTMENTS)[number])) {
      return NextResponse.json(
        { success: false, message: "Invalid department filter." },
        { status: 400 },
      );
    }

    const assets = department
      ? await sql`
          SELECT
            asset_id,
            asset_name,
            asset_type,
            area,
            department,
            nominal_thickness,
            latest_thickness,
            operating_pressure,
            condition,
            last_inspection_date,
            is_sample
          FROM assets
          WHERE department = ${department}
          ORDER BY asset_id
        `
      : await sql`
          SELECT
            asset_id,
            asset_name,
            asset_type,
            area,
            department,
            nominal_thickness,
            latest_thickness,
            operating_pressure,
            condition,
            last_inspection_date,
            is_sample
          FROM assets
          ORDER BY asset_id
        `;

    return NextResponse.json({
      success: true,
      count: assets.length,
      data: assets,
    });
  } catch (error) {
    console.error("Failed to retrieve assets:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to retrieve assets",
      },
      { status: 500 },
    );
  }
}
