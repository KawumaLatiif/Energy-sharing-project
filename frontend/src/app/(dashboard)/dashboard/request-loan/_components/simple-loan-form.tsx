"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FileTextIcon, Zap, AlertTriangle, Loader2 } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import CardWrapper from "@/components/common/card-wrapper";
import { FormError } from "@/components/common/form-error";
import { FormSuccess } from "@/components/common/form-success";
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { get } from "@/lib/fetch";
import { submitLoanApplication } from "../action";

const SimpleLoanSchema = z.object({
  purpose: z.string().min(10, "Please describe the purpose of the loan"),
  amount_requested: z.number().min(5000, "Minimum loan amount is 5,000 UGX").max(200000, "Maximum loan amount is 200,000 UGX"),
  tenure_months: z.number().min(1, "Tenure must be at least 1 month").max(12, "Tenure cannot exceed 12 months"),
});

type SimpleLoanFormValues = z.infer<typeof SimpleLoanSchema>;

interface SimpleLoanFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function SimpleLoanForm({ onSuccess, onCancel }: SimpleLoanFormProps) {
  const [error, setError] = useState<string | undefined>("");
  const [success, setSuccess] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [hasActiveLoan, setHasActiveLoan] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  const router = useRouter();

  useEffect(() => {
    const checkActiveLoans = async () => {
      try {
        const response = await get<any>('loans/my-loans/');
        if (response.data) {
          const activeLoans = response.data.filter((loan: any) => 
            ['PENDING', 'APPROVED', 'DISBURSED'].includes(loan.status)
          );
          setHasActiveLoan(activeLoans.length > 0);
        }
      } catch (error) {
        console.error('Error checking active loans:', error);
      } finally {
        setIsChecking(false);
      }
    };

    checkActiveLoans();
  }, []);

  const form = useForm<SimpleLoanFormValues>({
    resolver: zodResolver(SimpleLoanSchema),
    defaultValues: {
      purpose: "",
      amount_requested: undefined,
      tenure_months: 1,
    },
  });

  const onSubmit = async (values: SimpleLoanFormValues) => {
    if (hasActiveLoan) {
      setError("You already have an active loan. Please complete repayment before applying for a new one.");
      return;
    }

    setIsPending(true);
    setError("");
    setSuccess("");

    try {
      // Use default values for other required fields
      const fullApplicationData = {
        ...values,
        monthly_expenditure: "100,001–200,000 UGX",
        purchase_frequency: "Monthly",
        payment_consistency: "Often on time",
        disconnection_history: "1–2 disconnections",
        meter_sharing: "No sharing",
        monthly_income: "200,000–499,999 UGX",
        income_stability: "Regular but variable",
        consumption_level: "Moderate (100–200 kWh)"
      };

      const result = await submitLoanApplication(fullApplicationData);

      if (result.data) {
        setSuccess(result.data.message || "Loan application submitted successfully!");
        
        if (onSuccess) {
          setTimeout(() => onSuccess(), 2000);
        } else {
          setTimeout(() => {
            router.push('/dashboard/myloans');
          }, 2000);
        }
      } else if (result.error) {
        setError(result.error);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while submitting your application.');
    } finally {
      setIsPending(false);
    }
  };

  if (isChecking) {
    return (
      <CardWrapper title="Apply for Electricity Loan">
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mr-3" />
          <span>Checking your loan status...</span>
        </div>
      </CardWrapper>
    );
  }

  if (hasActiveLoan) {
    return (
      <CardWrapper title="Apply for Electricity Loan">
        <Alert className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Active Loan Found</AlertTitle>
          <AlertDescription>
            You already have an active loan. Please complete repayment before applying for a new one.
          </AlertDescription>
        </Alert>
        <div className="flex gap-2">
          <Button onClick={onCancel} variant="outline" className="flex-1">
            Cancel
          </Button>
          <Button onClick={() => router.push('/dashboard/myloans')} className="flex-1">
            View My Loans
          </Button>
        </div>
      </CardWrapper>
    );
  }

  return (
    <CardWrapper title="Quick Loan Application">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="purpose"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Purpose of Loan</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g., To purchase electricity units for household use"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="amount_requested"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount Requested (UGX)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="Enter amount (5,000 - 200,000 UGX)"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="tenure_months"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Expected Repayment Period (Months)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="Enter period (1 - 12 months)"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 6)}
                  />
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
                  Submitting...
                </>
              ) : (
                "Submit Application"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </CardWrapper>
  );
}