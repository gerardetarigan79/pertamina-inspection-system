import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import { getDatabaseUrl } from "../../../lib/env";
import { hashSessionToken } from "../../../lib/auth-security";
import { clearSessionCookie, getSignedSession } from "../../../lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let response = NextResponse.json({ success: true });
  try {
    const session = getSignedSession(request);
    if (session) {
      const sql = neon(getDatabaseUrl());
      await sql`DELETE FROM user_sessions WHERE token_hash = ${hashSessionToken(session.token)}`;
    }
  } catch (error) {
    console.error("Logout session cleanup failed:", error);
    response = NextResponse.json(
      { success: false, message: "The browser session was cleared, but the server could not revoke the session. Retry when the database is available." },
      { status: 503 },
    );
  }

  clearSessionCookie(response);
  return response;
}
