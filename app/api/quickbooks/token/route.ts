import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, refreshQBOToken } from "@/lib/quickbooks-client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, code, realmId, refreshToken, clientId, clientSecret, redirectUri } = body;

    const finalClientId = clientId || process.env.QBO_CLIENT_ID;
    const finalClientSecret = clientSecret || process.env.QBO_CLIENT_SECRET;

    if (!finalClientId || !finalClientSecret) {
      return NextResponse.json(
        { success: false, error: "Client ID and Client Secret are required." },
        { status: 400 }
      );
    }

    if (action === "exchange") {
      if (!code || !realmId) {
        return NextResponse.json(
          { success: false, error: "code and realmId are required for token exchange." },
          { status: 400 }
        );
      }

      const finalRedirectUri = redirectUri || `${request.nextUrl.origin}/api/quickbooks/callback`;
      const tokens = await exchangeCodeForTokens(
        code,
        realmId,
        finalClientId,
        finalClientSecret,
        finalRedirectUri
      );

      return NextResponse.json({ success: true, tokens });
    }

    if (action === "refresh") {
      if (!refreshToken) {
        return NextResponse.json(
          { success: false, error: "refreshToken is required to refresh token." },
          { status: 400 }
        );
      }

      const refreshed = await refreshQBOToken(refreshToken, finalClientId, finalClientSecret);
      return NextResponse.json({ success: true, tokens: refreshed });
    }

    return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Token operation failed." },
      { status: 500 }
    );
  }
}
