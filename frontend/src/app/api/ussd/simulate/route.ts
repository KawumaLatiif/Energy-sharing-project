import { NextRequest, NextResponse } from "next/server";
import { API_URL } from "@/common/constants/api";

type UssdPayload = {
  sessionId: string;
  serviceCode: string;
  phoneNumber: string;
  text: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as UssdPayload;
    const endpoint = `${API_URL}/ussd/entry/`;

    const backendResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const raw = await backendResponse.text();
    let normalized = raw.trim();

    // DRF may return a JSON-encoded string like: "CON menu..."
    if (normalized.startsWith('"') && normalized.endsWith('"')) {
      try {
        normalized = JSON.parse(normalized);
      } catch {
        normalized = normalized.slice(1, -1);
      }
    }

    return NextResponse.json(
      {
        ok: backendResponse.ok,
        status: backendResponse.status,
        response: normalized,
      },
      { status: backendResponse.ok ? 200 : backendResponse.status },
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: `Simulator request failed: ${String(error)}` },
      { status: 500 },
    );
  }
}
