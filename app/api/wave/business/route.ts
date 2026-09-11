import { NextRequest, NextResponse } from "next/server";
import { waveGraphQLRequest, QUERIES } from "@/lib/wave-client";

export async function GET(request: NextRequest) {
  try {
    const customToken = request.headers.get("x-wave-token") || undefined;
    const data = await waveGraphQLRequest<any>(
      QUERIES.GET_USER_BUSINESSES,
      {},
      customToken
    );

    const businesses =
      data?.businesses?.edges?.map((edge: any) => edge.node) || [];

    return NextResponse.json({
      success: true,
      userEmail: data?.user?.defaultEmail,
      businesses,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch businesses" },
      { status: 500 }
    );
  }
}
