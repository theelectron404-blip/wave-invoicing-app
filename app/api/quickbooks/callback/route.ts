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

  // If server-side credentials are not set in process.env, redirect back with code & realmId for client exchange
  if (!process.env.QBO_CLIENT_ID || !process.env.QBO_CLIENT_SECRET) {
    return NextResponse.redirect(
      `${baseUrl}/settings?qbo_code=${encodeURIComponent(code)}&qbo_realmid=${encodeURIComponent(
        realmId
      )}&qbo_pending=true`
    );
  }

  try {
    const redirectUri = `${baseUrl}/api/quickbooks/callback`;
    const tokens = await exchangeCodeForTokens(
      code,
      realmId,
      process.env.QBO_CLIENT_ID,
      process.env.QBO_CLIENT_SECRET,
      redirectUri
    );

    const redirectParams = new URLSearchParams({
      qbo_connected: "true",
      qbo_access_token: tokens.access_token,
      qbo_refresh_token: tokens.refresh_token,
      qbo_realm_id: tokens.realmId,
      qbo_expires_in: String(tokens.expires_in),
      qbo_environment: (process.env.QBO_ENVIRONMENT as "sandbox" | "production") || "production",
    });

    return NextResponse.redirect(`${baseUrl}/settings?${redirectParams.toString()}`);
  } catch (err: any) {
    return NextResponse.redirect(
      `${baseUrl}/settings?qbo_code=${encodeURIComponent(code)}&qbo_realmid=${encodeURIComponent(
        realmId
      )}&qbo_pending=true`
    );
  }
}
