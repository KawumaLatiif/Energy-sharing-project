// app/auth/reset-password/reset.ts
'use server';
import { get, patch } from '@/lib/fetch';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const ResetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string().min(8, 'Confirm password must be at least 8 characters'),
}).refine((data) => data.password === data.confirm_password, {
  message: 'Passwords mismatch',
  path: ['confirm_password'],
});

export async function validateResetLink(uid: string, token: string) {
  const response = await get(`auth/reset-password/?uid=${uid}&token=${token}`);
  return response.error ? { error: response.error || 'Invalid reset link' } : { success: true };
}

export async function resetPassword(uid: string, token: string, data: z.infer<typeof ResetPasswordSchema>) {
  const response = await patch(`auth/reset-password/?uid=${uid}&token=${token}`, data);
  if (response.error) {
    return { error: response.error.message || 'Failed to reset password' };
  }
  return { success: 'Password reset successfully', redirectTo: '/auth/login' };
}