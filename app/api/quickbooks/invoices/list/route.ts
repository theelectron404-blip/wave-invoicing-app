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

    const { searchParams } = new URL(request.url);
    const maxResults = searchParams.get("pageSize") || "50";

    const query = encodeURIComponent(`select * from Invoice order by MetaData.CreateTime desc maxresults ${maxResults}`);
    const data = await qboApiRequest<any>(`/query?query=${query}`, {
      realmId,
      accessToken,
      environment,
    });

    const invoices = (data?.QueryResponse?.Invoice || []).map((inv: any) => ({
      id: inv.Id,
      invoiceNumber: inv.DocNumber || `INV-${inv.Id}`,
      status: inv.Balance === 0 ? "PAID" : inv.EmailStatus === "EmailSent" ? "SENT" : "UNPAID",
      createdAt: inv.MetaData?.CreateTime,
      invoiceDate: inv.TxnDate,
      dueDate: inv.DueDate,
      viewUrl: `https://app.qbo.intuit.com/app/invoice?txnId=${inv.Id}`,
      pdfUrl: null,
      customer: {
        id: inv.CustomerRef?.value,
        name: inv.CustomerRef?.name || "Customer",
        email: inv.BillEmail?.Address || "",
      },
      total: {
        raw: inv.TotalAmt || 0,
        value: `$${Number(inv.TotalAmt || 0).toFixed(2)}`,
      },
      amountDue: {
        raw: inv.Balance || 0,
        value: `$${Number(inv.Balance || 0).toFixed(2)}`,
      },
      amountPaid: {
        raw: (inv.TotalAmt || 0) - (inv.Balance || 0),
        value: `$${Number((inv.TotalAmt || 0) - (inv.Balance || 0)).toFixed(2)}`,
      },
    }));

    return NextResponse.json({
      success: true,
      invoices,
      pageInfo: {
        totalCount: invoices.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch QuickBooks invoices" },
      { status: error.status || error.statusCode || 500 }
    );
  }
}
