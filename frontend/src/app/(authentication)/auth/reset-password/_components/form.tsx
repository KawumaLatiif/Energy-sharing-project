// app/auth/reset-password/_components/form.tsx
"use client";
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/common/form-error";
import { FormSuccess } from "@/components/common/form-success";
import { validateResetLink, resetPassword } from "../reset";
import { z } from "zod";
import { ResetPasswordSchema } from "@/lib/schema";
import CardWrapper from "@/components/common/card-wrapper";

type ResetPasswordFormData = z.infer<typeof ResetPasswordSchema>;

export default function ResetPasswordForm({
  uid,
  token,
}: {
  uid: string;
  token: string;
}) {
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isValidating, setIsValidating] = useState(true);
  const router = useRouter();

  const form = useForm<ResetPasswordFormData>({
    resolver: zodResolver(ResetPasswordSchema),
    defaultValues: { password: "", confirm_password: "" },
  });

  useEffect(() => {
    validateResetLink(uid, token)
      .then((data) => {
        setIsValidating(false);
        if (data.error) {
          setError(data.error);
          setIsValid(false);
        } else {
          setIsValid(true);
        }
      })
      .catch(() => {
        setIsValidating(false);
        setError("Network error validating link");
        setIsValid(false);
      });
  }, [uid, token]);

  const onSubmit = (values: ResetPasswordFormData) => {
    setError("");
    setSuccess("");
    startTransition(async () => {
      const result = await resetPassword(uid, token, values);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(result.success);
        form.reset();
        setTimeout(() => router.replace(result.redirectTo!), 1500);
      }
    });
  };

  if (isValidating) {
    return (
      <CardWrapper title="Reset Password">
        <div className="flex items-center justify-center py-8">
          Validating reset link...
        </div>
      </CardWrapper>
    );
  }

  if (!isValid) {
    return (
      <CardWrapper title="Reset Password">
        <div className="text-center py-8 text-destructive">
          {error || "Invalid or expired reset link. Please request a new one."}
        </div>
        <Button
          onClick={() => router.push("/auth/forgot-password")}
          className="w-full"
        >
          Request New Link
        </Button>
      </CardWrapper>
    );
  }

  return (
    <CardWrapper title="Reset Password">
      {" "}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New Password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    disabled={isPending || !isValid}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirm_password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirm Password</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    disabled={isPending || !isValid}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormError message={error} />
          <FormSuccess message={success} />
          <Button
            type="submit"
            disabled={isPending || !isValid}
            className="w-full"
          >
            {isPending ? "Resetting..." : "Reset Password"}
          </Button>
        </form>
      </Form>
    </CardWrapper>
  );
}
