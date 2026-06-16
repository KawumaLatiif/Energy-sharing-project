import { NextResponse } from "next/server";
import { API_URL } from "@/common/constants/api";

export async function GET() {
  try {
    const backendResponse = await fetch(`${API_URL}/ussd/phones/`, {
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
      { ok: false, results: [], error: `Failed to load phone numbers: ${String(error)}` },
      { status: 500 },
    );
  }
}
