import { NextRequest, NextResponse } from "next/server";
import { waveGraphQLRequest, QUERIES } from "@/lib/wave-client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId =
      searchParams.get("businessId") || process.env.WAVE_BUSINESS_ID;
    const customToken = request.headers.get("x-wave-token") || undefined;

    if (!businessId) {
      return NextResponse.json(
        { success: false, error: "Business ID is required" },
        { status: 400 }
      );
    }

    const data = await waveGraphQLRequest<any>(
      QUERIES.GET_PRODUCTS,
      { businessId },
      customToken
    );

    const products =
      data?.business?.products?.edges?.map((edge: any) => edge.node) || [];

    return NextResponse.json({ success: true, products });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch products" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const customToken = request.headers.get("x-wave-token") || undefined;
    const { businessId, name, unitPrice, description } = body;

    if (!businessId || !name || unitPrice === undefined) {
      return NextResponse.json(
        { success: false, error: "businessId, name, and unitPrice are required" },
        { status: 400 }
      );
    }

    const input: any = {
      businessId,
      name,
      unitPrice: Number(unitPrice),
    };
    if (description) input.description = description;

    const data = await waveGraphQLRequest<any>(
      QUERIES.CREATE_PRODUCT,
      { input },
      customToken
    );

    const res = data?.productCreate;
    if (!res?.didSucceed) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to create product",
          inputErrors: res?.inputErrors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, product: res.product });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create product" },
      { status: 500 }
    );
  }
}
