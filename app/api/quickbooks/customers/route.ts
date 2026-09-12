import { NextRequest, NextResponse } from "next/server";
import { qboApiRequest } from "@/lib/quickbooks-client";

export async function GET(request: NextRequest) {
  try {
    const realmId = request.headers.get("x-qbo-realm-id") || process.env.QBO_REALM_ID;
    const accessToken = request.headers.get("x-qbo-access-token") || process.env.QBO_ACCESS_TOKEN;
    const environment =
      (request.headers.get("x-qbo-environment") as "sandbox" | "production") || "production";

    if (!realmId || !accessToken) {
      return NextResponse.json(
        { success: false, error: "QuickBooks realmId or accessToken is missing." },
        { status: 401 }
      );
    }

    const query = encodeURIComponent("select * from Customer where Active = true maxresults 100");
    const data = await qboApiRequest<any>(`/query?query=${query}`, {
      realmId,
      accessToken,
      environment,
    });

    const customers = (data?.QueryResponse?.Customer || []).map((c: any) => ({
      id: c.Id,
      name: c.DisplayName || `${c.GivenName || ""} ${c.FamilyName || ""}`.trim() || c.CompanyName,
      email: c.PrimaryEmailAddr?.Address || "",
      currency: {
        code: c.CurrencyRef?.value || "USD",
      },
    }));

    return NextResponse.json({ success: true, customers });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch QuickBooks customers" },
      { status: error.status || error.statusCode || 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const realmId = request.headers.get("x-qbo-realm-id") || process.env.QBO_REALM_ID;
    const accessToken = request.headers.get("x-qbo-access-token") || process.env.QBO_ACCESS_TOKEN;
    const environment =
      (request.headers.get("x-qbo-environment") as "sandbox" | "production") || "production";

    if (!realmId || !accessToken) {
      return NextResponse.json(
        { success: false, error: "QuickBooks credentials missing." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, email, phone } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: "Name is required" }, { status: 400 });
    }

    // Check if customer already exists
    const cleanName = name.replace(/'/g, "\\'");
    const query = encodeURIComponent(`select * from Customer where DisplayName = '${cleanName}'`);
    try {
      const existingData = await qboApiRequest<any>(`/query?query=${query}`, {
        realmId,
        accessToken,
        environment,
      });

      if (existingData?.QueryResponse?.Customer?.length > 0) {
        const existing = existingData.QueryResponse.Customer[0];
        return NextResponse.json({
          success: true,
          customer: {
            id: existing.Id,
            name: existing.DisplayName,
            email: existing.PrimaryEmailAddr?.Address || "",
          },
        });
      }
    } catch (e) {
      console.warn("Could not check existing QBO customer:", e);
    }

    const customerPayload: any = {
      DisplayName: name,
    };
    if (email) {
      customerPayload.PrimaryEmailAddr = { Address: email };
    }
    if (phone) {
      customerPayload.PrimaryPhone = { FreeFormNumber: phone };
    }

    const data = await qboApiRequest<any>("/customer", {
      method: "POST",
      body: customerPayload,
      realmId,
      accessToken,
      environment,
    });

    const created = data?.Customer;

    return NextResponse.json({
      success: true,
      customer: {
        id: created.Id,
        name: created.DisplayName,
        email: created.PrimaryEmailAddr?.Address || "",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create customer in QuickBooks" },
      { status: error.status || error.statusCode || 500 }
    );
  }
}
