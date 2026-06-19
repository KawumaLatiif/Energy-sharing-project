"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition, useEffect, useCallback, useRef } from "react";
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
import { BreakdownCard } from "@/components/ui/breakdown-card";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { BuyUnitSchema } from "@/lib/schema";
import { formatCurrency } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { buyUnits, checkPaymentStatus, type BuyUnitsResponse } from "../buy-units";
import { useAccount } from "@/hooks/use-account";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Link from "next/link";
import { get } from "@/lib/fetch";
import { getApiErrorMessage } from "@/lib/api-response";

function formatUGX(n: number) {
  return `UGX ${Math.round(n).toLocaleString()}`;
}

interface UnitEstimate {
  estimated_units: number;
  tariff?: string | null;
  gross_amount?: number;
  deductions?: number;
  net_amount?: number;
  energy_cost?: number;
  service_charge?: number;
  vat?: number;
  total_bill?: number;
  insufficient_amount?: boolean;
  minimum_payment?: number;
  service_charge_included?: boolean;
}

function buildEstimateRows(estimate: UnitEstimate, grossAmount: number) {
  const rows: { label: string; value: string; muted?: boolean }[] = [
    { label: "Payment amount", value: formatUGX(grossAmount) },
  ];

  if (estimate.deductions && estimate.deductions > 0) {
    rows.push({ label: "Loan repayment", value: `− ${formatUGX(estimate.deductions)}` });
    rows.push({
      label: "Net for energy",
      value: formatUGX(estimate.net_amount ?? grossAmount - estimate.deductions),
    });
  }

  if (estimate.energy_cost != null) {
    rows.push({ label: "Energy charge", value: formatUGX(estimate.energy_cost) });
  }
  if (estimate.service_charge != null && estimate.service_charge > 0) {
    rows.push({
      label: estimate.service_charge_included
        ? "Service charge (monthly)"
        : "Service charge",
      value: formatUGX(estimate.service_charge),
    });
  }
  if (estimate.vat != null) {
    rows.push({ label: "VAT (18%)", value: formatUGX(estimate.vat) });
  }

  return rows;
}

export default function BuyUnitsForm() {
  const formatter = formatCurrency("USD");
  const [error, setError] = useState<string | undefined>("");
  const [success, setSuccess] = useState("");
  const [token, setToken] = useState("");
  const [isPending, startTransition] = useTransition();
  const [paymentStatus, setPaymentStatus] = useState<
    "idle" | "pending" | "success" | "failed"
  >("idle");
  const [loanBlocked, setLoanBlocked] = useState(false);
  const [loanBlockMessage, setLoanBlockMessage] = useState<string | null>(null);
  const [loadingLoans, setLoadingLoans] = useState(true);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [unitsPurchased, setUnitsPurchased] = useState<number | null>(null);
  const [transactionDetails, setTransactionDetails] = useState<any>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [pollingCount, setPollingCount] = useState(0);

  // Estimate state
  const [estimate, setEstimate] = useState<UnitEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const estimateTimeout = useRef<NodeJS.Timeout | null>(null);

  const { user, loading } = useAccount();

  const isPendingBuyUnitsResponse = (
    response: BuyUnitsResponse | undefined
  ): response is Extract<BuyUnitsResponse, { status: "PENDING" }> =>
    typeof response === "object" &&
    response !== null &&
    "status" in response &&
    response.status === "PENDING";

  const form = useForm<z.infer<typeof BuyUnitSchema>>({
    resolver: zodResolver(BuyUnitSchema),
    defaultValues: { amount: 0, phone_number: "" },
  } as any);

  useEffect(() => {
    if (paymentStatus === "success") {
      const timer = setTimeout(() => setShowSuccessModal(true), 5000);
      return () => clearTimeout(timer);
    }
  }, [paymentStatus]);

  // Block buying units when there is any pending/active/incomplete loan
  useEffect(() => {
    const checkLoans = async () => {
      try {
        setLoadingLoans(true);
        const response = await get<any>("loans/stats/");
        if (!response.error && response.data) {
          const hasPending = (response.data.pending_applications ?? 0) > 0;
          const hasActive = (response.data.active_loans ?? 0) > 0;
          const hasOutstanding = Number(response.data.outstanding_balance ?? 0) > 0;
          const hasBlocking = response.data.has_blocking_loan ?? (hasPending || hasActive || hasOutstanding);
          if (hasBlocking) {
            setLoanBlocked(true);
            setLoanBlockMessage(
              "You have a pending or unpaid loan. Please clear your loan before purchasing units."
            );
          } else {
            setLoanBlocked(false);
            setLoanBlockMessage(null);
          }
        }
      } catch (err) {
        console.error("Error checking loan status:", err);
      } finally {
        setLoadingLoans(false);
      }
    };

    checkLoans();
  }, []);

  // Debounced estimate on amount change
  const fetchEstimate = useCallback(async (amount: number) => {
    if (amount < 100) {
      setEstimate(null);
      return;
    }
    setEstimating(true);
    try {
      const res = await get<UnitEstimate>(`meter/estimate-units/?amount=${amount}`);
      if (res.data?.estimated_units != null) {
        setEstimate(res.data);
      } else {
        setEstimate(null);
      }
    } catch {
      setEstimate(null);
    } finally {
      setEstimating(false);
    }
  }, []);

  const handleAmountChange = (value: number) => {
    if (estimateTimeout.current) clearTimeout(estimateTimeout.current);
    estimateTimeout.current = setTimeout(() => fetchEstimate(value), 500);
  };

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

  useEffect(() => {
    if (paymentStatus === "pending") setPollingCount(0);
  }, [paymentStatus]);

  async function onSubmit(values: z.infer<typeof BuyUnitSchema>) {
    setError("");
    setSuccess("");
    setPaymentStatus("pending");
    setTransactionId(null);
    setPollingCount(0);
    setShowConfirm(false);

    startTransition(async () => {
      try {
        const data = await buyUnits(values);

        if (data?.error) {
          setPaymentStatus("failed");
          if (typeof data.error === "object") {
            if (data.error?.amount) {
              form.setError("amount", {
                type: "custom",
                message: Array.isArray(data.error.amount) ? data.error.amount[0] : "Invalid amount",
              });
            }
            if (data.error?.phone_number) {
              form.setError("phone_number", {
                type: "custom",
                message: Array.isArray(data.error.phone_number) ? data.error.phone_number[0] : "Invalid phone number",
              });
            }
          } else setError(getApiErrorMessage(data.error, "Failed to process payment"));
          return;
        }

        const responseData = data.data;

        if (isPendingBuyUnitsResponse(responseData)) {
          setTransactionId(
            responseData.transaction_id !== undefined
              ? String(responseData.transaction_id)
              : null
          );
          setSuccess(
            responseData.user_prompt || "Simulating payment... Please wait"
          );
        } else if (responseData?.token) {
          setPaymentStatus("success");
          setUnitsPurchased(parseFloat(responseData["Units purchased"]) || 0);
          setToken(responseData.token || "");
          setTransactionDetails(responseData.transaction || responseData || null);
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

  const amount = form.watch("amount");
  const phone = form.watch("phone_number");

  const handleReviewClick = async () => {
    const valid = await form.trigger();
    if (!valid) return;
    if (!estimate && amount >= 100) await fetchEstimate(Number(amount));
    setShowConfirm(true);
  };

  if (loading || loadingLoans) return null;

  return (
    <>
      <CardWrapper title="Buy Units">
        {/* --- SUCCESS MODAL --- */}
        <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
          <DialogContent className="sm:max-w-md bg-background border-border">
            <DialogHeader>
              <DialogTitle className="text-green-600 dark:text-green-400 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Payment Successful!
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Units have been successfully purchased
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <BreakdownCard
                rows={[
                  { label: "Amount Paid", value: formatUGX(transactionDetails?.amount ?? 0) },
                  { label: "Units Purchased", value: `${unitsPurchased ?? 0} kWh` },
                  { label: "Status", value: "Completed" },
                  ...(transactionDetails?.timestamp
                    ? [{ label: "Date", value: new Date(transactionDetails.timestamp).toLocaleString(), muted: true }]
                    : []),
                ]}
                totalLabel="Units Added"
                totalValue={`${unitsPurchased ?? 0} kWh`}
              />

              {token && (
                <Alert className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                  <Terminal className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <AlertTitle className="text-blue-800 dark:text-blue-300">
                    STS Token — enter on meter keypad
                  </AlertTitle>
                  <AlertDescription className="text-blue-700 dark:text-blue-400 break-all font-mono text-lg tracking-widest">
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
                    setEstimate(null);
                  }}
                  className="flex-1 gpawa-gradient text-white"
                >
                  Done
                </Button>
                <Button
                  onClick={() => {
                    setShowSuccessModal(false);
                    form.reset();
                    setPaymentStatus("idle");
                    setEstimate(null);
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Buy More
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* --- CONFIRM BOTTOM SHEET --- */}
        <BottomSheet
          open={showConfirm}
          onClose={() => setShowConfirm(false)}
          title="Confirm Purchase"
          primaryAction={{
            label: "Pay Now",
            onClick: form.handleSubmit(onSubmit),
            loading: isPending || paymentStatus === "pending",
          }}
        >
          <BreakdownCard
            rows={[
              ...(estimate
                ? buildEstimateRows(estimate, Number(amount))
                : [{ label: "Payment amount", value: formatUGX(Number(amount)) }]),
              { label: "Payment Method", value: "MTN Mobile Money" },
              { label: "Phone", value: phone || "—" },
            ]}
            totalLabel="You Pay"
            totalValue={formatUGX(Number(amount))}
            subline={
              estimate
                ? `Estimated yield: ${estimate.estimated_units} kWh (ERA Code 10.1)`
                : undefined
            }
          />
        </BottomSheet>

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
                    style={{ width: `${Math.min((pollingCount + 1) * 10, 100)}%` }}
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
              Payment Initiated Successfully!
            </AlertTitle>
            <AlertDescription className="text-green-700 dark:text-green-400" />
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

        {loanBlocked && (
          <Alert className="mb-4 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
            <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <AlertTitle className="text-red-800 dark:text-red-300">
              Loan Payment Required
            </AlertTitle>
            <AlertDescription className="text-red-700 dark:text-red-400">
              {loanBlockMessage}
              <div className="mt-3">
                <Button asChild size="sm" variant="outline">
                  <Link href="/dashboard/myloans">Go to Loans</Link>
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* --- FORM --- */}
        <div className={loanBlocked ? "opacity-50 pointer-events-none" : ""}>
          <Form {...form}>
            <form className="space-y-6">
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-foreground">Amount (UGX)</FormLabel>
                      <FormControl>
                        <Input
                          disabled={isPending || paymentStatus === "pending"}
                          type="number"
                          placeholder="5000"
                          {...field}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            field.onChange(val);
                            handleAmountChange(val);
                          }}
                          className="bg-background border-input text-foreground placeholder:text-muted-foreground"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Live estimate */}
                {(estimating || estimate != null) && Number(amount) >= 100 && (
                  <div className="space-y-2">
                    <BreakdownCard
                      rows={
                        estimate
                          ? buildEstimateRows(estimate, Number(amount))
                          : [{ label: "Payment amount", value: formatUGX(Number(amount)) }]
                      }
                      totalLabel="You Get"
                      totalValue={estimating ? "…" : `${estimate?.estimated_units ?? 0} kWh`}
                      subline={
                        estimate?.tariff
                          ? `ERA domestic tariff (${estimate.tariff}) — tiered blocks incl. service & VAT`
                          : "Based on ERA domestic tariff (Code 10.1)"
                      }
                    />
                    {!estimating &&
                      estimate?.insufficient_amount &&
                      estimate.minimum_payment != null && (
                        <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2">
                          {estimate.service_charge_included
                            ? `Your first purchase this month includes a fixed service charge and VAT. `
                            : ``}
                          Enter at least{" "}
                          <strong>{formatUGX(Math.ceil(estimate.minimum_payment))}</strong> to
                          receive any units. STS mode uses the same ERA tariff — only the
                          token delivery method differs.
                        </p>
                      )}
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="phone_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold text-foreground">
                        MTN Mobile Money Number
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
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormError message={paymentStatus !== "failed" ? error : undefined} />
              <FormSuccess message={success} />

              <Button
                type="button"
                onClick={handleReviewClick}
                disabled={isPending || paymentStatus === "pending"}
                className="w-full gpawa-gradient text-white font-semibold"
              >
                {paymentStatus === "pending" ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…
                  </>
                ) : (
                  <>
                    <Terminal className="mr-2 h-4 w-4" /> Review & Pay
                  </>
                )}
              </Button>
            </form>
          </Form>
        </div>
      </CardWrapper>
    </>
  );
}
