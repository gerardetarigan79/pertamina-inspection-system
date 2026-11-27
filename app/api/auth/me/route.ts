import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "../../../lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ success: false, message: "Authentication required." }, { status: 401 });
    }
    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error("Session lookup failed:", error);
    return NextResponse.json({ success: false, message: "Unable to verify the session." }, { status: 503 });
  }
}
