export type UserRole = "ADMIN" | "CLIENT" | "CUSTOMER_SERVICE" | "OPERATOR";

export interface AuthUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  user_role: UserRole;
  is_admin: boolean;
  redirect_to?: string;
  must_change_password?: boolean;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: AuthUser;
  requires_2fa?: boolean;
  challenge_token?: string;
  must_change_password?: boolean;
  redirect_to?: string;
}

export interface MeterInfo {
  id: number;
  meter_no: string;
  architecture: "STS" | "AMI" | string;
  units: number;
  pending_units?: number;
  status?: string;
  label?: string;
  has_iot_token?: boolean;
}

export interface WalletBalance {
  balance: number;
  currency?: string;
}

export interface UnitEstimate {
  estimated_units: number;
  tariff?: string | null;
  service_charge?: number;
  vat?: number;
  energy_cost?: number;
  insufficient_amount?: boolean;
  minimum_payment?: number;
  service_charge_included?: boolean;
}

export interface LoanStats {
  pending_applications: number;
  active_loans: number;
  outstanding_balance: number;
  has_blocking_loan?: boolean;
  credit_score?: number;
  loan_tier?: string | null;
  max_eligible_amount?: number;
  platform_max_loan?: number;
  min_loan_amount?: number;
  min_credit_score?: number;
  is_loan_eligible?: boolean;
  interest_rate?: number | null;
  profile_complete_for_scoring?: boolean;
}

export interface MeterToken {
  id: number;
  token: string;
  units: number;
  is_used: boolean;
  create_date?: string;
}

export interface MeterNotification {
  id: number;
  notification_type: string;
  units_kwh: number;
  is_read: boolean;
  occurred_at: string;
  meter_no?: string | null;
}

export interface LoanApplication {
  id: number;
  loan_id: string;
  status: string;
  amount_requested: number;
  amount_approved?: number | null;
  outstanding_balance?: number;
  purpose?: string;
  tenure_months?: number;
}

export interface LoanApplyPayload {
  amount_requested: number;
  purpose: string;
  tenure_months: number;
}

export interface TransactionItem {
  id: string | number;
  transaction_type?: string;
  type?: string;
  amount_kwh?: number;
  amount_ugx?: number;
  status?: string;
  created_at?: string;
  create_date?: string;
}

export interface PowerUsageSummary {
  total_kwh: number;
  average_daily_kwh: number;
  peak_day_kwh: number;
  peak_day_date: string | null;
  lowest_day_kwh: number;
  lowest_day_date: string | null;
  days_with_data: number;
}

export interface PowerUsageDaily {
  date: string;
  kwh_used: number;
  source?: string | null;
}

export interface PowerUsageReport {
  eligible: boolean;
  message?: string;
  meter_no?: string;
  meter_label?: string;
  period?: string;
  range?: { start: string; end: string };
  summary?: PowerUsageSummary;
  daily?: PowerUsageDaily[];
  monthly?: Array<{
    month: number;
    label: string;
    total_kwh: number;
    average_daily_kwh: number;
  }>;
  available_years?: number[];
  available_meters?: Array<{ meter_no: string; label: string }>;
  data_source?: string;
}
