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
    const { invoiceId, to, subject, message } = body;

    if (!invoiceId) {
      return NextResponse.json(
        { success: false, error: "invoiceId is required." },
        { status: 400 }
      );
    }

    // If subject or message provided, update QuickBooks company email template preferences before sending
    if (subject || message) {
      try {
        const prefRes = await qboApiRequest<any>("/preferences", {
          realmId,
          accessToken,
          environment,
        });

        if (prefRes?.Preferences) {
          const prefs = prefRes.Preferences;
          const emailMessagesPrefs = prefs.EmailMessagesPrefs || {};
          const invoiceMsg = emailMessagesPrefs.InvoiceMessage || {};

          if (subject) invoiceMsg.Subject = subject;
          if (message) invoiceMsg.Message = message;

          emailMessagesPrefs.InvoiceMessage = invoiceMsg;
          prefs.EmailMessagesPrefs = emailMessagesPrefs;

          await qboApiRequest<any>("/preferences", {
            method: "POST",
            body: prefs,
            realmId,
            accessToken,
            environment,
          });
        }
      } catch (prefErr) {
        console.warn("Could not update QBO email preferences before send:", prefErr);
      }
    }

    const recipientEmail = Array.isArray(to) ? to[0] : to;
    const sendQuery = recipientEmail ? `?sendTo=${encodeURIComponent(recipientEmail)}` : "";

    const data = await qboApiRequest<any>(`/invoice/${invoiceId}/send${sendQuery}`, {
      method: "POST",
      realmId,
      accessToken,
      environment,
    });

    const sentInvoice = data?.Invoice;

    return NextResponse.json({
      success: true,
      invoice: {
        id: sentInvoice?.Id || invoiceId,
        status: "SENT",
        emailStatus: sentInvoice?.EmailStatus,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to send invoice via QuickBooks" },
      { status: 500 }
    );
  }
}
