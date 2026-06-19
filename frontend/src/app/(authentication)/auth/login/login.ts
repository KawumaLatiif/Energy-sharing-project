"use server";

import { API_URL } from "@/common/constants/api";
import { getErrorMessage } from "@/lib/errors";
import { jwtDecode } from "jwt-decode";
import { cookies } from "next/headers";
import { AUTHENTICATION_COOKIE, AUTHENTICATION_REFRESH_COOKIE } from "@/common/constants/auth-cookie";
import { LoginSchema } from "@/lib/schema";
import { z } from "zod";

export const login = async (data: z.infer<typeof LoginSchema>) => {
  try {
    const res = await fetch(`${API_URL}/auth/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const parsedRes = await res.json();

    if (res.status === 400) {
      const emailError = parsedRes.email;
      const emailMsg = Array.isArray(emailError) ? emailError[0] : emailError;
      if (emailMsg && String(emailMsg).toLowerCase().includes("verify your email")) {
        return {
          error: "EMAIL_NOT_VERIFIED",
          message: String(emailMsg),
          email: data.email,
        };
      }

      const fieldErrors = parsedRes.non_field_errors;
      const fieldMsg = Array.isArray(fieldErrors) ? fieldErrors[0] : fieldErrors;
      const errorMessage =
        fieldMsg || parsedRes.detail || parsedRes.error || "Login failed";
      return { error: "LOGIN_FAILED", message: String(errorMessage) };
    }
    
    if (!res.ok) {
      return { error: "LOGIN_FAILED", message: getErrorMessage(parsedRes) };
    }

    // Set authentication cookies
    const cookieStore = cookies();
    if (parsedRes.access) {
      const accessExpiry = new Date(jwtDecode(parsedRes.access).exp! * 1000);
      (await cookieStore).set({
        name: AUTHENTICATION_COOKIE,
        value: parsedRes.access,
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        expires: accessExpiry,
        sameSite: 'lax',
        path: '/',
      });
    }
    
    if (parsedRes.refresh) {
      const refreshExpiry = new Date(jwtDecode(parsedRes.refresh).exp! * 1000);
      (await cookieStore).set({
        name: AUTHENTICATION_REFRESH_COOKIE,
        value: parsedRes.refresh,
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        expires: refreshExpiry,
      });
    }

    // Staff member with 2FA enabled — return challenge token, no JWT issued yet
    if (parsedRes.requires_2fa) {
      return {
        requires_2fa: true,
        challenge_token: parsedRes.challenge_token as string,
        user: parsedRes.user,
      };
    }

    const redirectTo = parsedRes.user?.is_admin ? "/admin/dashboard" : "/dashboard";

    return { success: "Login successful", redirectTo: redirectTo, user: parsedRes.user, isAdmin: parsedRes.user?.is_admin || false };
  } catch (err) {
    console.error("Login Error:", err);
    return { error: "SERVER_ERROR", message: "Server error occurred" };
  }
};
