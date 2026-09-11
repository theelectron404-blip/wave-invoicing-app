import { NextRequest, NextResponse } from "next/server";
import { waveGraphQLRequest, QUERIES } from "@/lib/wave-client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const customToken = request.headers.get("x-wave-token") || undefined;

    const { invoiceId, to, subject, message, attachPDF } = body;

    if (!invoiceId) {
      return NextResponse.json(
        { success: false, error: "invoiceId is required" },
        { status: 400 }
      );
    }

    if (!to || !Array.isArray(to) || to.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one recipient email ('to') is required" },
        { status: 400 }
      );
    }

    // 1. In Wave, an invoice must be APPROVED before it can be sent via email
    try {
      await waveGraphQLRequest<any>(
        QUERIES.APPROVE_INVOICE,
        { input: { invoiceId } },
        customToken
      );
    } catch (approveErr) {
      console.warn("Notice: Invoice approve step:", approveErr);
      // Even if it was already approved, continue to send
    }

    const input: any = {
      invoiceId,
      to,
      attachPDF: attachPDF !== undefined ? Boolean(attachPDF) : true,
    };

    if (subject) input.subject = subject;
    if (message) input.message = message;

    const data = await waveGraphQLRequest<any>(
      QUERIES.SEND_INVOICE,
      { input },
      customToken
    );

    const res = data?.invoiceSend;
    if (!res?.didSucceed) {
      const errorMsg =
        res?.inputErrors?.map((e: any) => `${e.path?.join(".") || "Error"}: ${e.message}`).join(", ") ||
        "Failed to send invoice email (Wave rejected the send request).";

      return NextResponse.json(
        {
          success: false,
          error: errorMsg,
          inputErrors: res?.inputErrors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      invoice: res.invoice,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to send invoice" },
      { status: 500 }
    );
  }
}
