"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, Shield, CheckCircle } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import CardWrapper from "@/components/common/card-wrapper";
import { FormError } from "@/components/common/form-error";
import { FormSuccess } from "@/components/common/form-success";
import { useRouter } from 'next/navigation';
import { get, post } from "@/lib/fetch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

const ShareSchema = z.object({
  meter_no: z.string()
    .min(10, "Meter number must be 10 digits")
    .max(10, "Meter number must be 10 digits")
    .regex(/^\d+$/, "Meter number must contain only digits"),
  Units_to_share: z.number()
    .min(2, "Minimum units should be greater than 2 units")
    .max(1000, "Cannot share more than 1000 units at once"),
});

type ShareFormValues = z.infer<typeof ShareSchema>;

interface ShareFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function ShareForm({ onSuccess, onCancel }: ShareFormProps) {
  const [error, setError] = useState<string | undefined>("");
  const [success, setSuccess] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [userBalance, setUserBalance] = useState<number | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [verificationStep, setVerificationStep] = useState(0);
  const [verificationCode, setVerificationCode] = useState("");

  const router = useRouter();

  useEffect(() => {
    // Fetch user balance on component mount
    const fetchBalance = async () => {
      try {
        const response = await get<any>('wallet/balance');
        if (response.error === null && response.data) {
          setUserBalance(response.data.balance);
        }
      } catch (error) {
        console.error("Failed to fetch balance:", error);
      } finally {
        setIsLoadingBalance(false);
      }
    };
    
    fetchBalance();
  }, []);

  const form = useForm<ShareFormValues>({
    resolver: zodResolver(ShareSchema),
    defaultValues: {
      meter_no: "",
      Units_to_share: 2,
    },
  });

  const onSubmit = async (data: ShareFormValues) => {
    if (verificationStep === 0) {
      // First step: Show verification
      if (userBalance !== null && data.Units_to_share > userBalance) {
        setError("Insufficient units in your wallet");
        return;
      }
      setVerificationStep(1);
      return;
    }

    if (verificationStep === 1) {
      // Second step: Verify and submit
      if (verificationCode !== "123456") { // In real app, this would come from backend
        setError("Invalid verification code");
        return;
      }
      
      setIsPending(true);
      setError("");
      setSuccess("");

      try {
        const response = await post('/share-units/', {
          meter_number: data.meter_no,
          units: data.Units_to_share.toString(),
          verification_code: verificationCode,
        });

        if (response.error === null && response.data) {
          setSuccess("Units shared successfully!");
          setVerificationStep(2);
          
          // Update local balance
          if (userBalance !== null) {
            setUserBalance(userBalance - data.Units_to_share);
          }
          
          // Reset form after success
          setTimeout(() => {
            form.reset();
            setVerificationStep(0);
            setVerificationCode("");
            if (onSuccess) onSuccess();
          }, 3000);
        } else {
          setError(response.error?.message || "Failed to share units");
          setVerificationStep(0);
        }
      } catch (error: any) {
        setError(error.message || "An error occurred");
        setVerificationStep(0);
      } finally {
        setIsPending(false);
      }
    }
  };

  const handleCancelVerification = () => {
    setVerificationStep(0);
    setVerificationCode("");
    setError("");
  };

  return (
    <CardWrapper 
      title="Share Units to your friend"
      // description="Securely share energy units with other users"
    >
      <div className="mb-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Your Balance:</span>
          {isLoadingBalance ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Badge variant="secondary" className="text-sm font-medium">
              {userBalance !== null ? `${userBalance.toFixed(2)} units` : "N/A"}
            </Badge>
          )}
        </div>
        <Separator />
      </div>

      {verificationStep === 0 && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="meter_no"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Receiver's Meter Number</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., 0838123456"
                      {...field}
                      maxLength={10}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="Units_to_share"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Units to Share</FormLabel>
                  <FormControl>
                    <div className="space-y-2">
                      <Input
                        type="number"
                        min="2"
                        max="1000"
                        step="0.01"
                        placeholder="Enter Units"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Shield className="h-3 w-3" />
                        <span>Minimum: 2 units | Maximum: 1000 units</span>
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
              <Button type="submit" disabled={isPending} className="flex-1">
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Continue to Verification"
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
              For security, please verify this transaction. A verification code has been sent to your registered email.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <label className="text-sm font-medium">Verification Code</label>
            <Input
              type="text"
              placeholder="Enter 6-digit code"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
            />
          </div>

          <div className="bg-muted p-3 rounded-md text-sm">
            <p className="font-medium">Transaction Details:</p>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <span className="text-muted-foreground">To Meter:</span>
              <span>{form.getValues().meter_no}</span>
              <span className="text-muted-foreground">Units:</span>
              <span>{form.getValues().Units_to_share} units</span>
              <span className="text-muted-foreground">Your New Balance:</span>
              <span>
                {userBalance !== null 
                  ? `${(userBalance - form.getValues().Units_to_share).toFixed(2)} units`
                  : "N/A"
                }
              </span>
            </div>
          </div>

          <FormError message={error} />

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
              onClick={() => form.handleSubmit(onSubmit)()}
              disabled={isPending || verificationCode.length !== 6}
              className="flex-1"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
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
            {form.getValues().Units_to_share} units have been successfully shared to meter {form.getValues().meter_no}
          </p>
          <Button
            type="button"
            onClick={() => {
              setVerificationStep(0);
              setVerificationCode("");
            }}
            variant="outline"
          >
            Share More Units
          </Button>
        </div>
      )}
    </CardWrapper>
  );
}