import { NextRequest, NextResponse } from "next/server";
import { API_URL } from "@/common/constants/api";

export async function GET(request: NextRequest) {
  try {
    const phoneNumber = request.nextUrl.searchParams.get("phoneNumber") ?? "";
    const endpoint = `${API_URL}/ussd/meters/?phoneNumber=${encodeURIComponent(phoneNumber)}`;

    const backendResponse = await fetch(endpoint, {
      method: "GET",
      cache: "no-store",
    });

    const data = await backendResponse.json();
    return NextResponse.json(
      {
        ok: backendResponse.ok,
        results: data?.results ?? [],
      },
      { status: backendResponse.ok ? 200 : backendResponse.status },
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, results: [], error: `Failed to load meter numbers: ${String(error)}` },
      { status: 500 },
    );
  }
}
