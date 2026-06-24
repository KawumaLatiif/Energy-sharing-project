"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, Shield, CheckCircle, Zap, User, Phone, Hash, Cpu, ArrowLeft } from "lucide-react";
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
import { get, post } from "@/lib/fetch-client";
import { getApiErrorMessage } from "@/lib/api-response";
import { useSelectedMeter } from "@/app/(dashboard)/dashboard/_components/selected-meter-context";
import { WALLET_BALANCE_UPDATED } from "@/lib/wallet-events";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { BreakdownCard } from "@/components/ui/breakdown-card";
import { InfoBanner } from "@/components/ui/info-banner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Badge } from "@/components/ui/badge";
import {
  isValidMeterNumber,
  METER_NO_MAX_LENGTH,
  meterNumberFieldSchema,
} from "@/lib/meter-validation";

function createShareSchema(maxUnits: number) {
  const cap = Math.max(maxUnits, 2);
  return z.object({
    meter_number: meterNumberFieldSchema(),
    units: z
      .number()
      .min(2, "Minimum share is 2 kWh")
      .max(
        cap,
        cap > 2
          ? `Cannot share more than your available balance (${cap.toFixed(2)} kWh)`
          : "Insufficient wallet balance to share"
      ),
  });
}

type ShareFormValues = z.infer<ReturnType<typeof createShareSchema>>;

type WalletBalanceResponse = {
  success: boolean;
  wallet?: { balance?: string };
  wallet_balance?: string;
  meters?: Array<{ is_active?: boolean; balance?: string; meter_number?: string }>;
  primary_meter?: { meter_number?: string; balance?: string; is_active?: boolean };
  total_meter_units?: string;
};

type ShareUnitsResponse = {
  success?: boolean;
  error?: string;
  transaction_ref?: string;
  receiver_architecture?: string;
};

type ShareRecipientPreview = {
  name: string;
  meter_number: string;
  meter_type: string;
  meter_type_label: string;
  phone_number: string;
};

type SharePreviewResponse = {
  success?: boolean;
  error?: string;
  recipient?: ShareRecipientPreview;
  delivery_method?: string;
};

interface ShareFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  onBack?: () => void;
}

export default function ShareForm({ onSuccess, onCancel, onBack }: ShareFormProps) {
  const [error, setError] = useState<string | undefined>("");
  const [success, setSuccess] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [totalUnits, setTotalUnits] = useState<number>(0);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [verificationStep, setVerificationStep] = useState(0);
  const [verificationCode, setVerificationCode] = useState("");
  const [transactionRef, setTransactionRef] = useState<string | null>(null);
  const [transactionDetails, setTransactionDetails] = useState<any>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingShare, setPendingShare] = useState<ShareFormValues | null>(null);
  const [recipientPreview, setRecipientPreview] = useState<ShareRecipientPreview | null>(null);
  const [deliveryMethod, setDeliveryMethod] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [meterPreview, setMeterPreview] = useState<ShareRecipientPreview | null>(null);
  const [meterPreviewError, setMeterPreviewError] = useState("");

  const router = useRouter();
  const { walletBalance, refreshWallet } = useSelectedMeter();

  useEffect(() => {
    setTotalUnits(walletBalance);
    setIsLoadingBalance(false);
  }, [walletBalance]);

  const fetchBalance = async () => {
    setIsLoadingBalance(true);
    setError("");
    try {
      await refreshWallet();
      const response = await get<WalletBalanceResponse>("wallet/balance");
      if (response.error || !response.data?.success) {
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
    const onWalletUpdate = () => {
      void refreshWallet();
    };
    window.addEventListener(WALLET_BALANCE_UPDATED, onWalletUpdate);
    return () => window.removeEventListener(WALLET_BALANCE_UPDATED, onWalletUpdate);
  }, [refreshWallet]);

  const shareSchema = useMemo(() => createShareSchema(totalUnits), [totalUnits]);

  const form = useForm<ShareFormValues>({
    resolver: zodResolver(shareSchema),
    defaultValues: {
      meter_number: "",
      units: 2,
    },
  });

  const watchedMeter = form.watch("meter_number");

  useEffect(() => {
    const meter = (watchedMeter || "").trim();
    if (!isValidMeterNumber(meter)) {
      setMeterPreview(null);
      setMeterPreviewError("");
      setDeliveryMethod("");
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const preview = await get<SharePreviewResponse>(
          `share/receiver-preview/?meter_number=${encodeURIComponent(meter)}`
        );
        if (!preview.error && preview.data?.success && preview.data.recipient) {
          setMeterPreview(preview.data.recipient);
          setDeliveryMethod(preview.data.delivery_method || "");
          setMeterPreviewError("");
        } else {
          setMeterPreview(null);
          setMeterPreviewError(
            preview.data?.error ??
              getApiErrorMessage(preview.error, "Receiver meter not found.")
          );
        }
      } catch {
        setMeterPreview(null);
        setMeterPreviewError("");
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [watchedMeter]);

  const handleFormSubmit = async (data: ShareFormValues) => {
    if (data.units > totalUnits) {
      setError(`You only have ${totalUnits.toFixed(2)} kWh available to share.`);
      return;
    }

    setError("");
    setPreviewLoading(true);

    try {
      const preview = await get<SharePreviewResponse>(
        `share/receiver-preview/?meter_number=${encodeURIComponent(data.meter_number)}`
      );

      if (preview.error || !preview.data?.success || !preview.data.recipient) {
        setError(
          preview.data?.error ||
            getApiErrorMessage(preview.error, "Could not find receiver meter.")
        );
        return;
      }

      setPendingShare(data);
      setRecipientPreview(preview.data.recipient);
      setDeliveryMethod(preview.data.delivery_method || "");
      setConfirmOpen(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const confirmAndInitiateShare = async () => {
    if (!pendingShare) return;

    setIsPending(true);
    setError("");
    setSuccess("");

    try {
      const response = await post<ShareUnitsResponse>("share/share-units/", {
        meter_number: pendingShare.meter_number,
        units: pendingShare.units,
      });

      if (response.data?.success === true) {
        setConfirmOpen(false);
        setTransactionRef(response.data.transaction_ref || null);
        setTransactionDetails({
          meter_number: pendingShare.meter_number,
          units: pendingShare.units,
          newBalance: totalUnits - pendingShare.units,
          receiverArch: response.data.receiver_architecture || recipientPreview?.meter_type || null,
          recipientName: recipientPreview?.name,
          recipientPhone: recipientPreview?.phone_number,
        });
        setSuccess("Verification code sent to your email!");
        setVerificationStep(1);
        setPendingShare(null);
      } else {
        setError(
          response.data?.error ||
            getApiErrorMessage(response.error, "Failed to initiate share")
        );
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "An error occurred";
      setError(message);
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
        setTotalUnits(transactionDetails.newBalance);

        setTimeout(() => {
          form.reset();
          setVerificationStep(0);
          setVerificationCode("");
          setTransactionRef(null);
          setTransactionDetails(null);
          setRecipientPreview(null);
          if (onSuccess) onSuccess();
          fetchBalance();
        }, 3000);
      } else {
        setError(
          response.data?.error ||
            getApiErrorMessage(response.error, "Failed to verify code")
        );
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "An error occurred";
      setError(message);
    } finally {
      setIsPending(false);
    }
  };

  const handleCancelVerification = () => {
    setVerificationStep(0);
    setVerificationCode("");
    setTransactionRef(null);
    setTransactionDetails(null);
    setRecipientPreview(null);
    setError("");
  };

  return (
    <>
      <CardWrapper title="Share Units" maxWidth="xl">
        {onBack && (
          <Button type="button" variant="ghost" size="sm" className="mb-4 -ml-2" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to menu
          </Button>
        )}
        <InfoBanner variant="info">
          Share kWh from your wallet to another person&apos;s meter. STS meters receive a
          keypad token; AMI meters receive units on the device directly.
        </InfoBanner>
        <div className="mb-4 mt-4 space-y-3">
          {isLoadingBalance ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading balance…
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Zap className="w-4 h-4 text-primary" />
                Available to share
              </div>
              <span className="font-bold text-base tabular-nums">{totalUnits.toFixed(2)} kWh</span>
            </div>
          )}
          <Separator />
        </div>

        {verificationStep === 0 && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="meter_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Receiver&apos;s Meter Number</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., EM_SRT002"
                      {...field}
                      maxLength={METER_NO_MAX_LENGTH}
                    />
                  </FormControl>
                  {meterPreview && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Badge variant={meterPreview.meter_type === "AMI" ? "default" : "secondary"}>
                        {meterPreview.meter_type === "AMI" ? "AMI — direct to device" : "STS — token will be generated"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{meterPreview.name}</span>
                    </div>
                  )}
                  {meterPreviewError && (
                    <p className="text-xs text-destructive">{meterPreviewError}</p>
                  )}
                  {deliveryMethod && meterPreview && (
                    <p className="text-xs text-muted-foreground">{deliveryMethod}</p>
                  )}
                  <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="units"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Units to Share</FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        <Input
                          type="number"
                          min="2"
                          max={totalUnits}
                          step="0.01"
                          placeholder="Enter Units"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value) || 0)
                          }
                        />
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Shield className="h-3 w-3" />
                          <span>Min: 2 kWh · Max: {totalUnits.toFixed(2)} kWh (your balance)</span>
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
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onCancel}
                    className="flex-1"
                    disabled={isPending || previewLoading}
                  >
                    Cancel
                  </Button>
                )}
                <Button
                  type="submit"
                  disabled={isPending || previewLoading || totalUnits < 2}
                  className="flex-1 gpawa-gradient text-white"
                >
                  {previewLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Checking meter…
                    </>
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
            <Alert className="bg-blue-50 border-blue-200">
              <Shield className="h-4 w-4" />
              <AlertDescription>
                <strong className="text-blue-800">Security Verification Required</strong>
                <p className="mt-1 text-sm text-muted-foreground">
                  A verification code has been sent to your registered email address.
                  Please enter the 6-digit code below to complete the transaction.
                </p>
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <label className="text-sm font-medium">Verification Code</label>
              <Input
                type="text"
                placeholder="Enter 6-digit code"
                value={verificationCode}
                onChange={(e) =>
                  setVerificationCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                maxLength={6}
                className="text-center text-lg font-mono tracking-widest"
              />
              <p className="text-xs text-muted-foreground">
                Check your email for the verification code
              </p>
            </div>

            {transactionDetails && (
              <BreakdownCard
                rows={[
                  ...(transactionDetails.recipientName
                    ? [{ label: "Recipient", value: transactionDetails.recipientName }]
                    : []),
                  { label: "To Meter", value: transactionDetails.meter_number },
                  { label: "Units", value: `${transactionDetails.units} kWh` },
                  { label: "Your Remaining", value: `${transactionDetails.newBalance.toFixed(2)} kWh` },
                ]}
                totalLabel="Total Shared"
                totalValue={`${transactionDetails.units} kWh`}
                subline={
                  transactionDetails.receiverArch === "STS"
                    ? "An STS token will be generated and sent to the recipient."
                    : transactionDetails.receiverArch === "AMI"
                    ? "Units will be applied to the AMI meter device via ThingsBoard."
                    : undefined
                }
              />
            )}

          {transactionDetails?.receiverArch === "STS" && (
            <InfoBanner variant="info">
              After verification, an STS keypad token is created and emailed to the recipient.
            </InfoBanner>
          )}

            <FormError message={error} />
            <FormSuccess message={success} />

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelVerification}
                className="flex-1"
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleVerificationSubmit}
                disabled={isPending || verificationCode.length !== 6}
                className="flex-1"
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
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
            <h3 className="text-lg font-semibold">Success!</h3>
            <p className="text-muted-foreground">
              {transactionDetails?.units} units have been successfully shared to meter {transactionDetails?.meter_number}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={() => {
                  setVerificationStep(0);
                  setVerificationCode("");
                  setTransactionDetails(null);
                }}
                variant="outline"
                className="flex-1"
              >
                Share More Units
              </Button>
              <Button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="flex-1"
              >
                Go to Dashboard
              </Button>
            </div>
          </div>
        )}
      </CardWrapper>

      <Dialog open={confirmOpen} onOpenChange={(open) => !isPending && setConfirmOpen(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm share</DialogTitle>
            <DialogDescription>
              Review recipient details before we send a verification code to your email.
            </DialogDescription>
          </DialogHeader>

          {recipientPreview && pendingShare && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 divide-y">
                <ReceiptRow icon={<User className="h-4 w-4" />} label="Name" value={recipientPreview.name} />
                <ReceiptRow icon={<Hash className="h-4 w-4" />} label="Meter number" value={recipientPreview.meter_number} />
                <ReceiptRow icon={<Cpu className="h-4 w-4" />} label="Meter type" value={recipientPreview.meter_type_label} />
                <ReceiptRow icon={<Phone className="h-4 w-4" />} label="Phone" value={recipientPreview.phone_number} />
                <ReceiptRow icon={<Zap className="h-4 w-4" />} label="Units to share" value={`${pendingShare.units} kWh`} highlight />
              </div>

              {deliveryMethod && (
                <InfoBanner variant="info">
                  {deliveryMethod}
                </InfoBanner>
              )}
            </div>
          )}

          <FormError message={error} />

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={confirmAndInitiateShare}
              disabled={isPending}
              className="gpawa-gradient text-white"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending code…
                </>
              ) : (
                "Confirm & continue"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ReceiptRow({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span className="text-muted-foreground mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-sm font-medium truncate ${highlight ? "text-primary text-base" : ""}`}>
          {value}
        </p>
      </div>
    </div>
  );
}
