import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** SAP PM is an external integration and must not be simulated with sample records. */
export async function GET() {
  return NextResponse.json(
    {
      success: false,
      message: "SAP PM integration is not configured. No records were generated or imported.",
    },
    { status: 501 },
  );
}
