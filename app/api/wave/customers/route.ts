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
      QUERIES.GET_CUSTOMERS,
      { businessId },
      customToken
    );

    const customers =
      data?.business?.customers?.edges?.map((edge: any) => edge.node) || [];

    return NextResponse.json({ success: true, customers });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch customers" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const customToken = request.headers.get("x-wave-token") || undefined;

    const { businessId, name, email, currency } = body;

    if (!businessId || !name) {
      return NextResponse.json(
        { success: false, error: "businessId and name are required" },
        { status: 400 }
      );
    }

    const input: any = {
      businessId,
      name,
    };
    if (email) input.email = email;
    if (currency) input.currency = currency;

    const data = await waveGraphQLRequest<any>(
      QUERIES.CREATE_CUSTOMER,
      { input },
      customToken
    );

    const res = data?.customerCreate;
    if (!res?.didSucceed) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to create customer",
          inputErrors: res?.inputErrors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, customer: res.customer });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create customer" },
      { status: 500 }
    );
  }
}
