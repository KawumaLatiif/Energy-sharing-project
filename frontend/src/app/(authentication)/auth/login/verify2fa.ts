"use server";

import { API_URL } from "@/common/constants/api";
import { jwtDecode } from "jwt-decode";
import { cookies } from "next/headers";
import { AUTHENTICATION_COOKIE, AUTHENTICATION_REFRESH_COOKIE } from "@/common/constants/auth-cookie";
import { staffRedirectPath } from "@/lib/staff";

export const verify2FA = async (challengeToken: string, code: string) => {
  try {
    const res = await fetch(`${API_URL}/admin/2fa/login-verify/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challenge_token: challengeToken, code }),
    });

    const parsedRes = await res.json();

    if (!res.ok) {
      return { error: parsedRes.error || "Invalid 2FA code" };
    }

    const cookieStore = cookies();

    if (parsedRes.access) {
      const accessExpiry = new Date(jwtDecode(parsedRes.access).exp! * 1000);
      (await cookieStore).set({
        name: AUTHENTICATION_COOKIE,
        value: parsedRes.access,
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        expires: accessExpiry,
        sameSite: "lax",
        path: "/",
      });
    }

    if (parsedRes.refresh) {
      const refreshExpiry = new Date(jwtDecode(parsedRes.refresh).exp! * 1000);
      (await cookieStore).set({
        name: AUTHENTICATION_REFRESH_COOKIE,
        value: parsedRes.refresh,
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        expires: refreshExpiry,
      });
    }

    const redirectTo = staffRedirectPath(parsedRes.user);

    return {
      success: true,
      redirectTo,
      user: parsedRes.user,
    };
  } catch (err) {
    console.error("2FA verify error:", err);
    return { error: "Server error during 2FA verification" };
  }
};
