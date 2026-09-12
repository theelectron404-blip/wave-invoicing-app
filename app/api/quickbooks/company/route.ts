import { NextRequest, NextResponse } from "next/server";
import { qboApiRequest } from "@/lib/quickbooks-client";

export async function GET(request: NextRequest) {
  try {
    const realmId = request.headers.get("x-qbo-realm-id") || process.env.QBO_REALM_ID;
    const accessToken = request.headers.get("x-qbo-access-token") || process.env.QBO_ACCESS_TOKEN;
    const environment =
      (request.headers.get("x-qbo-environment") as "sandbox" | "production") ||
      (process.env.QBO_ENVIRONMENT as "sandbox" | "production") ||
      "production";

    if (!realmId || !accessToken) {
      return NextResponse.json(
        { success: false, error: "QuickBooks realmId or accessToken is missing." },
        { status: 401 }
      );
    }

    const data = await qboApiRequest<any>(`/companyinfo/${realmId}`, {
      realmId,
      accessToken,
      environment,
    });

    const companyInfo = data?.CompanyInfo;

    return NextResponse.json({
      success: true,
      business: {
        id: realmId,
        name: companyInfo?.CompanyName || "QuickBooks Company",
        legalName: companyInfo?.LegalName,
        email: companyInfo?.Email?.Address,
        currency: {
          code: companyInfo?.Country === "US" ? "USD" : companyInfo?.Country || "USD",
          symbol: "$",
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch QuickBooks company info" },
      { status: 500 }
    );
  }
}
