import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/quickbooks-client";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const realmId = searchParams.get("realmId");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const baseUrl = request.nextUrl.origin;

  if (error) {
    return NextResponse.redirect(`${baseUrl}/settings?qbo_error=${encodeURIComponent(error)}`);
  }

  if (!code || !realmId) {
    return NextResponse.redirect(
      `${baseUrl}/settings?qbo_error=${encodeURIComponent("Missing authorization code or realmId")}`
    );
  }

  // Always redirect back to settings with code & realmId for secure client-initiated token exchange
  return NextResponse.redirect(
    `${baseUrl}/settings?qbo_code=${encodeURIComponent(code)}&qbo_realmid=${encodeURIComponent(
      realmId
    )}&qbo_pending=true`
  );
}
