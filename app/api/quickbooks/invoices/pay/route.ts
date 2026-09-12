import { NextRequest, NextResponse } from "next/server";
import { qboApiRequest } from "@/lib/quickbooks-client";

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
    const { invoiceId, customerId, amount } = body;

    if (!invoiceId) {
      return NextResponse.json(
        { success: false, error: "invoiceId is required." },
        { status: 400 }
      );
    }

    // 1. Fetch invoice to get customer & balance if not provided
    let finalCustomerId = customerId;
    let finalAmount = amount;

    if (!finalCustomerId || !finalAmount) {
      const invData = await qboApiRequest<any>(`/invoice/${invoiceId}`, {
        realmId,
        accessToken,
        environment,
      });
      const invoice = invData?.Invoice;
      if (invoice) {
        finalCustomerId = finalCustomerId || invoice.CustomerRef?.value;
        finalAmount = finalAmount || invoice.Balance || invoice.TotalAmt;
      }
    }

    const paymentPayload = {
      CustomerRef: { value: finalCustomerId },
      TotalAmt: Number(finalAmount),
      Line: [
        {
          Amount: Number(finalAmount),
          LinkedTxn: [
            {
              TxnId: invoiceId,
              TxnType: "Invoice",
            },
          ],
        },
      ],
    };

    const data = await qboApiRequest<any>("/payment", {
      method: "POST",
      body: paymentPayload,
      realmId,
      accessToken,
      environment,
    });

    return NextResponse.json({
      success: true,
      payment: data?.Payment,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to record payment in QuickBooks" },
      { status: error.status || error.statusCode || 500 }
    );
  }
}
