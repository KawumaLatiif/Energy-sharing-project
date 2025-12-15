// app/auth/register/_actions/register.tsx
"use server"

import { get, post } from "@/lib/fetch";
import { redirect } from "next/navigation";
import { createAccountSchema } from "@/lib/schema";
import { z } from "zod";

import { cookies } from "next/headers";
import { VERIFICATION_EMAIL } from "@/common/constants/auth-cookie";

export default async function createUser(data: z.infer<typeof createAccountSchema>){
  try {
    const { error, data: responseData } = await post("auth/register/", data);

    if(error){
      return { error: error.message || "Registration failed" }
    } 

    // Store email for verification redirect
    const exp = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    const cookieStore = await cookies();
    cookieStore.set({
      name: VERIFICATION_EMAIL,
      value: data.email,
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      expires: exp,
      sameSite: 'lax',
      path: '/',
    });

    // Use redirect outside of try-catch to avoid catching the redirect error
    redirect("/auth/verify-email?email=" + encodeURIComponent(data.email));

  } catch (error) {
    // Check if it's a redirect error and re-throw it
    if (error && typeof error === 'object' && 'digest' in error && 
        (error as any).digest?.startsWith('NEXT_REDIRECT')) {
      throw error; // Re-throw redirect errors
    }
    
    console.error("Registration error:", error);
    return { error: "An unexpected error occurred during registration" };
  }
}

export async function getUserByRefCode<T>(refCode: string){
  const response = await get(`auth/get-user-sponsor/${refCode}`);
  if (response.error) {
    throw new Error(response.error.message || "Failed to fetch user by referral code");
  }
  return response.data as T;
}