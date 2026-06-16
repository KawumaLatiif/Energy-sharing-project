"use server";
import { get, patch } from "@/lib/fetch";
import { cookies } from "next/headers";
import { z } from "zod";
import { ResetPasswordSchema } from "@/lib/schema";
import { getApiErrorMessage } from "@/lib/api-response";
import { AUTHENTICATION_COOKIE } from "@/common/constants/auth-cookie";

export async function validateResetLink(uid: string, token: string) {
  const response = await get(`auth/reset-password/?uid=${uid}&token=${token}`);
  return response.error
    ? { error: getApiErrorMessage(response.error, "Invalid or expired reset link. Please request a new one.") }
    : { success: true };
}

export async function resetPassword(
  uid: string,
  token: string,
  data: z.infer<typeof ResetPasswordSchema>
) {
  const response = await patch(
    `auth/reset-password/?uid=${uid}&token=${token}`,
    data
  );
  if (response.error) {
    return { error: getApiErrorMessage(response.error, "Failed to reset password. The link may have expired — request a new one.") };
  }

  // Clear the auth cookie so any existing session doesn't conflict with
  // the new password. User must log in fresh after a reset.
  const cookieStore = await cookies();
  cookieStore.delete(AUTHENTICATION_COOKIE);

  return { success: "Password reset successfully! Please log in with your new password.", redirectTo: "/auth/login" };
}
