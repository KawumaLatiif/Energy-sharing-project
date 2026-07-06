import { apiRequest } from "@/lib/api";
import type { LoanStats, TransactionItem, WalletBalance } from "@/types/api";

function parseWalletBalance(data: Record<string, unknown>): WalletBalance {
  const wallet = data.wallet as { balance?: string | number } | undefined;
  const raw =
    wallet?.balance ??
    data.wallet_balance ??
    data.unit_wallet_balance ??
    data.balance ??
    0;
  const balance = parseFloat(String(raw));
  return {
    balance: Number.isFinite(balance) ? balance : 0,
    currency: "kWh",
  };
}

export async function getWalletBalance(): Promise<WalletBalance> {
  const data = await apiRequest<Record<string, unknown>>("wallet/balance/");
  if (data.success === false) {
    return { balance: 0, currency: "kWh" };
  }
  return parseWalletBalance(data);
}

export async function getLoanStats(): Promise<LoanStats> {
  return apiRequest<LoanStats>("loans/stats/");
}

export async function getTransactionHistory(page = 1, pageSize = 20) {
  return apiRequest<{ results?: TransactionItem[]; count?: number } | TransactionItem[]>(
    `transactions/history/?page=${page}&page_size=${pageSize}`
  );
}
