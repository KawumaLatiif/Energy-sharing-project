export type UserRole = "ADMIN" | "CLIENT" | "CUSTOMER_SERVICE" | "OPERATOR";

export interface AuthUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  user_role: UserRole;
  is_admin: boolean;
  redirect_to?: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: AuthUser;
  requires_2fa?: boolean;
  challenge_token?: string;
}

export interface MeterInfo {
  id: number;
  meter_no: string;
  architecture: "STS" | "AMI" | string;
  units: number;
  pending_units?: number;
  status?: string;
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
}

export interface MeterToken {
  id: number;
  token: string;
  units: number;
  is_used: boolean;
  create_date?: string;
}
