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

const ShareSchema = z.object({
  meter_no: z.string().min(10, "Please Enter the receiver meter number"),
  Units_to_share: z.number().min(2, "Minimum units should be greater than 2 units"),
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
  const [hasUnits, setHasUnits] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  const router = useRouter();


  const form = useForm<ShareFormValues>({
    resolver: zodResolver(ShareSchema),
    defaultValues: {
      meter_no: "",
      Units_to_share: 2,
    },
  });

  return (
    <CardWrapper title="Share Units to your friend">
      <Form {...form}>
        <form className="space-y-4">
          <FormField
            control={form.control}
            name="meter_no"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Meter Number</FormLabel>
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
            name="Units_to_share"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Units to Share</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="Enter Units"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
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