// "use server";

// import { API_URL } from "@/common/constants/api";
// import { getErrorMessage } from "@/lib/errors";
// import { jwtDecode } from "jwt-decode";
// import { cookies } from "next/headers";
// import { AUTHENTICATION_COOKIE, AUTHENTICATION_REFRESH_COOKIE } from "@/common/constants/auth-cookie";
// import { LoginSchema } from "@/lib/schema";
// import { z } from "zod";

// export const login = async (data: z.infer<typeof LoginSchema>) => {
//   try {
//     const res = await fetch(`${API_URL}/auth/login/`, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify(data),
//     });

//     const parsedRes = await res.json();

//     if (res.status === 400) {
//       // Check if it's an unverified email error
//       if (parsedRes.email && parsedRes.email.includes("verify your email")) {
//         return { 
//           error: "EMAIL_NOT_VERIFIED", 
//           message: "Please verify your email before logging in",
//           email: data.email 
//         };
//       }
      
//       const errorMessage = parsedRes.detail || parsedRes.error || "Login failed";
//       return { error: "LOGIN_FAILED", message: errorMessage };
//     }
    
//     if (!res.ok) {
//       return { error: "LOGIN_FAILED", message: getErrorMessage(parsedRes) };
//     }

//     // Set authentication cookies
//     const cookieStore = cookies();
//     if (parsedRes.access) {
//       const accessExpiry = new Date(jwtDecode(parsedRes.access).exp! * 1000);
//       (await cookieStore).set({
//         name: AUTHENTICATION_COOKIE,
//         value: parsedRes.access,
//         secure: process.env.NODE_ENV === "production",
//         httpOnly: true,
//         expires: accessExpiry,
//         sameSite: 'lax',
//         path: '/',
//       });
//     }
    
//     if (parsedRes.refresh) {
//       const refreshExpiry = new Date(jwtDecode(parsedRes.refresh).exp! * 1000);
//       (await cookieStore).set({
//         name: AUTHENTICATION_REFRESH_COOKIE,
//         value: parsedRes.refresh,
//         secure: process.env.NODE_ENV === "production",
//         httpOnly: true,
//         sameSite: 'lax',
//         path: '/',
//         expires: refreshExpiry,
//       });
//     }

//     const redirectTo = parsedRes.user?.is_admin ? "/admin/dashboard" : "/dashboard";

//     return { success: "Login successful", redirectTo: redirectTo, user: parsedRes.user, isAdmin: parsedRes.user?.is_admin || false };
//   } catch (err) {
//     console.error("Login Error:", err);
//     return { error: "SERVER_ERROR", message: "Server error occurred" };
//   }
// };

"use server";

import { API_URL } from "@/common/constants/api";
import { jwtDecode } from "jwt-decode";
import { cookies } from "next/headers";
import { AUTHENTICATION_COOKIE, AUTHENTICATION_REFRESH_COOKIE } from "@/common/constants/auth-cookie";

export const login = async (data: { email: string; password: string }) => {
  try {
    const res = await fetch(`${API_URL}/auth/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const parsedRes = await res.json();

    if (!res.ok) {
      const errorMessage = parsedRes.detail || parsedRes.error || "Login failed";
      return { error: "LOGIN_FAILED", message: errorMessage };
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

    // LOG THE USER DATA TO DEBUG
    console.log("🔍 Login Response User Data:", parsedRes.user);
    
    // Determine redirect based on user data
    let redirectTo = '/dashboard';
    
    if (parsedRes.user?.is_admin || parsedRes.user?.user_role === 'ADMIN') {
      redirectTo = '/admin/dashboard';
      console.log("✅ Redirecting admin to:", redirectTo);
    } else {
      console.log("✅ Redirecting regular user to:", redirectTo);
    }

    return { 
      success: "Login successful", 
      redirectTo: redirectTo, 
      user: parsedRes.user 
    };
  } catch (err) {
    console.error("Login Error:", err);
    return { error: "SERVER_ERROR", message: "Server error occurred" };
  }
};