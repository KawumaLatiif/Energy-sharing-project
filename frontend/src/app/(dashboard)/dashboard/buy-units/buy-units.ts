"use server";

import { API_URL } from "@/common/constants/api";
import { getErrorMessage } from "@/lib/errors";
import { jwtDecode } from "jwt-decode";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BuyUnitSchema } from "@/lib/schema";
import { post } from "@/lib/fetch";
import { z } from "zod";
import {
  AUTHENTICATION_COOKIE,
  AUTHENTICATION_REFRESH_COOKIE,
} from "@/common/constants/auth-cookie";

export const buyUnits = async (data: z.infer<typeof BuyUnitSchema>) => {
  const res = await post<{
    token: string;
    message: string;
    "Units purchased": string;
    payment_status?: string;
    external_id?: string;
    user_prompt?: string;
    transaction_id?: string;
  }>("transactions/buy-units/", data);

  console.log("Buy units: ", res.data);
  return res;
};

// Add payment status check function
export const checkPaymentStatus = async (transactionId: string) => {
  const res = await post<{
    status: string;
    message: string;
    units_purchased?: number;
    token?: string;
    transaction?: any;
  }>("transactions/check-payment-status/", { transaction_id: transactionId });

  return res;
};
