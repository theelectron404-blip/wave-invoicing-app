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

  // Parse state to check if client credentials were passed
  let clientId = process.env.QBO_CLIENT_ID || "";
  let clientSecret = process.env.QBO_CLIENT_SECRET || "";
  let environment: "sandbox" | "production" = "production";

  if (state && state.startsWith("cfg_")) {
    const rawState = state.replace("cfg_", "");
    try {
      // Try URL-decoded JSON first
      const decodedJson = decodeURIComponent(rawState);
      const parsed = JSON.parse(decodedJson);
      if (parsed.clientId) clientId = parsed.clientId;
      if (parsed.clientSecret) clientSecret = parsed.clientSecret;
      if (parsed.environment) environment = parsed.environment;
    } catch (e) {
      try {
        // Fallback: base64
        const decodedB64 = Buffer.from(rawState, "base64").toString("utf-8");
        const parsed = JSON.parse(decodedB64);
        if (parsed.clientId) clientId = parsed.clientId;
        if (parsed.clientSecret) clientSecret = parsed.clientSecret;
        if (parsed.environment) environment = parsed.environment;
      } catch (err) {
        console.warn("Could not decode state param:", err);
      }
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
