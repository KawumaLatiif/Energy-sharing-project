"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, Shield, CheckCircle, Zap, Lock } from "lucide-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import CardWrapper from "@/components/common/card-wrapper";
import { FormError } from "@/components/common/form-error";
import { FormSuccess } from "@/components/common/form-success";
import { useRouter } from "next/navigation";
import { get, post } from "@/lib/fetch";
import { getApiErrorMessage } from "@/lib/api-response";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { BreakdownCard } from "@/components/ui/breakdown-card";
import { InfoBanner } from "@/components/ui/info-banner";

const ShareSchema = z.object({
  meter_number: z
    .string()
    .min(10, "Meter number must be 10 digits")
    .max(10, "Meter number must be 10 digits")
    .regex(/^\d+$/, "Meter number must contain only digits"),
  units: z
    .number()
    .min(2, "Minimum units should be greater than 2 units")
    .max(1000, "Cannot share more than 1000 units at once"),
});

type ShareFormValues = z.infer<typeof ShareSchema>;

type WalletBalanceResponse = {
  success: boolean;
  wallet?: { balance?: string };
  meters?: Array<{
    is_active?: boolean;
    balance?: string;
    meter_number?: string;
    architecture?: string;
    pending_units?: string;
  }>;
};

type ShareUnitsResponse = {
  success?: boolean;
  error?: string;
  transaction_ref?: string;
  receiver_architecture?: string;
  receiver_pending_units?: number;
};

interface ShareFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function ShareForm({ onSuccess, onCancel }: ShareFormProps) {
  const [error, setError] = useState<string | undefined>("");
  const [success, setSuccess] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [standardUnits, setStandardUnits] = useState<number>(0);
  const [lifelineUnits, setLifelineUnits] = useState<number>(0);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [verificationStep, setVerificationStep] = useState(0);
  const [verificationCode, setVerificationCode] = useState("");
  const [transactionRef, setTransactionRef] = useState<string | null>(null);
  const [transactionDetails, setTransactionDetails] = useState<any>(null);
  const [receiverArch, setReceiverArch] = useState<string | null>(null);

  const router = useRouter();

  const fetchBalance = async () => {
    try {
      const response = await get<WalletBalanceResponse>("wallet/balance");

      if (!response.error && response.data?.success) {
        const apiData = response.data;
        const meters = apiData.meters || [];

        const activeMeter = meters.find(m => m.is_active) || meters[0];
        const totalBalance = activeMeter
          ? parseFloat(activeMeter.balance || "0")
          : parseFloat(apiData.wallet?.balance || "0");

        // Pilot: lifeline block = first 15 kWh of balance (non-shareable)
        // Standard = rest (shareable). Real computation is done server-side;
        // this is a display-only approximation.
        const lifeline = Math.min(totalBalance, 15);
        const standard = Math.max(0, totalBalance - lifeline);
        setLifelineUnits(lifeline);
        setStandardUnits(standard);
      } else {
        setError(getApiErrorMessage(response.error, "Failed to load balance. Please refresh."));
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsLoadingBalance(false);
    }
  };

  useEffect(() => {
    fetchBalance();
  }, []);

  const form = useForm<ShareFormValues>({
    resolver: zodResolver(ShareSchema),
    defaultValues: { meter_number: "", units: 2 },
  });

  const totalBalance = standardUnits + lifelineUnits;

  const handleInitialSubmit = async (data: ShareFormValues) => {
    if (data.units > standardUnits) {
      setError(
        `You can only share Standard Block units (${standardUnits.toFixed(2)} kWh). ` +
        `Lifeline units (${lifelineUnits.toFixed(2)} kWh) are for personal use only.`
      );
      return;
    }

    setIsPending(true);
    setError("");
    setSuccess("");

    try {
      const response = await post<ShareUnitsResponse>("share/share-units/", {
        meter_number: data.meter_number,
        units: data.units,
      });

      if (response.data?.success === true) {
        setTransactionRef(response.data.transaction_ref || null);
        setReceiverArch(response.data.receiver_architecture || null);
        setTransactionDetails({
          meter_number: data.meter_number,
          units: data.units,
          newStandard: standardUnits - data.units,
          receiverArch: response.data.receiver_architecture || null,
        });
        setSuccess("Verification code sent to your email!");
        setVerificationStep(1);
      } else {
        setError(
          response.data?.error ||
          getApiErrorMessage(response.error, "Failed to initiate share")
        );
      }
    } catch (error: any) {
      setError(error.message || "An error occurred");
    } finally {
      setIsPending(false);
    }
  };

  const handleVerificationSubmit = async () => {
    if (verificationCode.length !== 6) {
      setError("Please enter a 6-digit verification code");
      return;
    }
    if (!transactionDetails) {
      setError("No transaction details found. Please start over.");
      return;
    }

    setIsPending(true);
    setError("");
    setSuccess("");

    try {
      const response = await post<ShareUnitsResponse>("share/share-units/", {
        meter_number: transactionDetails.meter_number,
        units: transactionDetails.units,
        verification_code: verificationCode,
        transaction_ref: transactionRef,
      });

      if (response.status >= 200 && response.status < 300 && response.data?.success) {
        setSuccess("Units shared successfully!");
        setVerificationStep(2);

        setStandardUnits(transactionDetails.newStandard);

        setTimeout(() => {
          form.reset();
          setVerificationStep(0);
          setVerificationCode("");
          setTransactionRef(null);
          setTransactionDetails(null);
          if (onSuccess) onSuccess();
          fetchBalance();
        }, 4000);
      } else {
        setError(
          response.data?.error ||
          getApiErrorMessage(response.error, "Failed to verify code")
        );
      }
    } catch (error: any) {
      setError(error.message || "An error occurred");
    } finally {
      setIsPending(false);
    }
  };

  const handleCancelVerification = () => {
    setVerificationStep(0);
    setVerificationCode("");
    setTransactionRef(null);
    setTransactionDetails(null);
    setError("");
  };

  return (
    <CardWrapper title="Share Units">
      {/* Balance display — Standard vs Lifeline split */}
      <div className="mb-4 space-y-3">
        {isLoadingBalance ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading balance…
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-border p-3 text-center space-y-0.5">
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <Zap className="w-3 h-3 text-primary" />
                Shareable (Standard)
              </div>
              <div className="font-bold text-base tabular-nums">{standardUnits.toFixed(2)} kWh</div>
            </div>
            <div className="rounded-lg border border-border p-3 text-center space-y-0.5 bg-muted/40">
              <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
                <Lock className="w-3 h-3" />
                Lifeline (Personal)
              </div>
              <div className="font-bold text-base tabular-nums text-muted-foreground">{lifelineUnits.toFixed(2)} kWh</div>
            </div>
          </div>
        )}

        <InfoBanner>
          Only Standard Block units can be shared. Lifeline units (first 15 kWh of your balance) are reserved for your personal consumption.
        </InfoBanner>

        <Separator />
      </div>

      {verificationStep === 0 && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleInitialSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="meter_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Receiver&apos;s Meter Number</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 0838123456" {...field} maxLength={10} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="units"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Units to Share (kWh)</FormLabel>
                  <FormControl>
                    <div className="space-y-2">
                      <Input
                        type="number"
                        min="2"
                        max={standardUnits}
                        step="0.01"
                        placeholder="Enter units"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Shield className="h-3 w-3" />
                        <span>Min: 2 kWh · Max: {standardUnits.toFixed(2)} kWh (your shareable balance)</span>
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormError message={error} />
            <FormSuccess message={success} />

            <div className="flex gap-2">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel} className="flex-1" disabled={isPending}>
                  Cancel
                </Button>
              )}
              <Button
                type="submit"
                disabled={isPending || standardUnits < 2}
                className="flex-1 gpawa-gradient text-white"
              >
                {isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
                ) : (
                  "Share Units"
                )}
              </Button>
            </div>
          </form>
        </Form>
      )}

      {verificationStep === 1 && (
        <div className="space-y-4">
          <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800/40">
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <strong>Security Verification Required</strong>
              <p className="mt-1 text-sm text-muted-foreground">
                A 6-digit code has been sent to your registered email address. Enter it below to confirm.
              </p>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <label className="text-sm font-medium">Verification Code</label>
            <Input
              type="text"
              placeholder="Enter 6-digit code"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              maxLength={6}
              className="text-center text-lg font-mono tracking-widest"
            />
          </div>

          {transactionDetails && (
            <BreakdownCard
              rows={[
                { label: "To Meter", value: transactionDetails.meter_number },
                { label: "Units", value: `${transactionDetails.units} kWh` },
                { label: "Your Remaining", value: `${transactionDetails.newStandard.toFixed(2)} kWh` },
              ]}
              totalLabel="Total Shared"
              totalValue={`${transactionDetails.units} kWh`}
              subline={
                transactionDetails.receiverArch === "STS"
                  ? "Receiver has an STS meter — they will need to activate a token to load units."
                  : transactionDetails.receiverArch === "AMI"
                  ? "Receiver has an AMI meter — units will be applied automatically."
                  : undefined
              }
            />
          )}

          {transactionDetails?.receiverArch === "STS" && (
            <InfoBanner variant="info">
              The recipient will need to generate a token (via &quot;Activate Units&quot;) and enter it on their keypad to load these units.
            </InfoBanner>
          )}

          <FormError message={error} />
          <FormSuccess message={success} />

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleCancelVerification} className="flex-1" disabled={isPending}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleVerificationSubmit}
              disabled={isPending || verificationCode.length !== 6}
              className="flex-1 gpawa-gradient text-white"
            >
              {isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</>
              ) : (
                "Confirm & Share"
              )}
            </Button>
          </div>
        </div>
      )}

      {verificationStep === 2 && (
        <div className="text-center space-y-4 py-4">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
          <h3 className="text-lg font-semibold">Units Shared!</h3>
          <p className="text-muted-foreground">
            {transactionDetails?.units} kWh sent to meter {transactionDetails?.meter_number}
          </p>
          {receiverArch === "STS" && (
            <InfoBanner variant="info">
              Remind the recipient to generate an activation token via &quot;Activate Units&quot; on their dashboard and enter it on their meter keypad.
            </InfoBanner>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => { setVerificationStep(0); setVerificationCode(""); setTransactionDetails(null); }}
              variant="outline"
              className="flex-1"
            >
              Share More
            </Button>
            <Button type="button" onClick={() => router.push("/dashboard")} className="flex-1 gpawa-gradient text-white">
              Dashboard
            </Button>
          </div>
        </div>
      )}
    </CardWrapper>
  );
}
