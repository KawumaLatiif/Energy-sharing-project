"use server";
import { get, patch } from "@/lib/fetch";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ResetPasswordSchema } from "@/lib/schema";

export async function validateResetLink(uid: string, token: string) {
  const response = await get(`auth/reset-password/?uid=${uid}&token=${token}`);
  return response.error
    ? { error: response.error || "Invalid reset link" }
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
    return { error: response.error.message || "Failed to reset password" };
  }
  return { success: "Password reset successfully!", redirectTo: "/auth/login" };
}
