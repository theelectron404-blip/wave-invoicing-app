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
        { success: false, error: "QuickBooks credentials missing." },
        { status: 401 }
      );
    }

    const query = encodeURIComponent("select * from Item where Active = true maxresults 100");
    const data = await qboApiRequest<any>(`/query?query=${query}`, {
      realmId,
      accessToken,
      environment,
    });

    const items = (data?.QueryResponse?.Item || []).map((item: any) => ({
      id: item.Id,
      name: item.Name,
      unitPrice: item.UnitPrice || 0,
      description: item.Description || "",
    }));

    return NextResponse.json({ success: true, items });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch QuickBooks items" },
      { status: 500 }
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
    const { name, unitPrice, description, incomeAccountId } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: "Item name is required" }, { status: 400 });
    }

    // Check if item already exists
    const cleanName = name.replace(/'/g, "\\'");
    const query = encodeURIComponent(`select * from Item where Name = '${cleanName}'`);
    try {
      const existingData = await qboApiRequest<any>(`/query?query=${query}`, {
        realmId,
        accessToken,
        environment,
      });

      if (existingData?.QueryResponse?.Item?.length > 0) {
        const existing = existingData.QueryResponse.Item[0];
        return NextResponse.json({
          success: true,
          item: {
            id: existing.Id,
            name: existing.Name,
            unitPrice: existing.UnitPrice || 0,
            description: existing.Description || "",
          },
        });
      }
    } catch (e) {
      console.warn("Could not check existing QBO item:", e);
    }

    // Find default income account if not provided
    let finalIncomeAccountId = incomeAccountId;
    if (!finalIncomeAccountId) {
      try {
        const accQuery = encodeURIComponent(
          "select * from Account where AccountType = 'Income' maxresults 1"
        );
        const accData = await qboApiRequest<any>(`/query?query=${accQuery}`, {
          realmId,
          accessToken,
          environment,
        });
        if (accData?.QueryResponse?.Account?.length > 0) {
          finalIncomeAccountId = accData.QueryResponse.Account[0].Id;
        }
      } catch (e) {
        console.warn("Could not query default income account:", e);
      }
    }

    const itemPayload: any = {
      Name: name.substring(0, 100),
      Type: "Service",
      UnitPrice: Number(unitPrice) || 0,
      Description: description || name,
    };

    if (finalIncomeAccountId) {
      itemPayload.IncomeAccountRef = { value: finalIncomeAccountId };
    }

    const data = await qboApiRequest<any>("/item", {
      method: "POST",
      body: itemPayload,
      realmId,
      accessToken,
      environment,
    });

    const created = data?.Item;

    return NextResponse.json({
      success: true,
      item: {
        id: created.Id,
        name: created.Name,
        unitPrice: created.UnitPrice || 0,
        description: created.Description || "",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create item in QuickBooks" },
      { status: 500 }
    );
  }
}
