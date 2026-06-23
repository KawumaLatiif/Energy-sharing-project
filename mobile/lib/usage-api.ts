import { apiRequest } from "@/lib/api";
import type { PowerUsageReport } from "@/types/api";

export type UsagePeriod = "week" | "month" | "year";

export async function getPowerUsage(params: {
  period?: UsagePeriod;
  meter_no?: string;
  year?: number;
  month?: number;
}): Promise<PowerUsageReport> {
  const qs = new URLSearchParams();
  if (params.period) qs.set("period", params.period);
  if (params.meter_no) qs.set("meter_no", params.meter_no);
  if (params.year) qs.set("year", String(params.year));
  if (params.month) qs.set("month", String(params.month));

  const res = await apiRequest<{ success?: boolean; data: PowerUsageReport }>(
    `meter/power-usage/?${qs.toString()}`
  );
  return res.data;
}
