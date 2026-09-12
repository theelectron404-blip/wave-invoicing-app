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

  // Try parsing credentials if they were encoded in state
  let parsedClientId = process.env.QBO_CLIENT_ID;
  let parsedClientSecret = process.env.QBO_CLIENT_SECRET;
  let parsedEnv = (process.env.QBO_ENVIRONMENT as "sandbox" | "production") || "production";

  if (state && state.startsWith("cfg_")) {
    try {
      const stateData = JSON.parse(decodeURIComponent(state.replace("cfg_", "")));
      if (stateData.clientId) parsedClientId = stateData.clientId;
      if (stateData.clientSecret) parsedClientSecret = stateData.clientSecret;
      if (stateData.environment) parsedEnv = stateData.environment;
    } catch (_) {}
  }

  // Attempt server-side direct exchange if we have credentials
  if (parsedClientId && parsedClientSecret) {
    try {
      const redirectUri = `${baseUrl}/api/quickbooks/callback`;
      const tokens = await exchangeCodeForTokens(
        code,
        realmId,
        parsedClientId,
        parsedClientSecret,
        redirectUri
      );

      const redirectParams = new URLSearchParams({
        qbo_connected: "true",
        qbo_access_token: tokens.access_token,
        qbo_refresh_token: tokens.refresh_token,
        qbo_realm_id: tokens.realmId,
        qbo_expires_in: String(tokens.expires_in),
        qbo_environment: parsedEnv,
      });

      return NextResponse.redirect(`${baseUrl}/settings?${redirectParams.toString()}`);
    } catch (err: any) {
      console.error("Direct server exchange failed:", err);
      // If server exchange fails, fallback to client-side callback with error or code
      return NextResponse.redirect(
        `${baseUrl}/settings?qbo_code=${encodeURIComponent(code)}&qbo_realmid=${encodeURIComponent(
          realmId
        )}&qbo_pending=true`
      );
    }
  }

  // Fallback: redirect back with code & realmId for client-side exchange
  return NextResponse.redirect(
    `${baseUrl}/settings?qbo_code=${encodeURIComponent(code)}&qbo_realmid=${encodeURIComponent(
      realmId
    )}&qbo_pending=true`
  );
}
