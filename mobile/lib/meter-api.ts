import { apiRequest } from "@/lib/api";
import type { MeterInfo, MeterNotification, MeterToken, UnitEstimate } from "@/types/api";

type MyMeterResponse = {
  success: boolean;
  data?: {
    has_meter: boolean;
    meters?: Array<{
      meter_number: string;
      static_ip?: string;
      units: number;
      architecture: string;
      pending_units?: number;
      status?: string;
      label?: string;
      has_iot_token?: boolean;
    }>;
    meter_number?: string;
    units?: number;
    architecture?: string;
    pending_units?: number;
  };
};

type RawMeter = NonNullable<NonNullable<MyMeterResponse["data"]>["meters"]>[number];

function mapMeter(m: RawMeter, index: number): MeterInfo {
  return {
    id: index,
    meter_no: m.meter_number,
    architecture: m.architecture,
    units: m.units,
    pending_units: m.pending_units,
    status: m.status,
    label: m.label,
    has_iot_token: m.has_iot_token,
  };
}

export async function getMyMeters(): Promise<MeterInfo[]> {
  try {
    const res = await apiRequest<MyMeterResponse>("meter/my-meter/");
    if (!res.data?.has_meter) return [];
    if (res.data.meters?.length) {
      return res.data.meters.map(mapMeter);
    }
    if (res.data.meter_number) {
      return [{
        id: 0,
        meter_no: res.data.meter_number,
        architecture: res.data.architecture ?? "STS",
        units: res.data.units ?? 0,
        pending_units: res.data.pending_units,
      }];
    }
    return [];
  } catch {
    return [];
  }
}

export async function getMyMeter(): Promise<MeterInfo | null> {
  const meters = await getMyMeters();
  return meters[0] ?? null;
}

export async function estimateUnits(amount: number): Promise<UnitEstimate> {
  return apiRequest<UnitEstimate>(`meter/estimate-units/?amount=${amount}`);
}

export async function buyUnits(amount: number, phone_number: string, pin: string) {
  return apiRequest<{
    status?: string;
    transaction_id?: string | number;
    message?: string;
    estimated_units?: number;
    token?: string;
  }>("meter/buy-units/", {
    method: "POST",
    body: JSON.stringify({ amount, phone_number, pin, channel: "MOBILE_APP" }),
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

export async function getTokens(meterNo?: string): Promise<MeterToken[]> {
  const path = meterNo ? `meter/token/?meter_no=${encodeURIComponent(meterNo)}` : "meter/token/";
  const data = await apiRequest<{ results?: MeterToken[] } | MeterToken[]>(path);
  return Array.isArray(data) ? data : (data.results ?? []);
}

export async function generateToken(units: number, meterNo?: string) {
  return apiRequest<{ token: string; message?: string; remaining_balance?: number }>(
    "meter/generate-token/",
    {
      method: "POST",
      body: JSON.stringify({ amount: units, ...(meterNo ? { meter_no: meterNo } : {}) }),
    }
  );
}

export async function checkAmiUnits(meterNo: string) {
  return apiRequest<{ success?: boolean; units_kwh?: number; message?: string }>(
    `meter/check-units/?meter_no=${encodeURIComponent(meterNo)}`
  );
}

export async function applyWalletToAmi(amount: number, meterNo?: string) {
  return apiRequest<{ success?: boolean; message?: string; units?: number }>(
    "meter/apply-wallet-units/",
    {
      method: "POST",
      body: JSON.stringify({ amount, ...(meterNo ? { meter_no: meterNo } : {}) }),
    }
  );
}

export async function getNotifications() {
  return apiRequest<{ notifications: MeterNotification[]; unread_count: number }>(
    "meter/notifications/"
  );
}

export async function markNotificationsRead(ids?: number[], all?: boolean) {
  return apiRequest<{ success?: boolean }>("meter/notifications/", {
    method: "PATCH",
    body: JSON.stringify(all ? { all: true } : { ids: ids ?? [] }),
  });
}

export type RegisterMeterPayload = {
  meter_no: string;
  architecture: "STS" | "AMI";
  label?: string;
  iot_device_token?: string;
};

export async function registerMeter(payload: RegisterMeterPayload) {
  return apiRequest<{ success?: boolean; message?: string; error?: string }>(
    "meter/register/",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function updateMeter(
  payload: RegisterMeterPayload & { current_meter_no: string }
) {
  return apiRequest<{ success?: boolean; message?: string; error?: string }>(
    "meter/update/",
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    }
  );
}

export async function deleteMeter(meterNo: string, reason?: string) {
  return apiRequest<{ success?: boolean; message?: string; error?: string }>(
    "meter/delete/",
    {
      method: "POST",
      body: JSON.stringify({ meter_no: meterNo, ...(reason ? { reason } : {}) }),
    }
  );
}
