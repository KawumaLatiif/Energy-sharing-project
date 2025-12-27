"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition, useEffect, useCallback } from "react";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import type { z } from "zod";
import { Terminal, Loader2, CheckCircle2, XCircle, Wallet } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { Input } from "@/components/anim/input";
import CardWrapper from "@/components/common/card-wrapper";
import { FormError } from "@/components/common/form-error";
import { FormSuccess } from "@/components/common/form-success";
import { Button } from "@/components/ui/button";
import { Input as ShadInput } from "@/components/ui/input";
import { BuyUnitSchema } from "@/lib/schema";
import { formatCurrency } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { buyUnits, checkPaymentStatus } from "../buy-units";
import { useAccount } from "@/hooks/use-account";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function BuyUnitsForm() {
  const formatter = formatCurrency("USD");
  const [error, setError] = useState<string | undefined>("");
  const [success, setSuccess] = useState("");
  const [token, setToken] = useState("");
  const [isPending, startTransition] = useTransition();
  const [paymentStatus, setPaymentStatus] = useState<
    "idle" | "pending" | "success" | "failed"
  >("idle");
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [unitsPurchased, setUnitsPurchased] = useState<number | null>(null);
  const [transactionDetails, setTransactionDetails] = useState<any>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [pollingCount, setPollingCount] = useState(0);

  const { user, loading } = useAccount();

  const form = useForm<z.infer<typeof BuyUnitSchema>>({
    resolver: zodResolver(BuyUnitSchema),
    defaultValues: { amount: 0, phone_number: "" },
  });

  useEffect(() => {
    if (paymentStatus === "success") {
      const timer = setTimeout(() => setShowSuccessModal(true), 5000);
      return () => clearTimeout(timer);
    }
  }, [paymentStatus]);

  const checkStatus = useCallback(async (id: string) => {
    try {
      const result = await checkPaymentStatus(id);

      if (result.data?.status === "SUCCESS") {
        setPaymentStatus("success");
        setUnitsPurchased(result.data.units_purchased || 0);
        setToken(result.data.token || "");
        setTransactionDetails(result.data.transaction || null);
        setSuccess("Payment completed successfully!");
        return true;
      } else if (result.data?.status === "FAILED") {
        setPaymentStatus("failed");
        setError(result.data.message || "Payment failed");
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error checking payment status:", error);
      return false;
    }
  }, []);

  // Polling
  useEffect(() => {
    if (paymentStatus === "pending" && transactionId) {
      let mounted = true;
      let timeoutId: NodeJS.Timeout;

      const poll = async () => {
        if (!mounted) return;
        const complete = await checkStatus(transactionId);

        if (!complete && mounted) {
          setPollingCount((prev) => prev + 1);
          timeoutId = setTimeout(poll, 20000);
        }
      };

      poll();

      return () => {
        mounted = false;
        clearTimeout(timeoutId);
      };
    }
  }, [paymentStatus, transactionId, checkStatus]);

  // Reset polling count
  useEffect(() => {
    if (paymentStatus === "pending") setPollingCount(0);
  }, [paymentStatus]);

  async function onSubmit(values: z.infer<typeof BuyUnitSchema>) {
    setError("");
    setSuccess("");
    setPaymentStatus("pending");
    setTransactionId(null);
    setPollingCount(0);

    startTransition(async () => {
      try {
        const data = await buyUnits(values);

        if (data?.error) {
          setPaymentStatus("failed");
          if (typeof data.error === "object") {
            if (data.error?.amount) {
              form.setError("amount", {
                type: "custom",
                message: data.error.amount[0],
              });
            }
            if (data.error?.phone_number) {
              form.setError("phone_number", {
                type: "custom",
                message: data.error.phone_number[0],
              });
            }
          } else setError(data.error);
          return;
        }

        if (data?.data?.status === "PENDING") {
          setTransactionId(data.data.transaction_id);
          setSuccess(
            data.data.user_prompt || "Simulating payment... Please wait"
          );
        } else if (data?.data?.token) {
          setPaymentStatus("success");
          setUnitsPurchased(parseFloat(data.data["Units purchased"]) || 0);
          setToken(data.data.token || "");
          setTransactionDetails(data.data.transaction || null);
          // setSuccess(data.data.message || "Payment initiated successfully!, check your phone to complete the payment");
          setSuccess(
            "Payment initiated successfully!, check your phone to complete the payment"
          );
        }
      } catch {
        setPaymentStatus("failed");
        setError("Failed to process payment");
      }
    });
  }

  if (loading) return null;

  return (
    <>
      <CardWrapper title="Buy Units">
        {/* --- SUCCESS MODAL --- */}
        <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
          <DialogContent className="sm:max-w-md bg-background border-border">
            <DialogHeader>
              <DialogTitle className="text-green-600 dark:text-green-400 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Payment Successful!!!
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Units have been successfully purchased
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <h3 className="font-semibold text-green-800 dark:text-green-300 mb-2">
                  Transaction Details
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Amount Paid:
                    </span>
                    <span className="font-semibold text-foreground">
                      UGX {transactionDetails?.amount}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      Units Purchased:
                    </span>
                    <span className="font-semibold text-foreground">
                      {unitsPurchased} units
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">
                      Status:
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300">
                      Completed
                    </span>
                  </div>
                  {transactionDetails?.timestamp && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">
                        Date:
                      </span>
                      <span className="font-semibold text-foreground text-xs">
                        {new Date(
                          transactionDetails.timestamp
                        ).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {token && (
                <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                  <Terminal className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <AlertTitle className="text-blue-800 dark:text-blue-300">
                    Token
                  </AlertTitle>
                  <AlertDescription className="text-blue-700 dark:text-blue-400 break-all">
                    {token}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    setShowSuccessModal(false);
                    form.reset();
                    setPaymentStatus("idle");
                  }}
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Done
                </Button>
                <Button
                  onClick={() => {
                    setShowSuccessModal(false);
                    form.reset();
                    setPaymentStatus("idle");
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Buy More Units
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* --- PAYMENT STATUS ALERTS --- */}
        {paymentStatus === "pending" && (
          <Alert className="mb-4 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
            <AlertTitle className="text-blue-800 dark:text-blue-300">
              Processing Payment
            </AlertTitle>
            <AlertDescription className="text-blue-700 dark:text-blue-400">
              <div className="space-y-2">
                <p>Sandbox Mode: Simulating payment processing...</p>
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Checking status... ({pollingCount + 1})</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-1000 ease-out"
                    style={{
                      width: `${Math.min((pollingCount + 1) * 10, 100)}%`,
                    }}
                  />
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {paymentStatus === "success" && !showSuccessModal && (
          <Alert className="mb-4 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertTitle className="text-green-800 dark:text-green-300">
              Payment Initialed Successful!
            </AlertTitle>
            <AlertDescription className="text-green-700 dark:text-green-400">
              {/* Your payment was successful. {unitsPurchased} units have been
              added to your meter. */}
            </AlertDescription>
          </Alert>
        )}

        {paymentStatus === "failed" && (
          <Alert className="mb-4 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
            <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <AlertTitle className="text-red-800 dark:text-red-300">
              Payment Failed
            </AlertTitle>
            <AlertDescription className="text-red-700 dark:text-red-400">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* --- ACCOUNT BALANCE --- */}
        {user?.wallet && (
          <div className="flex justify-center items-center mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 border-border bg-card text-card-foreground text-lg font-light">
              <Wallet className="h-4 w-4" />
              Account Balance: {formatter.format(Number(user.wallet.balance))}
            </div>
          </div>
        )}

        {/* --- FORM --- */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground">
                      Amount (UGX)
                    </FormLabel>
                    <FormControl>
                      <Input
                        disabled={isPending || paymentStatus === "pending"}
                        type="number"
                        placeholder="5000"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value) || 0)
                        }
                        className="bg-background border-input text-foreground placeholder:text-muted-foreground"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold text-foreground">
                      Phone Number
                    </FormLabel>
                    <FormControl>
                      <PhoneInput
                        disabled={isPending || paymentStatus === "pending"}
                        {...field}
                        international
                        defaultCountry="UG"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        inputComponent={ShadInput}
                      />
                    </FormControl>
                    <div className="text-sm text-muted-foreground">
                      Enter your MTN mobile money number
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormError message={error} />
            <FormSuccess message={success} />

            <Button
              type="submit"
              disabled={isPending || paymentStatus === "pending"}
              className="w-full text-white bg-sky-600 hover:bg-sky-700 dark:bg-sky-700 dark:hover:bg-sky-800 dark:text-white transition-colors duration-200"
            >
              {paymentStatus === "pending" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing
                  Payment...
                </>
              ) : (
                <>
                  <Terminal className="mr-2 h-4 w-4" /> Purchase Units
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardWrapper>
    </>
  );
}
