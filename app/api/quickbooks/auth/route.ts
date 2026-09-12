import { NextRequest, NextResponse } from "next/server";
import { QBO_CONFIG } from "@/lib/quickbooks-client";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId") || process.env.QBO_CLIENT_ID;
  const redirectUri = searchParams.get("redirectUri") || `${request.nextUrl.origin}/api/quickbooks/callback`;

  if (!clientId) {
    return NextResponse.json(
      { success: false, error: "QuickBooks Client ID is required to generate auth URL." },
      { status: 400 }
    );
  }

  const authUrl = QBO_CONFIG.getAuthUrl(clientId, redirectUri);
  return NextResponse.json({ success: true, authUrl });
}
