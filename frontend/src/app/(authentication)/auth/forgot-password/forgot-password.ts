"use server"

import { post } from "@/lib/fetch";
import { ForgotPasswordSchema } from "@/lib/schema";
import { redirect } from "next/navigation";
import { z } from "zod";


export default async function forgotPassword(data: z.infer<typeof ForgotPasswordSchema>){
  const { error } = await post('auth/forgot-password/', data);
  if(error){
    console.log("Error: ", error)
    return { error }
  } 

  redirect("/auth/login")
  return {success: true}

}

