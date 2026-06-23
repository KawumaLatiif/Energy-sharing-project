"use server";

import { post } from "@/lib/fetch";

export type ApplyWalletUnitsResult = {
  success?: boolean;
  message?: string;
  error?: string;
  units_applied?: number;
  meter_balance?: number;
  remaining_wallet_balance?: number;
};

export async function applyWalletUnits(data: {
  meter_no: string;
  amount: number;
}): Promise<{ data?: ApplyWalletUnitsResult; error?: unknown; status: number }> {
  return post<ApplyWalletUnitsResult>("meter/apply-wallet-units/", data);
}
