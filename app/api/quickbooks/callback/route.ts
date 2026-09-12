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

  // Parse state to check if client credentials were encrypted or passed
  let clientId = process.env.QBO_CLIENT_ID || "";
  let clientSecret = process.env.QBO_CLIENT_SECRET || "";
  let environment: "sandbox" | "production" = "production";

  if (state && state.startsWith("cfg_")) {
    try {
      const decoded = JSON.parse(Buffer.from(state.replace("cfg_", ""), "base64").toString("utf-8"));
      if (decoded.clientId) clientId = decoded.clientId;
      if (decoded.clientSecret) clientSecret = decoded.clientSecret;
      if (decoded.environment) environment = decoded.environment;
    } catch (e) {
      console.warn("Could not decode state param:", e);
    }
  }

  const redirectUri = `${baseUrl}/api/quickbooks/callback`;

  if (!clientId || !clientSecret) {
    // If server env vars aren't set, redirect with code & realmId for client to finish or display warning
    return NextResponse.redirect(
      `${baseUrl}/settings?qbo_code=${encodeURIComponent(code)}&qbo_realmid=${encodeURIComponent(
        realmId
      )}&qbo_pending=true`
    );
  }

  try {
    const tokens = await exchangeCodeForTokens(code, realmId, clientId, clientSecret, redirectUri);

    const redirectParams = new URLSearchParams({
      qbo_connected: "true",
      qbo_access_token: tokens.access_token,
      qbo_refresh_token: tokens.refresh_token,
      qbo_realm_id: tokens.realmId,
      qbo_expires_in: String(tokens.expires_in),
      qbo_environment: environment,
    });

    return NextResponse.redirect(`${baseUrl}/settings?${redirectParams.toString()}`);
  } catch (err: any) {
    return NextResponse.redirect(
      `${baseUrl}/settings?qbo_error=${encodeURIComponent(err.message || "Failed to exchange tokens")}`
    );
  }
}
