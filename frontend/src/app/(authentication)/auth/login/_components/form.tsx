// app/auth/login/_components/form.tsx
'use client';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FormError } from '@/components/common/form-error';
import { FormSuccess } from '@/components/common/form-success';
import { login } from '../login';
import { resendVerificationEmail } from '../../resend';
import { LoginSchema } from '@/lib/schema';
import { useRouter, useSearchParams } from 'next/navigation';
import CardWrapper from '@/components/common/card-wrapper';
import Link from 'next/link';
import { z } from 'zod';

export default function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl');
  const router = useRouter();
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [showResend, setShowResend] = useState(false);
  const [emailForResend, setEmailForResend] = useState('');
  const [isPending, startTransition] = useTransition();
  const [resendLoading, setResendLoading] = useState(false);
  const [cooldown, setCooldown] = useState<number>(0);
  const form = useForm<z.infer<typeof LoginSchema>>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: '', password: '' },
  });
  async function onSubmit(values: z.infer<typeof LoginSchema>) {
    setError('');
    setShowResend(false);

    const result = await login(values);
    if (result.success) {
      window.location.href = result.redirectTo || '/dashboard';
    } else if (result.error === 'EMAIL_NOT_VERIFIED') {
      setError(result.message || 'Please verify your email first');
      setShowResend(true);
      setEmailForResend(values.email);
    } else {
      setError('wrong credentials. try again');
    }
  };

    const handleResendVerification = async () => {
    if (!emailForResend) return;

    // You would implement this function similar to the one in verify-email
    const result = await resendVerificationEmail(emailForResend);

    if (result.success) {
      setError('Verification email sent. Please check your inbox.');
      setShowResend(false);
    } else {
      setError(result.error || 'Failed to resend verification email');
    }
  };

  return (
    <CardWrapper title="Sign in to your account">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {showTwoFactor && (
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Two Factor Code</FormLabel>
                  <FormControl>
                    <Input {...field} disabled={isPending} placeholder="123456" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          {!showTwoFactor && (
            <>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input disabled={isPending} type="email" autoComplete="email" placeholder="johndoe@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input disabled={isPending} type="password" autoComplete="password" placeholder="Password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                    Remember me
                  </label>
                </div>
                <div className="text-sm">
                  <Link href="/auth/forgot-password" className="font-medium text-indigo-600 hover:text-indigo-500">
                    Forgot your password?
                  </Link>
                </div>
              </div>
            </>
          )}
          <FormError message={error} />
          <FormSuccess message={success} />
          <Button type="submit" disabled={isPending} className="w-full text-white dark:text-gray-900 bg-sky-500 dark:bg-white">
            {showTwoFactor ? 'Confirm' : 'Login'}
          </Button>
        </form>
        {/* <Button type="button" variant="link" onClick={handleResend} disabled={isPending}>
          Resend Verification Email
        </Button> */}
      </Form>{error && (
        <div className="error-message">
          {/* {error} */}
          {showResend && (
            <Button onClick={handleResendVerification} className="ml-2 text-blue-600">
              Resend verification email
            </Button>
          )}
        </div>
      )}
    </CardWrapper>
  );
}