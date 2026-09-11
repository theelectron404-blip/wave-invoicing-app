import { NextRequest, NextResponse } from "next/server";
import { waveGraphQLRequest, QUERIES } from "@/lib/wave-client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "50", 10);
    const customToken = request.headers.get("x-wave-token") || undefined;

    if (!businessId) {
      return NextResponse.json(
        { success: false, error: "businessId query parameter is required" },
        { status: 400 }
      );
    }

    const data = await waveGraphQLRequest<any>(
      QUERIES.GET_INVOICES,
      { businessId, page, pageSize },
      customToken
    );

    const invoiceEdges = data?.business?.invoices?.edges || [];
    const invoices = invoiceEdges.map((e: any) => e.node);
    const pageInfo = data?.business?.invoices?.pageInfo || {};

    return NextResponse.json({
      success: true,
      invoices,
      pageInfo,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch invoices" },
      { status: 500 }
    );
  }
}
