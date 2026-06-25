import { apiRequest } from "@/lib/api";
import type { LoanApplication, LoanApplyPayload } from "@/types/api";

export async function getMyLoans(): Promise<LoanApplication[]> {
  const data = await apiRequest<LoanApplication[] | { results?: LoanApplication[] }>(
    "loans/my-loans/"
  );
  return Array.isArray(data) ? data : (data.results ?? []);
}

export async function applyForLoan(payload: LoanApplyPayload) {
  return apiRequest<{
    success?: boolean;
    loan_id?: string;
    status?: string;
    message?: string;
    rejection_reason?: string;
    credit_score?: number;
    max_eligible_amount?: number;
  }>("loans/apply/", { method: "POST", body: JSON.stringify(payload) });
}

export async function disburseLoan(loanId: number) {
  return apiRequest<{ success?: boolean; message?: string; token?: string }>(
    `loans/disburse/${loanId}/`,
    { method: "POST", body: JSON.stringify({}) }
  );
}

export async function repayLoan(loanId: number, amount: number) {
  return apiRequest<{ success?: boolean; message?: string }>(
    `loans/repay/${loanId}/`,
    { method: "POST", body: JSON.stringify({ amount }) }
  );
}

export async function repayLoanMoMo(loanId: number, phone_number: string, amount: number) {
  return apiRequest<{ external_id?: string; message?: string; status?: string }>(
    `loans/repay/momo/${loanId}/`,
    { method: "POST", body: JSON.stringify({ phone_number, amount }) }
  );
}

export async function checkMoMoPaymentStatus(externalId: string) {
  return apiRequest<{ status?: string; message?: string }>(
    `loans/payment-status/${encodeURIComponent(externalId)}/`
  );
}
