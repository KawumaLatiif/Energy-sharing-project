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

const TransferSchema = z.object({
  meter_no_old: z.string().min(10, "Please Enter the receiver meter number").max(10, "wrong account number"),
  meter_no_new: z.string().min(10, "Please Enter the receiver meter number").max(10, "wrong account number"),
});

type TransferFormValues = z.infer<typeof TransferSchema>;

interface TransferFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function TransferForm({ onSuccess, onCancel }: TransferFormProps) {
  const [error, setError] = useState<string | undefined>("");
  const [success, setSuccess] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [hasUnits, setHasUnits] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  const router = useRouter();


  const form = useForm<TransferFormValues>({
    resolver: zodResolver(TransferSchema),
    defaultValues: {
      meter_no_old: "",
      meter_no_new: "",
    },
  });

  return (
    <CardWrapper title="Transfer Units to your new account">
      <Form {...form}>
        <form className="space-y-4">
          <FormField
            control={form.control}
            name="meter_no_old"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Old Meter Number</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g., 0838xxxxxxx"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        <FormField
            control={form.control}
            name="meter_no_new"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New Meter Number</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g., 2438xxxxxxx"
                    {...field}
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