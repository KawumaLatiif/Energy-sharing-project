import { apiRequest } from "@/lib/api";
import type { MeterInfo, MeterToken, UnitEstimate } from "@/types/api";

export async function getMyMeter(): Promise<MeterInfo | null> {
  try {
    return await apiRequest<MeterInfo>("meter/my-meter/");
  } catch {
    return null;
  }
}

export async function estimateUnits(amount: number): Promise<UnitEstimate> {
  return apiRequest<UnitEstimate>(`meter/estimate-units/?amount=${amount}`);
}

export async function buyUnits(amount: number, phone_number: string) {
  return apiRequest<{
    status?: string;
    transaction_id?: string | number;
    message?: string;
    estimated_units?: number;
    token?: string;
  }>("meter/buy-units/", {
    method: "POST",
    body: JSON.stringify({ amount, phone_number, channel: "MOBILE_APP" }),
  });
}

export async function checkPaymentStatus(transaction_id: string) {
  return apiRequest<{
    status: string;
    message: string;
    units_purchased?: number;
    token?: string;
  }>("meter/check-payment-status/", {
    method: "POST",
    body: JSON.stringify({ transaction_id }),
  });
}

export async function getTokens(): Promise<MeterToken[]> {
  const data = await apiRequest<{ results?: MeterToken[] } | MeterToken[]>(
    "meter/token/"
  );
  return Array.isArray(data) ? data : (data.results ?? []);
}

export async function generateToken(units: number) {
  return apiRequest<{ token: string; message?: string }>("meter/generate-token/", {
    method: "POST",
    body: JSON.stringify({ units }),
  });
}
