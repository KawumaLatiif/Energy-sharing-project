// app/auth/reset-password/_components/form.tsx
'use client';
import { useEffect, useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/common/form-error';
import { FormSuccess } from '@/components/common/form-success';
import { validateResetLink, resetPassword } from '../reset';
import { z } from 'zod';
const ResetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string().min(8, 'Confirm password must be at least 8 characters'),
}).refine((data) => data.password === data.confirm_password, {
  message: 'Passwords mismatch',
  path: ['confirm_password'],
});
export default function ResetPasswordForm({ uid, token }: { uid: string; token: string }) {
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const form = useForm<z.infer<typeof ResetPasswordSchema>>({
    resolver: zodResolver(ResetPasswordSchema),
    defaultValues: { password: '', confirm_password: '' },
  });
  useEffect(() => {
    validateResetLink(uid, token).then((data) => {
      if (data.error) setError(error);
    });
  }, [uid, token]);
  const onSubmit = (values: z.infer<typeof ResetPasswordSchema>) => {
    startTransition(async () => {
      const result = await resetPassword(uid, token, values);
      if (result.error) {
        setError(result.error);
      } else {
        setSuccess("");
        // setTimeout(() => router.push(result.redirectTo), 2000);
      }
    });
  };
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New Password</FormLabel>
              <FormControl>
                <Input type="password" disabled={isPending} {...field} />
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
                <Input type="password" disabled={isPending} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormError message={error} />
        <FormSuccess message={success} />
        <Button type="submit" disabled={isPending} className="w-full">
          Reset Password
        </Button>
      </form>
    </Form>
  );
}