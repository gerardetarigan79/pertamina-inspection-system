import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import { getDatabaseUrl } from "../../../../lib/env";
import { hashSessionToken } from "../../../../lib/auth-security";
import { clearSessionCookie, getSignedSession } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const response = NextResponse.json({ success: true });
  try {
    const session = getSignedSession(request);
    if (session) {
      const sql = neon(getDatabaseUrl());
      await sql`DELETE FROM user_sessions WHERE token_hash = ${hashSessionToken(session.token)}`;
    }
  } catch (error) {
    // Clear the browser cookie even when the database is temporarily unavailable.
    console.error("Logout session cleanup failed:", error);
  }

  clearSessionCookie(response);
  return response;
}
