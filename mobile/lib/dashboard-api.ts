import { apiRequest } from "@/lib/api";
import type { LoanStats, WalletBalance } from "@/types/api";

export async function getWalletBalance(): Promise<WalletBalance> {
  return apiRequest<WalletBalance>("wallet/balance/");
}

export async function getLoanStats(): Promise<LoanStats> {
  return apiRequest<LoanStats>("loans/stats/");
}

export async function getTransactionHistory() {
  return apiRequest<{ results?: unknown[] } | unknown[]>("transactions/history/");
}
