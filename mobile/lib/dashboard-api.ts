import { apiRequest } from "@/lib/api";
import type { LoanStats, TransactionItem, WalletBalance } from "@/types/api";

export async function getWalletBalance(): Promise<WalletBalance> {
  return apiRequest<WalletBalance>("wallet/balance/");
}

export async function getLoanStats(): Promise<LoanStats> {
  return apiRequest<LoanStats>("loans/stats/");
}

export async function getTransactionHistory(page = 1, pageSize = 20) {
  return apiRequest<{ results?: TransactionItem[]; count?: number } | TransactionItem[]>(
    `transactions/history/?page=${page}&page_size=${pageSize}`
  );
}
