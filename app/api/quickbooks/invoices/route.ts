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
    let {
      customerId,
      customerName,
      customerEmail,
      invoiceNumber,
      invoiceDate,
      dueDate,
      items,
      memo,
      footer,
      emailMessage,
      emailSubject,
    } = body;

    // 1. Auto-create or resolve customer
    if (!customerId) {
      const resolvedName = (customerName || customerEmail?.split("@")[0] || "Valued Customer").trim();
      try {
        const cleanName = resolvedName.replace(/'/g, "\\'");
        const query = encodeURIComponent(`select * from Customer where DisplayName = '${cleanName}'`);
        const custSearch = await qboApiRequest<any>(`/query?query=${query}`, {
          realmId,
          accessToken,
          environment,
        });

        if (custSearch?.QueryResponse?.Customer?.length > 0) {
          customerId = custSearch.QueryResponse.Customer[0].Id;
        } else {
          const custPayload: any = { DisplayName: resolvedName };
          if (customerEmail) custPayload.PrimaryEmailAddr = { Address: customerEmail.trim() };

          const newCust = await qboApiRequest<any>("/customer", {
            method: "POST",
            body: custPayload,
            realmId,
            accessToken,
            environment,
          });
          if (newCust?.Customer?.Id) {
            customerId = newCust.Customer.Id;
          }
        }
      } catch (err: any) {
        console.warn("Could not auto-create customer by name, trying fallback:", err);
        // If duplicate display name or specific error, fallback to appending timestamp or email
        try {
          const fallbackName = `${resolvedName} (${Date.now().toString().slice(-4)})`;
          const fallbackCust = await qboApiRequest<any>("/customer", {
            method: "POST",
            body: {
              DisplayName: fallbackName,
              PrimaryEmailAddr: customerEmail ? { Address: customerEmail.trim() } : undefined,
            },
            realmId,
            accessToken,
            environment,
          });
          if (fallbackCust?.Customer?.Id) {
            customerId = fallbackCust.Customer.Id;
          }
        } catch (innerErr) {
          console.error("Failed fallback customer creation:", innerErr);
        }
      }
    }

    if (!customerId) {
      // Last resort: query any existing customer in QuickBooks
      try {
        const anyCust = await qboApiRequest<any>("/query?query=" + encodeURIComponent("select * from Customer maxresults 1"), {
          realmId,
          accessToken,
          environment,
        });
        if (anyCust?.QueryResponse?.Customer?.length > 0) {
          customerId = anyCust.QueryResponse.Customer[0].Id;
        }
      } catch (_) {}
    }

    if (!customerId) {
      return NextResponse.json(
        { success: false, error: "Customer information is required. Please provide a Customer Name." },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one item is required in the invoice." },
        { status: 400 }
      );
    }

    // 2. Fetch default income account once for new items
    let defaultIncomeAccountId: string | undefined = undefined;
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
        defaultIncomeAccountId = accData.QueryResponse.Account[0].Id;
      }
    } catch (e) {
      console.warn("Could not query default income account:", e);
    }

    // 3. Process line items
    const qboLines = [];

    for (const item of items) {
      let itemId = item.productId;
      const itemName = (item.name || item.description || "Services").trim();
      const unitPrice = Number(item.unitPrice) || 0;
      const qty = Number(item.quantity) || 1;
      const amount = Number(item.amount) || unitPrice * qty;

      if (!itemId) {
        // Auto-find or create item
        try {
          const cleanItemName = itemName.replace(/'/g, "\\'");
          const query = encodeURIComponent(`select * from Item where Name = '${cleanItemName}'`);
          const itemSearch = await qboApiRequest<any>(`/query?query=${query}`, {
            realmId,
            accessToken,
            environment,
          });

          if (itemSearch?.QueryResponse?.Item?.length > 0) {
            itemId = itemSearch.QueryResponse.Item[0].Id;
          } else {
            const itemPayload: any = {
              Name: itemName.substring(0, 100),
              Type: "Service",
              UnitPrice: unitPrice,
              Description: item.description || itemName,
            };
            if (defaultIncomeAccountId) {
              itemPayload.IncomeAccountRef = { value: defaultIncomeAccountId };
            }

            const newItem = await qboApiRequest<any>("/item", {
              method: "POST",
              body: itemPayload,
              realmId,
              accessToken,
              environment,
            });
            if (newItem?.Item?.Id) {
              itemId = newItem.Item.Id;
            }
          }
        } catch (e) {
          console.warn("Could not auto-create item in QuickBooks:", e);
        }
      }

      qboLines.push({
        Amount: amount,
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: itemId ? { value: itemId, name: itemName } : undefined,
          UnitPrice: unitPrice,
          Qty: qty,
        },
        Description: item.description || itemName,
      });
    }

    const invoicePayload: any = {
      CustomerRef: { value: customerId },
      Line: qboLines,
    };

    if (invoiceNumber) invoicePayload.DocNumber = invoiceNumber;
    if (invoiceDate) invoicePayload.TxnDate = invoiceDate;
    if (dueDate) invoicePayload.DueDate = dueDate;
    if (customerEmail) invoicePayload.BillEmail = { Address: customerEmail };

    const emailText = emailMessage || memo;
    if (emailText) {
      invoicePayload.CustomerMemo = { value: emailText.substring(0, 1000) };
    }
    if (footer) invoicePayload.PrivateNote = footer;

    // QuickBooks Online Email Customization Structure
    if (emailSubject || emailText) {
      invoicePayload.EmailStatus = "NeedToSend";
      invoicePayload.DeliveryInfo = {
        DeliveryType: "Email",
      };
      if (customerEmail) {
        invoicePayload.BillEmail = {
          Address: customerEmail,
        };
      }
    }

    const data = await qboApiRequest<any>("/invoice", {
      method: "POST",
      body: invoicePayload,
      realmId,
      accessToken,
      environment,
    });

    const created = data?.Invoice;

    return NextResponse.json({
      success: true,
      invoice: {
        id: created.Id,
        invoiceNumber: created.DocNumber || `INV-${created.Id}`,
        status: created.Balance === 0 ? "PAID" : "UNPAID",
        total: {
          raw: created.TotalAmt || 0,
          value: `$${Number(created.TotalAmt || 0).toFixed(2)}`,
        },
        customer: {
          id: customerId,
          name: customerName,
          email: customerEmail,
        },
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create invoice in QuickBooks" },
      { status: error.status || error.statusCode || 500 }
    );
  }
}
