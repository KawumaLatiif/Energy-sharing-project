import { publicRequest, apiRequest } from "@/lib/api";
import { setTokens, clearTokens } from "@/lib/storage";
import type { AuthUser, LoginResponse } from "@/types/api";

export interface RegisterPayload {
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  gender: "MALE" | "FEMALE" | "OTHER";
  password: string;
  confirm_password: string;
}

export async function login(
  email: string,
  password: string
): Promise<LoginResponse> {
  const data = await publicRequest<LoginResponse>("auth/login/", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  if (data.requires_2fa) {
    throw new Error("Staff 2FA login is not supported in the mobile app yet.");
  }

  await setTokens(data.access, data.refresh);
  return data;
}

export async function register(payload: RegisterPayload): Promise<{ message?: string }> {
  return publicRequest("auth/register/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function logout(): Promise<void> {
  await clearTokens();
}

export async function getUserConfig(): Promise<{ user: AuthUser; profile?: { email_verified: boolean } }> {
  return apiRequest("auth/get-user-config/");
}
