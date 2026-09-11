import { NextRequest, NextResponse } from "next/server";
import { waveGraphQLRequest, QUERIES } from "@/lib/wave-client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const customToken = request.headers.get("x-wave-token") || undefined;

    let {
      businessId,
      customerId,
      customerName,
      customerEmail,
      invoiceNumber,
      invoiceDate,
      dueDate,
      currency,
      items,
      memo,
      footer,
    } = body;

    if (!businessId) {
      return NextResponse.json(
        { success: false, error: "businessId is required" },
        { status: 400 }
      );
    }

    // Auto-create customer in Wave if customerId not provided but customerName is provided
    if (!customerId && customerName) {
      try {
        const custInput: any = {
          businessId,
          name: customerName.trim(),
        };
        if (customerEmail) custInput.email = customerEmail.trim();

        const custRes = await waveGraphQLRequest<any>(
          QUERIES.CREATE_CUSTOMER,
          { input: custInput },
          customToken
        );

        if (custRes?.customerCreate?.didSucceed && custRes?.customerCreate?.customer?.id) {
          customerId = custRes.customerCreate.customer.id;
        } else if (custRes?.customerCreate?.inputErrors?.length) {
          console.warn("Wave customerCreate error:", custRes.customerCreate.inputErrors);
        }
      } catch (custErr) {
        console.warn("Could not auto-create customer:", custErr);
      }
    }

    if (!customerId) {
      return NextResponse.json(
        { success: false, error: "Customer information is required (provide customerId or customerName)" },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "At least one item is required in the invoice" },
        { status: 400 }
      );
    }

    const formattedItems = [];

    // 1. Fetch existing products for this business
    let existingProducts: any[] = [];
    try {
      const prodData = await waveGraphQLRequest<any>(
        QUERIES.GET_PRODUCTS,
        { businessId },
        customToken
      );
      existingProducts =
        prodData?.business?.products?.edges?.map((edge: any) => edge.node) || [];
    } catch (e) {
      console.warn("Could not fetch existing products:", e);
    }

    // 2. Fetch income accounts for creating new products in Wave
    let defaultIncomeAccountId: string | undefined = undefined;
    try {
      const accData = await waveGraphQLRequest<any>(
        QUERIES.GET_INCOME_ACCOUNTS,
        { businessId },
        customToken
      );
      const accounts =
        accData?.business?.accounts?.edges?.map((edge: any) => edge.node) || [];
      if (accounts.length > 0) {
        defaultIncomeAccountId = accounts[0].id;
      }
    } catch (e) {
      console.warn("Could not fetch income accounts:", e);
    }

    for (const item of items) {
      let productId = item.productId;
      const productName = (item.name || item.description || "General Service").trim();
      const extraDescription = (item.description && item.name && item.description !== item.name) ? item.description.trim() : "";

      // If no productId, try to find an existing matching product or create a new one with this exact name
      if (!productId) {
        const existing = existingProducts.find(
          (p: any) => p.name.toLowerCase() === productName.toLowerCase()
        );

        if (existing) {
          productId = existing.id;
        } else {
          // Auto-create product in Wave with the exact productName as the product title
          const prodInput: any = {
            businessId,
            name: productName.substring(0, 100),
            unitPrice: Number(item.unitPrice) || 0,
            isSold: true,
            isBought: false,
          };
          if (defaultIncomeAccountId) {
            prodInput.incomeAccountId = defaultIncomeAccountId;
          }

          const prodRes = await waveGraphQLRequest<any>(
            QUERIES.CREATE_PRODUCT,
            { input: prodInput },
            customToken
          );

          if (prodRes?.productCreate?.didSucceed && prodRes?.productCreate?.product?.id) {
            productId = prodRes.productCreate.product.id;
            existingProducts.push(prodRes.productCreate.product);
          } else {
            const errDetail =
              prodRes?.productCreate?.inputErrors?.map((e: any) => e.message).join(", ") ||
              "Could not create product in Wave";
            return NextResponse.json(
              {
                success: false,
                error: `Failed to create product "${productName}" in Wave: ${errDetail}`,
                inputErrors: prodRes?.productCreate?.inputErrors,
              },
              { status: 400 }
            );
          }
        }
      }

      const itemInput: any = {
        productId,
        quantity: Number(item.quantity) || 1,
        unitPrice: Number(item.unitPrice) || 0,
      };

      // Only attach description if there is an actual extra sub-description
      if (extraDescription) {
        itemInput.description = extraDescription;
      }

      formattedItems.push(itemInput);
    }

    const input: any = {
      businessId,
      customerId,
      items: formattedItems,
    };

    if (invoiceNumber) input.invoiceNumber = invoiceNumber;
    if (invoiceDate) input.invoiceDate = invoiceDate;
    if (dueDate) input.dueDate = dueDate;
    if (currency) input.currency = currency;
    if (memo) input.memo = memo;
    if (footer) input.footer = footer;

    const data = await waveGraphQLRequest<any>(
      QUERIES.CREATE_INVOICE,
      { input },
      customToken
    );

    const res = data?.invoiceCreate;
    if (!res?.didSucceed) {
      const errorMsg =
        res?.inputErrors?.map((e: any) => `${e.path?.join(".") || "Error"}: ${e.message}`).join(", ") ||
        "Failed to create invoice (Wave rejected the invoice data).";

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
      { success: false, error: error.message || "Failed to create invoice" },
      { status: 500 }
    );
  }
}
