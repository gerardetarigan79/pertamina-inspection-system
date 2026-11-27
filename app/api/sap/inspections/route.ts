import { NextResponse } from "next/server";
import { sapInspectionPayload, validWindow } from "../../../lib/mock-sources";
import { requirePermission } from "../../../lib/auth";

export const dynamic = "force-dynamic";

// Mock SAP PM endpoint: GET /api/sap/inspections?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function GET(request: Request) {
  const authorization = await requirePermission(request, "read_workspace");
  if (!authorization.authorized) return authorization.response;
  const params = new URL(request.url).searchParams;
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  if (!validWindow(from, to)) {
    return NextResponse.json({ error: "from/to must be valid ISO dates (YYYY-MM-DD), from <= to, max 400 days" }, { status: 400 });
  }
  await new Promise(resolve => setTimeout(resolve, 700)); // simulate source latency
  return NextResponse.json(sapInspectionPayload(from, to));
}
